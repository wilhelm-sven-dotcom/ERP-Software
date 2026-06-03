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

  // 4) Material-Stückliste: Montage/Unterkonstruktion ~ je Modul; Kabel/Stecker
  //    je 1 (grobe Mengen, danach anpassbar). Nur „echte" Materialprodukte
  //    (keine Module/WR/Speicher/Dienstleistungen).
  const usedIds = new Set(out.map((p) => p.product_id));
  for (const p of products) {
    if (usedIds.has(p.id) || specsOf(p).is_service) continue;
    if ((num(specsOf(p).module_wp) ?? 0) > 0 || (num(specsOf(p).storage_kwh) ?? 0) > 0 || (num(specsOf(p).inverter_kw) ?? 0) > 0) continue;
    if (matches(p, ["montage", "unterkonstruktion", "gestell", "schiene", "befestig"])) {
      out.push(makePosition(p, Math.max(1, moduleCount), "PV-Anlage", kwp));
    } else if (matches(p, ["kabel", "leitung", "stecker", "kleinmaterial", "zubehör", "zubehoer"])) {
      out.push(makePosition(p, 1, "PV-Anlage", kwp));
    }
  }

  // 5) Dienstleistungen (is_service): nach kWp-Staffel bepreist, Menge 1.
  for (const p of products.filter((x) => Boolean(specsOf(x).is_service))) {
    out.push(makePosition(p, 1, "Sonstiges", kwp));
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
