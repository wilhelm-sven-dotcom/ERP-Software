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
