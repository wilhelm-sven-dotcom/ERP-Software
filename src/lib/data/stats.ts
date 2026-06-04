import { getAllOffers } from "@/lib/data/offers";
import { getProjects } from "@/lib/data/projects";

export interface MonthBucket {
  /** Monatsschlüssel YYYY-MM. */
  key: string;
  /** Anzeige-Label, z. B. „Jun 26". */
  label: string;
  revenue: number;
  kwp: number;
  kwh: number;
}

export interface AdminStats {
  months: MonthBucket[];
  revenueTotal: number;
  soldKwp: number;
  soldKwh: number;
  pipelineValue: number;
  pipelineKwp: number;
  pipelineKwh: number;
  openProjects: number;
}

const ACCEPTED = "Angenommen";
const OPEN_OFFER = ["Entwurf", "Versendet"];
const CLOSED_PROJECT = ["gewonnen", "verloren"];

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function monthLabel(d: Date): string {
  return new Intl.DateTimeFormat("de-DE", {
    month: "short",
    year: "2-digit",
  }).format(d);
}

/**
 * Admin-Kennzahlen: Umsatz (angenommene Angebote) sowie verkaufte und in der
 * Pipeline befindliche kWp/kWh, je Monat (letzte 6 Monate) und gesamt.
 */
export async function getAdminStats(): Promise<AdminStats> {
  const [offers, projects] = await Promise.all([getAllOffers(), getProjects()]);

  // Letzte 6 Monate als leere Buckets vorbereiten.
  const now = new Date();
  const months: MonthBucket[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({ key: monthKey(d), label: monthLabel(d), revenue: 0, kwp: 0, kwh: 0 });
  }
  const byKey = new Map(months.map((m) => [m.key, m]));

  let revenueTotal = 0;
  let soldKwp = 0;
  let soldKwh = 0;
  let pipelineValue = 0;

  for (const o of offers) {
    const brutto =
      typeof o.totals?.brutto === "number" ? (o.totals.brutto as number) : 0;
    const kwp = o.project?.system_size_kwp ?? 0;
    const kwh = o.project?.storage_kwh ?? 0;
    if (o.status === ACCEPTED) {
      revenueTotal += brutto;
      soldKwp += kwp;
      soldKwh += kwh;
      const bucket = byKey.get(monthKey(new Date(o.created_at)));
      if (bucket) {
        bucket.revenue += brutto;
        bucket.kwp += kwp;
        bucket.kwh += kwh;
      }
    } else if (OPEN_OFFER.includes(o.status)) {
      pipelineValue += brutto;
    }
  }

  let pipelineKwp = 0;
  let pipelineKwh = 0;
  let openProjects = 0;
  for (const p of projects) {
    if (!CLOSED_PROJECT.includes(String(p.status))) {
      openProjects += 1;
      pipelineKwp += p.system_size_kwp ?? 0;
      pipelineKwh += p.storage_kwh ?? 0;
    }
  }

  return {
    months,
    revenueTotal,
    soldKwp,
    soldKwh,
    pipelineValue,
    pipelineKwp,
    pipelineKwh,
    openProjects,
  };
}
