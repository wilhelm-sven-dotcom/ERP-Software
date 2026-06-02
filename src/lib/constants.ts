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
