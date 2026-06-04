import { round2 } from "./engine";

export interface ServiceTier {
  /** Obergrenze des Brackets in kWp (null = darüber hinaus). */
  upToKwp: number | null;
  /** Preis je kWp innerhalb dieses Brackets. */
  perKwp: number;
}

export interface ServicePricing {
  mode: "tiered";
  /** Fixer Sockelbetrag. */
  base: number;
  /** Brackets, marginal aufsummiert (wie Steuertarif). */
  tiers: ServiceTier[];
}

/**
 * Dienstleistungspreis abhängig von der Anlagengröße (kWp) — **marginal**
 * gestaffelt: jeder kWp wird mit dem Satz seines Brackets bewertet und
 * aufsummiert (0–10 / 10–30 / 30–135 / >135). Satz 0 = konstant, kleinerer Satz
 * = degressiv. `base` ist ein fixer Sockelbetrag.
 */
export function computeServicePrice(
  pricing: ServicePricing | null | undefined,
  kwp: number | null | undefined,
): number {
  if (!pricing) return 0;
  const size = typeof kwp === "number" && Number.isFinite(kwp) ? kwp : 0;
  let price = pricing.base || 0;
  let lower = 0;
  const tiers = [...(pricing.tiers ?? [])].sort(
    (a, b) => (a.upToKwp ?? Infinity) - (b.upToKwp ?? Infinity),
  );
  for (const t of tiers) {
    const upper = t.upToKwp ?? Infinity;
    const span = Math.min(size, upper) - lower;
    if (span > 0) price += span * (t.perKwp || 0);
    lower = upper;
    if (size <= upper) break;
  }
  return round2(price);
}

/** Standard-Brackets (Obergrenzen) für das Produktformular. */
export const SERVICE_TIER_BOUNDS: (number | null)[] = [10, 30, 135, null];
