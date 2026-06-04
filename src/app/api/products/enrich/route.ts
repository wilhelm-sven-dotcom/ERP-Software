import { NextResponse } from "next/server";

import { getCurrentEmployee } from "@/lib/supabase/auth";
import { chatJSON, isAiConfigured } from "@/lib/ai/openai";
import { isWebSearchConfigured, webSearch } from "@/lib/ai/websearch";

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

/**
 * Reichert ein Produkt mit technischen Daten aus dem Netz an:
 * Websuche nach dem echten Datenblatt → Inhalte → KI extrahiert die Kenndaten.
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

  const query = `${manufacturer} ${name} Datenblatt technische Daten specifications datasheet`.trim();
  const hits = await webSearch(query, { maxResults: 5 });
  if (hits.length === 0)
    return NextResponse.json({ enabled: true, result: null, reason: "Keine Treffer im Netz." });

  // Quellen + (gekürzte) Inhalte für die KI aufbereiten.
  const sources = hits.map((h) => h.url).filter(Boolean).slice(0, 5);
  const context = hits
    .map((h, i) => `### Quelle ${i + 1}: ${h.title}\n${h.url}\n${h.content}`)
    .join("\n\n")
    .slice(0, 14000);

  const result = await chatJSON<{ specs?: Record<string, string | number>; reason?: string }>(
    [
      {
        role: "system",
        content:
          "Du extrahierst die technischen Kenndaten eines PV-/Speicher-Produkts (Wechselrichter, " +
          "Modul, Speicher, Wallbox) aus Web-Quellen. Nutze NUR Angaben, die zum genannten Produkt/ " +
          "Modell passen und in den Quellen wirklich stehen — NICHTS erfinden, keine Werte anderer " +
          "Modelle. Gib ein JSON { specs: { … }, reason } zurück. Verwende, wo passend, diese " +
          "Schlüssel (Zahlen ohne Einheit): manufacturer, model, module_wp, inverter_kw, storage_kwh, " +
          "efficiency_pct, max_dc_voltage, mppt_count, max_input_current_a, max_output_current_a, phases, " +
          "nominal_voltage_v, dimensions (BxHxT als Text), weight_kg, warranty_years, ip_rating, " +
          "operating_temp, cell_type. " +
          "Weitere belegte Kenndaten als zusätzliche Schlüssel erlaubt. Sind keine sicheren Daten " +
          "auffindbar, gib specs: {} und erkläre es kurz in reason.",
      },
      {
        role: "user",
        content: `Produkt: ${manufacturer} ${name}\n\nWeb-Quellen:\n${context}`,
      },
    ],
    { maxTokens: 900 },
  );

  if (!result) return NextResponse.json({ enabled: true, result: null, reason: "KI-Auslese fehlgeschlagen." });

  const specs: Record<string, string | number> = {};
  if (result.specs && typeof result.specs === "object" && !Array.isArray(result.specs)) {
    for (const [k, v] of Object.entries(result.specs)) {
      if (typeof v === "string" || typeof v === "number") specs[k] = v;
    }
  }

  const out: EnrichResult = { specs, sources, reason: typeof result.reason === "string" ? result.reason : "" };
  return NextResponse.json({ enabled: true, result: out });
}
