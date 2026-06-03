import "server-only";

/**
 * PVGIS (EU Joint Research Centre) — kostenloser Solar-Ertrags-Service.
 * Liefert den standortspezifischen Jahresertrag in kWh je 1 kWp (E_y) für
 * gegebene Lage, Dachneigung und Ausrichtung. Fehlertolerant → null
 * (Aufrufer fällt dann auf den Firmen-Default zurück).
 */

const BASE = "https://re.jrc.ec.europa.eu/api/v5_2/PVcalc";

/** Dachausrichtung (Text) → PVGIS „aspect" in Grad (0=Süd, -90=Ost, 90=West, 180=Nord). */
export function aspectFromOrientation(text: string | null | undefined): number {
  const t = (text ?? "").toLowerCase();
  if (!t) return 0;
  if (/(südost|sudost|so\b|south.?east)/.test(t)) return -45;
  if (/(südwest|sudwest|sw\b|south.?west)/.test(t)) return 45;
  if (/(nordost|no\b|north.?east)/.test(t)) return -135;
  if (/(nordwest|nw\b|north.?west)/.test(t)) return 135;
  if (/(süd|sud|\bs\b|south)/.test(t)) return 0;
  if (/(nord|\bn\b|north)/.test(t)) return 180;
  if (/(ost|\bo\b|\be\b|east)/.test(t)) return -90;
  if (/(west|\bw\b)/.test(t)) return 90;
  return 0;
}

export interface YieldResult {
  /** Spezifischer Jahresertrag in kWh/kWp. */
  specificYield: number;
  tilt: number;
  aspect: number;
}

export async function fetchSpecificYield(input: {
  lat: number;
  lon: number;
  tilt?: number | null;
  aspect?: number | null;
}): Promise<YieldResult | null> {
  const tilt = typeof input.tilt === "number" && input.tilt >= 0 && input.tilt <= 90 ? input.tilt : 30;
  const aspect = typeof input.aspect === "number" ? input.aspect : 0;
  const params = new URLSearchParams({
    lat: String(input.lat),
    lon: String(input.lon),
    peakpower: "1",
    loss: "14",
    angle: String(tilt),
    aspect: String(aspect),
    pvtechchoice: "crystSi",
    mountingplace: "building",
    outputformat: "json",
  });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const res = await fetch(`${BASE}?${params.toString()}`, { signal: controller.signal });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      outputs?: { totals?: { fixed?: { E_y?: number } } };
    };
    const ey = data.outputs?.totals?.fixed?.E_y;
    if (typeof ey !== "number" || !Number.isFinite(ey) || ey <= 0) return null;
    return { specificYield: Math.round(ey), tilt, aspect };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
