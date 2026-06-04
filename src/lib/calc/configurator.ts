import type { Product } from "@/lib/types";
import type { CalcPosition, PositionGroup } from "./types";
import { computeServicePrice, type ServicePricing } from "./service-pricing";

/** Eingaben für den Schnell-Konfigurator. */
export interface ConfiguratorInput {
  kwp: number;
  kwh: number;
  products: Product[];
  prefs?: {
    moduleManufacturer?: string;
    inverterManufacturer?: string;
    storageManufacturer?: string;
  };
}

const num = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;

function specsOf(p: Product): Record<string, unknown> {
  return (p.specs as Record<string, unknown> | null) ?? {};
}
function matches(p: Product, words: string[]): boolean {
  const hay = `${p.category ?? ""} ${p.name}`.toLowerCase();
  return words.some((w) => hay.includes(w));
}
function byPref(list: Product[], manufacturer?: string): Product[] {
  if (!manufacturer) return list;
  const m = manufacturer.toLowerCase();
  const pref = list.filter((p) => (p.manufacturer ?? "").toLowerCase() === m);
  return pref.length > 0 ? pref : list;
}

let seq = 0;
function makePosition(
  p: Product,
  menge: number,
  group: PositionGroup,
  kwp: number,
): CalcPosition {
  const specs = specsOf(p);
  const servicePricing =
    specs.is_service && specs.pricing && typeof specs.pricing === "object"
      ? (specs.pricing as ServicePricing)
      : null;
  return {
    id: `cfg-${Date.now()}-${++seq}`,
    product_id: p.id,
    bezeichnung: p.name,
    menge,
    einheit: p.unit ?? "Stk",
    ek: p.price_purchase ?? 0,
    einzelpreis: servicePricing ? computeServicePrice(servicePricing, kwp) : (p.price_sell ?? 0),
    group,
    splitPvPct: num(specs.split_pv_pct),
    moduleWp: num(specs.module_wp),
    kwhPerUnit: num(specs.storage_kwh),
    servicePricing,
  };
}

/**
 * Stellt aus wenigen Eingaben (kWp, Speicher-kWh, bevorzugte Hersteller)
 * automatisch eine Kalkulation zusammen: Module (Anzahl aus kWp/Modul-Wp),
 * passender Wechselrichter, Speicher (Anzahl aus kWh), und alle Dienstleistungen
 * (nach kWp-Staffel bepreist). Mengen/Preise sind danach normal feinjustierbar.
 */
