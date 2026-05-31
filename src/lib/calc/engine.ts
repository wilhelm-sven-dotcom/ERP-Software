/**
 * Reine Kalkulations-Engine (keine DB, kein React → einfach testbar).
 *
 * Formeln (Standard-Angebotskalkulation, Feldnamen aus dem Legacy-Tool):
 *   Position netto      = menge * einzelpreis * (1 - rabatt/100)
 *   Position EK         = menge * ek
 *   Zwischensumme       = Σ Position netto (vor Gesamtrabatt)
 *   Gesamtrabatt-Betrag = Zwischensumme * gesamtRabattPercent/100
 *   sumRabatt           = Σ Positionsrabatte + Gesamtrabatt-Betrag
 *   sumZuschlag         = Σ Zuschläge (absolut, netto)
 *   sumNetto            = Zwischensumme - Gesamtrabatt-Betrag + sumZuschlag
 *   mwstBetrag          = sumNetto * mwstPercent/100
 *   sumBrutto           = sumNetto + mwstBetrag
 *   Deckungsbeitrag     = sumNetto - sumEk
 *   Marge %             = Deckungsbeitrag / sumNetto * 100
 *
 * MwSt: Standard 19 %, für PV-Anlagen ist der Nullsteuersatz (0 %, §12 Abs. 3
 * UStG) durch mwstPercent=0 abbildbar.
 *
 * Hinweis: Die exakten Legacy-Rundungs-/Edge-Case-Details sind gegen das alte
 * Tool bzw. echte Daten zu verifizieren, sobald Supabase verbunden ist.
 */

import type {
  CalcInput,
  CalcPosition,
  CalcPositionResult,
  CalcResult,
  CalcTotals,
} from "./types";

/** Kaufmännisch auf 2 Nachkommastellen runden. */
export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function num(v: number | null | undefined): number {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

export function computePosition(p: CalcPosition): CalcPositionResult {
  const menge = num(p.menge);
  const einzelpreis = num(p.einzelpreis);
  const rabatt = Math.min(Math.max(num(p.rabatt), 0), 100);
  const positionBrutto = menge * einzelpreis;
  const positionNetto = round2(positionBrutto * (1 - rabatt / 100));
  const positionEk = round2(menge * num(p.ek));
  return { ...p, positionNetto, positionEk };
}

export function calculate(input: CalcInput): CalcResult {
  const positions = input.positions.map(computePosition);

  const zwischensumme = round2(
    positions.reduce((s, p) => s + p.positionNetto, 0),
  );
  const sumEk = round2(positions.reduce((s, p) => s + p.positionEk, 0));

  // Positionsrabatte (Differenz Listenpreis vs. netto je Position)
  const positionsRabatt = round2(
    input.positions.reduce((s, p) => {
      const brutto = num(p.menge) * num(p.einzelpreis);
      const rabatt = Math.min(Math.max(num(p.rabatt), 0), 100);
      return s + brutto * (rabatt / 100);
    }, 0),
  );

  const gesamtRabattPercent = Math.min(
    Math.max(num(input.gesamtRabattPercent), 0),
    100,
  );
  const gesamtRabattBetrag = round2(
    zwischensumme * (gesamtRabattPercent / 100),
  );

  const sumZuschlag = round2(
    (input.zuschlaege ?? []).reduce((s, z) => s + num(z.betrag), 0),
  );

  const sumRabatt = round2(positionsRabatt + gesamtRabattBetrag);
  const sumNetto = round2(zwischensumme - gesamtRabattBetrag + sumZuschlag);

  const mwstPercent = Math.max(num(input.mwstPercent), 0);
  const mwstBetrag = round2(sumNetto * (mwstPercent / 100));
  const sumBrutto = round2(sumNetto + mwstBetrag);

  const deckungsbeitrag = round2(sumNetto - sumEk);
  const margePercent =
    sumNetto > 0 ? round2((deckungsbeitrag / sumNetto) * 100) : 0;

  const totals: CalcTotals = {
    zwischensumme,
    sumRabatt,
    sumZuschlag,
    sumNetto,
    mwstBetrag,
    sumBrutto,
    sumEk,
    deckungsbeitrag,
    margePercent,
  };

  return { positions, totals };
}
