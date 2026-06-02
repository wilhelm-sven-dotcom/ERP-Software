import type { ProjectStatus } from "@/lib/types";

/** Pipeline-Stufen in Reihenfolge (Legacy-verifiziert). */
export const PROJECT_STATUSES: ProjectStatus[] = [
  "Anfrage",
  "Angebot",
  "Auftrag",
  "Entwurf",
  "gewonnen",
  "verloren",
];

/** Angebotsstatus in Reihenfolge. */
export const OFFER_STATUSES = [
  "Entwurf",
  "Versendet",
  "Angenommen",
  "Abgelehnt",
] as const;

export function offerStatusVariant(
  status: string | null,
): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "Angenommen":
      return "default";
    case "Abgelehnt":
      return "destructive";
    case "Versendet":
      return "secondary";
    default:
      return "outline";
  }
}

/** Status für Folgedokumente (AB/Lieferschein). */
export const DOCUMENT_STATUSES = [
  "Entwurf",
  "Versendet",
  "Bestätigt",
  "Abgeschlossen",
] as const;

/** Zahlungsstatus einer Rechnung. */
export const PAYMENT_STATUSES = [
  "offen",
  "teilbezahlt",
  "bezahlt",
] as const;

/**
 * Standard-Zahlungsplan PV (Abschläge) — abgeleitet aus dem Textbaustein
 * „Zahlungsbedingungen" (30/35/30/5). Die ersten drei sind Abschläge,
 * der Rest (5 %) wird als Schlussrechnung automatisch ermittelt.
 */
export const INVOICE_SCHEME_PV = [
  { label: "1. Abschlag bei Auftragserteilung", percent: 30 },
  { label: "2. Abschlag bei Materiallieferung", percent: 35 },
  { label: "3. Abschlag bei Montagebeginn", percent: 30 },
] as const;

/** Mahnstufen (Titel + Mahngebühr in €). */
export const MAHN_STAGES = [
  { level: 1, title: "Zahlungserinnerung", fee: 0 },
  { level: 2, title: "1. Mahnung", fee: 5 },
  { level: 3, title: "2. Mahnung", fee: 10 },
] as const;

/** Mahnstufe zu einem (1-basierten) Level, gedeckelt auf die höchste Stufe. */
export function mahnStage(level: number) {
  const i = Math.min(Math.max(level, 1), MAHN_STAGES.length) - 1;
  return MAHN_STAGES[i];
}

/** Vorgabe-Einheiten und -Kategorien für den Produktkatalog (client-sicher). */
export const DEFAULT_UNITS = [
  "Stk",
  "m",
  "m²",
  "kg",
  "kWp",
  "kWh",
  "Pauschale",
  "Std",
  "km",
];
export const DEFAULT_CATEGORIES = [
  "Modul",
  "Wechselrichter",
  "Speicher",
  "Unterkonstruktion",
  "Kabel/Leitung",
  "Wallbox",
  "Montage",
  "Planung",
  "Sonstiges",
];

/** Default-Aufschläge für die Preisbildung (Basis-EK → EK → VK). */
export const PRICE_DEFAULTS = { safety_pct: 0, margin_pct: 20 };

/** Quelle einer Anfrage (Vertriebs-Lead). */
export const LEAD_SOURCES = [
  "Telefon",
  "Web-Formular",
  "E-Mail",
  "Empfehlung",
  "Messe",
  "Bestandskunde",
  "Sonstiges",
] as const;

/** Anlagentypen (für Angebots-Bausteine und Projektablauf-Vorlagen). */
export const PROJECT_TYPES = [
  "Dachanlage bis 10 kWp",
  "Dachanlage bis 100 kWp",
  "Dachanlage bis 300 kWp",
  "Große Dachanlage",
  "Freiflächenanlage",
  "Speicherprojekt",
] as const;
export type ProjectType = (typeof PROJECT_TYPES)[number];

/** Farbliche Einordnung je Status (Badge-Variante). */
export function statusVariant(
  status: string | null,
): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "gewonnen":
      return "default";
    case "verloren":
      return "destructive";
    case "Auftrag":
      return "secondary";
    default:
      return "outline";
  }
}
