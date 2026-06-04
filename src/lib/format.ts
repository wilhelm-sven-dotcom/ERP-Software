/** Gemeinsame Formatierungs-Helfer (deutsch). */

export function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "–";
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(value);
}

export function formatNumber(
  value: number | null | undefined,
  digits = 2,
): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "–";
  return new Intl.NumberFormat("de-DE", {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  }).format(value);
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "–";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "–";
  return new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" }).format(d);
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "–";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "–";
  return new Intl.DateTimeFormat("de-DE", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(d);
}

export function customerName(c: {
  company?: string | null;
  first_name?: string | null;
  last_name?: string | null;
}): string {
  const person = [c.first_name, c.last_name].filter(Boolean).join(" ");
  if (c.company && person) return `${c.company} (${person})`;
  return c.company || person || "Unbenannt";
}

/**
 * Ist ein Datensatz „neu" (innerhalb der letzten `hours` Stunden angelegt)?
 * Für die kurzlebige „Neu"-Markierung in Listen — verschwindet automatisch.
 */
export function isNew(createdAt: string | null | undefined, hours = 24): boolean {
  if (!createdAt) return false;
  const t = new Date(createdAt).getTime();
  if (!Number.isFinite(t)) return false;
  return Date.now() - t < hours * 3600 * 1000;
}