export function generatePositions(input: ConfiguratorInput): CalcPosition[] {
  const { kwp, kwh, products, prefs } = input;
  const out: CalcPosition[] = [];

  // 1) Modul: höchste Priorität specs.module_wp, sonst Kategorie/Name.
  const moduleCandidates = byPref(
    products.filter((p) => (num(specsOf(p).module_wp) ?? 0) > 0 || matches(p, ["modul", "panel"])),
    prefs?.moduleManufacturer,
  );
  const moduleProd = moduleCandidates[0] ?? null;
  let moduleCount = 0;
  if (moduleProd && kwp > 0) {
    const wp = num(specsOf(moduleProd).module_wp) ?? 0;
    moduleCount = wp > 0 ? Math.ceil((kwp * 1000) / wp) : 0;
    if (moduleCount > 0) out.push(makePosition(moduleProd, moduleCount, "PV-Anlage", kwp));
  }

  // 2) Wechselrichter nach Nennleistung (kW) dimensionieren.
  const inverterCandidates = byPref(
    products.filter(
      (p) =>
        ((num(specsOf(p).inverter_kw) ?? 0) > 0 || matches(p, ["wechselrichter", "inverter", "controller"])) &&
        (num(specsOf(p).module_wp) ?? 0) === 0,
    ),
    prefs?.inverterManufacturer,
  );
  if (inverterCandidates.length > 0 && kwp > 0) {
    const withKw = inverterCandidates.filter((p) => (num(specsOf(p).inverter_kw) ?? 0) > 0);
    if (withKw.length > 0) {
      // Bestes Modell: größter WR, der ≤ kWp ist (sonst der kleinste verfügbare),
      // Anzahl so, dass die AC-Nennleistung die Anlage abdeckt.
      const sorted = [...withKw].sort((a, b) => (num(specsOf(a).inverter_kw) ?? 0) - (num(specsOf(b).inverter_kw) ?? 0));
      let chosen = sorted[0];
      for (const p of sorted) {
        const kw = num(specsOf(p).inverter_kw) ?? 0;
        if (kw <= kwp) chosen = p;
      }
      const kw = num(specsOf(chosen).inverter_kw) ?? 0;
      const count = kw > 0 ? Math.max(1, Math.round(kwp / kw)) : 1;
      out.push(makePosition(chosen, count, "PV-Anlage", kwp));
    } else {
      out.push(makePosition(inverterCandidates[0], 1, "PV-Anlage", kwp));
    }
  }

  // 3) Speicher: specs.storage_kwh oder Kategorie. Anzahl aus kWh.
  if (kwh > 0) {
    const storageCandidates = byPref(
      products.filter((p) => (num(specsOf(p).storage_kwh) ?? 0) > 0 || matches(p, ["speicher", "batterie", "battery", "storage"])),
      prefs?.storageManufacturer,
    );
    const storageProd = storageCandidates[0] ?? null;
    if (storageProd) {
      const perUnit = num(specsOf(storageProd).storage_kwh) ?? 0;
      const count = perUnit > 0 ? Math.max(1, Math.round(kwh / perUnit)) : 1;
      out.push(makePosition(storageProd, count, "Speicher", kwp));
    }
  }

  // --- Helfer für die brand-/größenbewusste Auswahl von Material & Dienstleistung
  // Größenklasse aus kWp ableiten (entspricht den Import-Flags specs.sizes).
  const bucket: "bis10" | "bis30" | "bis135" =
    kwp <= 10 ? "bis10" : kwp <= 30 ? "bis30" : "bis135";

  // Tatsächlich gewählte Hersteller (Modul/WR/Speicher) — bestimmt, welche
  // markenspezifischen Dienstleistungen passen (z. B. „… SMA" vs. „… Sigenergy").
  const chosenMakers = new Set<string>();
  for (const p of out) {
    const m = products.find((x) => x.id === p.product_id)?.manufacturer?.toLowerCase().trim();
    if (m) chosenMakers.add(m);
  }
  for (const m of [prefs?.moduleManufacturer, prefs?.inverterManufacturer, prefs?.storageManufacturer]) {
    if (m) chosenMakers.add(m.toLowerCase().trim());
  }
  // Alle bekannten Herstellernamen — um Markennennungen in Positionsnamen zu erkennen.
  const allMakers = new Set<string>();
  for (const p of products) {
    const m = p.manufacturer?.toLowerCase().trim();
    if (m && m.length >= 3) allMakers.add(m);
  }
  // Nennt der Name eine FREMDE Marke (nicht unter den gewählten)? → nicht passend.
  const mentionsForeignMaker = (name: string): boolean => {
    const hay = name.toLowerCase();
    for (const m of allMakers) {
      if (hay.includes(m) && !chosenMakers.has(m)) return true;
    }
    return false;
  };
  // Passt die Position zur Größenklasse? 3 = exakt, 2 = „alle", 1 = unbekannt, 0 = falsche Klasse.
  const sizeScore = (p: Product): number => {
    const sizes = specsOf(p).sizes as Record<string, boolean> | undefined;
    if (!sizes || typeof sizes !== "object") return 1;
    if (sizes[bucket]) return 3;
    if (sizes.alle) return 2;
    if (kwh > 0 && sizes.speicher && matches(p, ["speicher", "batterie", "storage"])) return 3;
    return 0;
  };
  // Basis-Schlüssel: Name ohne Größen-/Markensuffix → dedupliziert Varianten
  // („UK + Modulmontage (bis 10 kWp)" und „… (30–135 kVA)" werden ein Eintrag).
  const baseKey = (name: string): string => {
    let s = name.toLowerCase().replace(/\([^)]*\)/g, " ");
    for (const m of allMakers) s = s.split(m).join(" ");
    return s.replace(/\s+/g, " ").trim();
  };
  // Aus einer Gruppe gleichartiger Positionen die beste wählen (Größe, dann Marke).
  const pickBest = (group: Product[]): Product | null => {
    const eligible = group.filter((p) => sizeScore(p) > 0 && !mentionsForeignMaker(p.name));
    if (eligible.length === 0) return null;
    return eligible.sort((a, b) => {
      const s = sizeScore(b) - sizeScore(a);
      if (s !== 0) return s;
      const am = chosenMakers.has((a.manufacturer ?? "").toLowerCase().trim()) ? 1 : 0;
      const bm = chosenMakers.has((b.manufacturer ?? "").toLowerCase().trim()) ? 1 : 0;
      return bm - am;
    })[0];
  };

  const usedIds = new Set(out.map((p) => p.product_id));

  // 4) Material (kein Modul/WR/Speicher/Dienstleistung): je Art genau EIN Produkt.
  const materialGroups = new Map<string, Product[]>();
  for (const p of products) {
    if (usedIds.has(p.id) || specsOf(p).is_service) continue;
    if ((num(specsOf(p).module_wp) ?? 0) > 0 || (num(specsOf(p).storage_kwh) ?? 0) > 0 || (num(specsOf(p).inverter_kw) ?? 0) > 0) continue;
    if (!matches(p, ["montage", "unterkonstruktion", "gestell", "schiene", "befestig", "kabel", "leitung", "stecker", "kleinmaterial", "zubehör", "zubehoer"])) continue;
    const key = baseKey(p.name);
    (materialGroups.get(key) ?? materialGroups.set(key, []).get(key)!).push(p);
  }
  for (const group of materialGroups.values()) {
    const best = pickBest(group);
    if (!best) continue;
    const perModule = matches(best, ["montage", "unterkonstruktion", "gestell", "schiene", "befestig"]);
    out.push(makePosition(best, perModule ? Math.max(1, moduleCount) : 1, "PV-Anlage", kwp));
  }

  // 5) Dienstleistungen (is_service): je Art genau EINE, passend zu Größe + Marke.
  const serviceGroups = new Map<string, Product[]>();
  for (const p of products) {
    if (!specsOf(p).is_service) continue;
    // Speicher-Dienstleistungen nur bei vorhandenem Speicher.
    if (kwh <= 0 && matches(p, ["speicher", "batterie", "storage"])) continue;
    const key = baseKey(p.name);
    (serviceGroups.get(key) ?? serviceGroups.set(key, []).get(key)!).push(p);
  }
  for (const group of serviceGroups.values()) {
    const best = pickBest(group);
    if (best) out.push(makePosition(best, 1, "Sonstiges", kwp));
  }

  return out;
}

/**
 * Parametrische Vorlagen-Position: Menge ergibt sich aus der Anlagengröße.
 * `qtyPerKwp` (Menge je kWp) bzw. `qtyPerModule` (× Modulanzahl) werden auf die
 * aktuelle Größe umgerechnet. Ohne Parameter bleibt die feste Menge.
 */
export function scaleQuantity(
  pos: CalcPosition & { qtyPerKwp?: number | null; qtyPerModule?: number | null },
  kwp: number,
  moduleCount: number,
): number {
  if (typeof pos.qtyPerKwp === "number" && pos.qtyPerKwp > 0) {
    return Math.max(1, Math.round(pos.qtyPerKwp * kwp));
  }
  if (typeof pos.qtyPerModule === "number" && pos.qtyPerModule > 0) {
    return Math.max(1, Math.round(pos.qtyPerModule * moduleCount));
  }
  return typeof pos.menge === "number" ? pos.menge : 0;
}
