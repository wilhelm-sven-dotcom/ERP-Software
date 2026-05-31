/**
 * Kalkulations-Typen — abgeleitet aus der Legacy-Funktion `calculateSum`
 * (legacy/ip3_PV_Tool_6_19.html, Z. 3344–3385).
 *
 * Rabatt-Kaskade (NICHT kommutativ – Reihenfolge ist verbindlich):
 *   1) Positionsrabatt (%)  je Position
 *   2) Gruppenrabatt (%)    je Gruppe (PV-Anlage | Speicher | Wallbox | Sonstiges)
 *   3) Pauschalrabatt (%)   auf die Zwischensumme
 *   4) Nachlass (€)         absolut
 *   5) MwSt (%)             Standard 19, PV-Nullsteuersatz = 0
 *   6) Skonto (%)           auf den BRUTTO-Betrag
 */

/** Normalisierte Hauptgruppen (Legacy `positionGroup`). */
export type PositionGroup =
  | "PV-Anlage"
  | "Speicher"
  | "Wallbox"
  | "Sonstiges";

export const POSITION_GROUPS: PositionGroup[] = [
  "PV-Anlage",
  "Speicher",
  "Wallbox",
  "Sonstiges",
];

/** Eine Kalkulationsposition (Legacy-Felder: menge/vk/ek/rabatt). */
export interface CalcPosition {
  id: string;
  product_id?: string | null;
  bezeichnung: string;
  /** Menge (Legacy: quantity/menge). */
  menge: number;
  einheit?: string | null;
  /** Einkaufspreis je Einheit (Legacy: ek). */
  ek?: number | null;
  /** Verkaufspreis netto je Einheit (Legacy: vk). */
  einzelpreis: number;
  /** Positionsrabatt in Prozent (0–100). */
  rabatt?: number | null;
  /** Hauptgruppe (für Gruppenrabatt). Default: Sonstiges. */
  group?: PositionGroup;
}

/** Eingaben für die Summenberechnung (entspricht den calc-Feldern). */
export interface CalcInput {
  positions: CalcPosition[];
  /** Gruppenrabatte in Prozent je Hauptgruppe (optional). */
  gruppenRabatte?: Partial<Record<PositionGroup, number>>;
  /** Pauschalrabatt in Prozent auf die Zwischensumme (0–100). */
  pauschalRabattPercent?: number;
  /** Nachlass absolut in € (netto). */
  nachlass?: number;
  /** MwSt-Satz in Prozent (z. B. 19 oder 0 für PV-Nullsteuersatz). */
  mwstPercent: number;
  /** Skonto in Prozent auf den Bruttobetrag (0–100). */
  skontoPercent?: number;
}

export interface CalcPositionResult extends CalcPosition {
  /** Position netto nach Positionsrabatt (vor Gruppenrabatt). */
  positionNetto: number;
  /** Einkaufswert der Position = menge * ek. */
  positionEk: number;
}

/** Gesamtergebnis (Feldnamen entsprechen der Legacy-Rückgabe). */
export interface CalcTotals {
  /** Σ Positionen netto vor Pauschalrabatt/Nachlass (nach Gruppenrabatt). */
  nettoVorPauschal: number;
  /** Summe netto (nach Pauschalrabatt & Nachlass). */
  netto: number;
  /** MwSt-Satz in Prozent. */
  mwstSatz: number;
  /** MwSt-Betrag. */
  mwstBetrag: number;
  /** Brutto = netto + MwSt. */
  brutto: number;
  /** Skonto-Betrag (auf brutto). */
  skontoBetrag: number;
  /** Brutto nach Skonto. */
  bruttoNachSkonto: number;
  /** Einkaufswert gesamt. */
  ekGesamt: number;
  /** Marge (Deckungsbeitrag) = netto - ekGesamt. */
  marge: number;
  /** Marge in Prozent = marge / netto * 100. */
  margeProzent: number;
  /** Summen je Hauptgruppe (netto vor Pauschalrabatt). */
  gruppenSummen: Record<PositionGroup, number>;
}

export interface CalcResult {
  positions: CalcPositionResult[];
  totals: CalcTotals;
}
