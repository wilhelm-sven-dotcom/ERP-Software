import { NextResponse } from "next/server";

import { getCurrentEmployee } from "@/lib/supabase/auth";
import { chatJSON, isAiConfigured, aiModelStrong } from "@/lib/ai/openai";
import { isWebSearchConfigured, webSearch } from "@/lib/ai/websearch";
import { analyzeDocument, isDocIntelConfigured } from "@/lib/ai/doc-intelligence";

export const maxDuration = 60;

interface EnrichBody {
  name?: string;
  manufacturer?: string;
  category?: string;
}

export interface EnrichResult {
  /** Freie Kenndaten-Map (key → Wert), wie aus dem Datenblatt gelesen. */
  specs: Record<string, string | number>;
  /** Quellen (URLs), aus denen die Daten stammen — zur Nachprüfung. */
  sources: string[];
  reason: string;
}

/** Lädt eine (PDF-)URL als ArrayBuffer; fehlertolerant, mit Zeit-/Größenlimit. */
async function downloadPdf(url: string, timeoutMs = 15000): Promise<ArrayBuffer | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal, redirect: "follow" });
    if (!res.ok) return null;
    const type = res.headers.get("content-type") ?? "";
    const len = Number(res.headers.get("content-length") ?? "0");
    // Nur PDFs, und nichts Riesiges (Azure/Token-Schutz).
    if (len > 15_000_000) return null;
    if (!/pdf/i.test(type) && !/\.pdf($|\?)/i.test(url)) return null;
    return await res.arrayBuffer();
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Reichert ein Produkt mit technischen Daten aus dem Netz an:
 * Websuche nach dem echten Datenblatt → wenn möglich das PDF herunterladen und
 * mit Azure (Tabellen!) auslesen → starkes Modell extrahiert die Kenndaten.
 * Findet sich kein PDF, dienen die Such-Inhalte als Fallback.
 * Ohne KI- bzw. Such-Key ist die Funktion aus (graceful).
 */
export async function POST(req: Request) {
  const me = await getCurrentEmployee();
  if (!me) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!isAiConfigured()) return NextResponse.json({ enabled: false, reason: "KI nicht konfiguriert." });
  if (!isWebSearchConfigured())
    return NextResponse.json({ enabled: false, reason: "Web-Suche nicht konfiguriert (WEB_SEARCH_API_KEY fehlt)." });

  let body: EnrichBody;
  try {
    body = (await req.json()) as EnrichBody;
  } catch {
    return NextResponse.json({ enabled: true, result: null });
  }

  const name = (body.name ?? "").trim().slice(0, 200);
  const manufacturer = (body.manufacturer ?? "").trim().slice(0, 100);
  if (!name) return NextResponse.json({ enabled: true, result: null, reason: "Produktname fehlt." });

  const query = `${manufacturer} ${name} Datenblatt technische Daten specifications datasheet filetype:pdf`.trim();
  const hits = await webSearch(query, { maxResults: 6 });
  if (hits.length === 0)
    return NextResponse.json({ enabled: true, result: null, reason: "Keine Treffer im Netz." });

  const sources = hits.map((h) => h.url).filter(Boolean).slice(0, 6);

  // 1) Bestes echtes PDF holen und mit Azure auslesen (höchste Qualität).
  let pdfText = "";
  let pdfSource = "";
  if (isDocIntelConfigured()) {
    const pdfHits = hits.filter((h) => /\.pdf($|\?)/i.test(h.url)).slice(0, 3);
    // Falls kein offensichtliches .pdf, die ersten Treffer trotzdem versuchen.
    const candidates = (pdfHits.length > 0 ? pdfHits : hits.slice(0, 3)).map((h) => h.url);
    for (const url of candidates) {
      const bytes = await downloadPdf(url);
      if (!bytes) continue;
      const di = await analyzeDocument(bytes, "application/pdf");
      if (di?.text && di.text.trim().length > 300) {
        pdfText = di.text;
        pdfSource = url;
        break;
      }
    }
  }

  // 2) Kontext für die KI: PDF-Text (falls vorhanden) + Such-Inhalte als Stütze.
  const snippetContext = hits
    .map((h, i) => `### Quelle ${i + 1}: ${h.title}\n${h.url}\n${h.content}`)
    .join("\n\n");
  const context = pdfText
    ? `### Datenblatt-PDF (${pdfSource}) — maßgeblich:\n${pdfText.slice(0, 22000)}\n\n### Weitere Web-Quellen:\n${snippetContext.slice(0, 4000)}`
    : snippetContext.slice(0, 16000);

  const result = await chatJSON<{ specs?: Record<string, string | number>; reason?: string }>(
    [
      {
        role: "system",
        content:
          "Du extrahierst die technischen Kenndaten eines PV-/Speicher-Produkts (Wechselrichter, " +
          "Modul, Speicher, Wallbox) aus den Quellen — das DATENBLATT-PDF ist maßgeblich. Nutze NUR " +
          "Angaben, die zum genannten Produkt/Modell passen und in den Quellen wirklich stehen — NICHTS " +
          "erfinden, keine Werte anderer Modelle. Deckt das Datenblatt mehrere Modelle einer Familie ab, " +
          "führe modell-abhängige Werte mit klarem Modell-Suffix auf (z. B. inverter_kw_10_0 = 10). Gib " +
          "ein JSON { specs: { … }, reason } zurück. Verwende, wo passend, diese Schlüssel (Zahlen ohne " +
          "Einheit): manufacturer, model, module_wp, inverter_kw, max_ac_power_kw, storage_kwh, " +
          "efficiency_pct, max_efficiency_pct, max_dc_voltage, nominal_dc_voltage, mppt_count, " +
          "max_input_current_a, max_short_circuit_current_a, max_output_current_a, nominal_ac_voltage, " +
          "phases, grid_frequency, dimensions (BxHxT als Text), weight_kg, warranty_years, ip_rating, " +
          "operating_temp, communication, standards, cell_type. Weitere belegte Kenndaten als zusätzliche " +
          "Schlüssel erlaubt — sei VOLLSTÄNDIG. Sind keine sicheren Daten auffindbar, gib specs: {} und " +
          "erkläre es kurz in reason.",
      },
      {
        role: "user",
        content: `Produkt: ${manufacturer} ${name}\n\nQuellen:\n${context}`,
      },
    ],
    { maxTokens: 4000, timeoutMs: 45000, model: aiModelStrong() },
  );

  if (!result) return NextResponse.json({ enabled: true, result: null, reason: "KI-Auslese fehlgeschlagen." });

  const specs: Record<string, string | number> = {};
  if (result.specs && typeof result.specs === "object" && !Array.isArray(result.specs)) {
    for (const [k, v] of Object.entries(result.specs)) {
      if (typeof v === "string" || typeof v === "number") specs[k] = v;
    }
  }

  const reason =
    (typeof result.reason === "string" ? result.reason : "") +
    (pdfText ? "" : " (Hinweis: Kein Datenblatt-PDF gefunden — Auslese aus Web-Texten, daher evtl. unvollständig.)");
  const out: EnrichResult = { specs, sources, reason: reason.trim() };
  return NextResponse.json({ enabled: true, result: out });
}
