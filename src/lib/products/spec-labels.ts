/**
 * Beschriftung technischer Produkt-Kenndaten (`Product.specs`).
 *
 * EINE Quelle für: das generische Technische-Daten-Formular, die Anzeige am
 * Produkt, den Datenblatt-Import und die Web-Anreicherung. So heißen die Felder
 * überall gleich und tragen verständliche deutsche Labels.
 */

/**
 * Schlüssel mit EIGENEN Formularfeldern bzw. interner Bedeutung — werden NICHT
 * als generische „Technische Daten" angezeigt/bearbeitet (sonst doppelt).
 * Müssen mit `saveProduct` (produkte/actions.ts) übereinstimmen.
 */
export const RESERVED_SPEC_KEYS = new Set<string>([
  "module_wp",
  "storage_kwh",
  "inverter_kw",
  "mppt_count",
  "max_input_voltage",
  "max_input_current",
  "split_pv_pct",
  "is_service",
  "pricing",
  "price_override",
  "base_purchase",
  "safety_pct",
  "margin_pct",
]);

/** Bekannte Kenndaten → deutsches Label (inkl. Einheit). */
const SPEC_LABELS: Record<string, string> = {
  manufacturer: "Hersteller",
  model: "Modell",
  efficiency_pct: "Wirkungsgrad (%)",
  max_dc_voltage: "max. DC-Spannung (V)",
  max_input_current_a: "max. Eingangsstrom (A)",
  max_output_current_a: "max. Ausgangsstrom (A)",
  max_charge_current_a: "max. Ladestrom (A)",
  max_discharge_current_a: "max. Entladestrom (A)",
  nominal_voltage_v: "Nennspannung (V)",
  phases: "Phasen",
  dimensions: "Maße (B×H×T)",
  weight_kg: "Gewicht (kg)",
  warranty_years: "Garantie (Jahre)",
  ip_rating: "Schutzart (IP)",
  operating_temp: "Betriebstemperatur",
  cell_type: "Zelltyp",
  power_kw: "Leistung (kW)",
  capacity_kwh: "Kapazität (kWh)",
  // ältere/deutsche Aliasse aus früheren Auslesen
  hersteller: "Hersteller",
  modell: "Modell",
  leistung_wp: "Leistung (Wp)",
  wirkungsgrad_prozent: "Wirkungsgrad (%)",
  kapazitaet_kwh: "Kapazität (kWh)",
  strom_a: "Strom (A)",
  spannung_v: "Spannung (V)",
  masse: "Maße (B×H×T)",
  gewicht_kg: "Gewicht (kg)",
  garantie_jahre: "Garantie (Jahre)",
};

/** Schlüssel → menschenlesbares Label (Fallback: Schlüssel „verschönert"). */
export function labelForSpec(key: string): string {
  if (SPEC_LABELS[key]) return SPEC_LABELS[key];
  return key
    .replace(/_/g, " ")
    .replace(/\b([a-z])/g, (m) => m.toUpperCase())
    .trim();
}

/**
 * Nur die generisch anzeigbaren Kenndaten (ohne reservierte/strukturelle Keys),
 * als sortierte [key, label, value]-Liste.
 */
export function genericSpecEntries(
  specs: Record<string, unknown> | null | undefined,
): { key: string; label: string; value: string | number }[] {
  if (!specs || typeof specs !== "object") return [];
  const out: { key: string; label: string; value: string | number }[] = [];
  for (const [k, v] of Object.entries(specs)) {
    if (RESERVED_SPEC_KEYS.has(k)) continue;
    if (v === null || v === undefined || v === "") continue;
    if (typeof v !== "string" && typeof v !== "number") continue;
    out.push({ key: k, label: labelForSpec(k), value: v });
  }
  out.sort((a, b) => a.label.localeCompare(b.label, "de"));
  return out;
}
