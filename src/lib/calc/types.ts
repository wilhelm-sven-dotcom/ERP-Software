/**
 * Kalkulations-Typen.
 *
 * Feldnamen orientieren sich an der Legacy-Struktur (legacy/ip3_PV_Tool_6_19.html):
 * Positionen mit menge/einzelpreis/ek/rabatt/einheit/bezeichnung; Summen
 * sumRabatt, sumZuschlag, sumNetto, sumBrutto, mwst, Marge.
 *
 * Die Engine ist bewusst rein/testbar (keine DB, kein React) und in einer Datei
 * gekapselt, damit Formeln zentral angepasst werden können.
 */

/** Art einer Position (Standardposition vs. Festpreis – aus Legacy 'PV'/'FIX'). */
export type PositionKind = "standard" | "fix";

/** Eine Kalkulationsposition. */
export interface CalcPosition {
  id: string;
  /** Verweis auf einen Produktkatalog-Eintrag (optional). */
  product_id?: string | null;
  /** Bezeichnung (frei oder aus Produkt übernommen). */
  bezeichnung: string;
  /** Menge. */
  menge: number;
  /** Einheit (z.B. Stk, m, kWp). */
  einheit?: string | null;
  /** Einkaufspreis je Einheit (für Marge). */
  ek?: number | null;
  /** Verkaufspreis (Einzelpreis netto) je Einheit. */
  einzelpreis: number;
  /** Rabatt in Prozent auf die Position (0–100). */
  rabatt?: number | null;
  kind?: PositionKind;
}

/** Eingaben für die Summenberechnung. */
export interface CalcInput {
  positions: CalcPosition[];
  /** MwSt-Satz in Prozent (z.B. 19 oder 0 für den PV-Nullsteuersatz). */
  mwstPercent: number;
  /** Optionaler Gesamtrabatt in Prozent auf die Zwischensumme (0–100). */
  gesamtRabattPercent?: number;
  /** Optionale Zuschläge (absolut, netto), z.B. Anfahrt. */
  zuschlaege?: { bezeichnung: string; betrag: number }[];
}

/** Ergebnis je Position. */
export interface CalcPositionResult extends CalcPosition {
  /** Position netto nach Positionsrabatt = menge * einzelpreis * (1 - rabatt/100). */
  positionNetto: number;
  /** Einkaufswert der Position = menge * ek. */
  positionEk: number;
}

/** Gesamtergebnis (entspricht den Legacy-Summen). */
export interface CalcTotals {
  /** Summe der Positionen vor Gesamtrabatt/Zuschlag. */
  zwischensumme: number;
  /** Rabattbetrag aus Positions- und Gesamtrabatt (Legacy: sumRabatt). */
  sumRabatt: number;
  /** Summe der Zuschläge (Legacy: sumZuschlag). */
  sumZuschlag: number;
  /** Summe netto (Legacy: sumNetto). */
  sumNetto: number;
  /** MwSt-Betrag. */
  mwstBetrag: number;
  /** Summe brutto (Legacy: sumBrutto). */
  sumBrutto: number;
  /** Einkaufswert gesamt. */
  sumEk: number;
  /** Deckungsbeitrag = sumNetto - sumEk. */
  deckungsbeitrag: number;
  /** Marge in Prozent = deckungsbeitrag / sumNetto * 100. */
  margePercent: number;
}

export interface CalcResult {
  positions: CalcPositionResult[];
  totals: CalcTotals;
}
