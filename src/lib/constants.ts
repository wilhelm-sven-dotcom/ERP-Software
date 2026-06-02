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
