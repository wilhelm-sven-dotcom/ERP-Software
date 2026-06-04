import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentEmployee } from "@/lib/supabase/auth";
import { chatJSON, isAiConfigured, aiModelStrong } from "@/lib/ai/openai";
import { analyzeDocument, isDocIntelConfigured } from "@/lib/ai/doc-intelligence";

export const maxDuration = 60;

interface Body {
  productId?: string;
}

export interface ExtractSpecsResult {
  specs: Record<string, string | number>;
  reason: string;
}

/**
 * Vollständige Datenblatt-Auslese für EIN Produkt mit dem STÄRKEREN Modell
 * (gpt-4o) und großem Token-Budget. Liest den am Produkt hinterlegten
 * Datenblatt-Text (Azure/pdf.js); fehlt er, wird die PDF frisch über Azure
 * ausgelesen. Liefert die kompletten technischen Kenndaten als key→Wert.
 */
export async function POST(req: Request) {
  const me = await getCurrentEmployee();
  if (!me) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!isAiConfigured()) return NextResponse.json({ enabled: false, reason: "KI nicht konfiguriert." });

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ enabled: true, result: null });
  }
  const productId = (body.productId ?? "").trim();
  if (!productId) return NextResponse.json({ enabled: true, result: null, reason: "Produkt fehlt." });

  const supabase = await createClient();
  // Jüngstes Datenblatt-Asset des Produkts holen.
  const { data: asset } = await supabase
    .from("product_assets")
    .select("text_content, storage_path, name")
    .eq("product_id", productId)
    .eq("kind", "datasheet")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!asset) {
    return NextResponse.json({
      enabled: true,
      result: null,
      reason: "Kein Datenblatt am Produkt hinterlegt. Erst ein Datenblatt (PDF) hochladen.",
    });
  }

  let text = (asset.text_content as string | null) ?? "";
  // Kein/zu wenig Text gespeichert → PDF frisch über Azure auslesen (falls aktiv).
  if (text.trim().length < 200 && asset.storage_path && isDocIntelConfigured()) {
    const dl = await supabase.storage.from("product-assets").download(asset.storage_path as string);
    if (dl.data) {
      const di = await analyzeDocument(await dl.data.arrayBuffer(), "application/pdf");
      if (di?.text) text = di.text;
    }
  }
  if (text.trim().length < 50) {
    return NextResponse.json({
      enabled: true,
      result: null,
      reason:
        "Datenblatt-Text konnte nicht ausgelesen werden. Für gescannte PDFs Azure aktivieren (Einstellungen → KI-Dienste).",
    });
  }

  const result = await chatJSON<{ specs?: Record<string, string | number>; reason?: string }>(
    [
      {
        role: "system",
        content:
          "Du liest ein technisches Datenblatt eines PV-/Speicher-Produkts (Wechselrichter, Modul, " +
          "Speicher, Wallbox, Controller) VOLLSTÄNDIG aus und gibst ALLE belegbaren technischen " +
          "Kenndaten als flaches JSON { specs: { key: wert }, reason } zurück. Werte als Zahl ohne " +
          "Einheit, wo sinnvoll; sonst kurzer Text. Nutze, wo passend, englische Standardschlüssel: " +
          "manufacturer, model, module_wp, inverter_kw, max_ac_power_kw, max_apparent_power_kva, " +
          "storage_kwh, max_pv_power_w, mppt_count, max_dc_voltage, nominal_dc_voltage, start_voltage, " +
          "mppt_voltage_range, max_input_current_a, max_short_circuit_current_a, nominal_ac_voltage, " +
          "nominal_output_current_a, max_output_current_a, grid_frequency, power_factor, thdi, " +
          "max_efficiency_pct, euro_efficiency_pct, backup_peak_power_w, switchover_time_ms, " +
          "battery_voltage_range, dimensions, weight_kg, operating_temp, storage_temp, humidity, " +
          "max_altitude_m, cooling, ip_rating, communication, standards, warranty_years, cell_type. " +
          "WICHTIG: Deckt das Datenblatt MEHRERE Modelle einer Familie ab (z. B. 5.0/8.0/10.0 kW), " +
          "nimm die gemeinsamen Werte einmal auf und führe die modell-abhängigen Werte mit klar " +
          "benanntem Modell-Suffix auf (z. B. inverter_kw_10_0 = 10, max_pv_power_w_10_0 = 16000). " +
          "NICHTS erfinden — nur was wirklich im Text steht. Sei vollständig.",
      },
      {
        role: "user",
        content: `Datenblatt „${asset.name ?? "Produkt"}":\n\n${text.slice(0, 24000)}`,
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
  return NextResponse.json({
    enabled: true,
    result: { specs, reason: typeof result.reason === "string" ? result.reason : "" } as ExtractSpecsResult,
  });
}
