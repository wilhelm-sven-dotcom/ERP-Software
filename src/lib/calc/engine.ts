/**
 * Reine Kalkulations-Engine — Nachbau von Legacy `calculateSum`
 * (legacy/ip3_PV_Tool_6_19.html, Z. 3344–3385). Keine DB, kein React.
 *
 * Verbindliche Reihenfolge (nicht kommutativ):
 *   1) vkSum         = menge * vk * (1 - rabatt/100)                je Position
 *   2) vkNachGroup   = vkSum * (1 - gruppenRabatt[group]/100)       je Gruppe
 *      nettoVorPauschal = Σ vkNachGroup
 *   3) netto         = nettoVorPauschal * (1 - pauschalRabatt/100)
 *   4) netto         = netto - nachlass
 *   5) mwstBetrag    = netto * mwstSatz/100 ; brutto = netto + mwstBetrag
 *   6) skontoBetrag  = brutto * skonto/100 ; bruttoNachSkonto = brutto - skontoBetrag
 *   7) marge         = netto - ekGesamt ; margeProzent = marge/netto*100
 *
 * MwSt: Standard 19 %, PV-Nullsteuersatz über mwstPercent = 0.
 * Rundung wie Legacy: intern volle Genauigkeit, Ausgabewerte auf 2 NK.
 */

import {
  POSITION_GROUPS,
  type CalcInput,
  type CalcPosition,
  type CalcPositionResult,
  type CalcResult,
  type CalcTotals,
  type PositionGroup,
} from "./types";

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function num(v: number | null | undefined): number {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

function clampPercent(v: number | null | undefined): number {
  return Math.min(Math.max(num(v), 0), 100);
}

function groupOf(p: CalcPosition): PositionGroup {
  return p.group ?? "Sonstiges";
}

/** Position netto (nach Positionsrabatt) + Einkaufswert. */
export function computePosition(p: CalcPosition): CalcPositionResult {
  const vkSum = num(p.menge) * num(p.einzelpreis) * (1 - clampPercent(p.rabatt) / 100);
  const positionEk = num(p.menge) * num(p.ek);
  return { ...p, positionNetto: round2(vkSum), positionEk: round2(positionEk) };
}

export function calculate(input: CalcInput): CalcResult {
  const gruppenRabatte = input.gruppenRabatte ?? {};

  // Schritt 1+2: Positions- und Gruppenrabatt, Summen je Gruppe
  const gruppenSummen: Record<PositionGroup, number> = {
    "PV-Anlage": 0,
    Speicher: 0,
    Wallbox: 0,
    Sonstiges: 0,
  };
  let ekGesamt = 0;

  for (const p of input.positions) {
    const vkSum =
      num(p.menge) * num(p.einzelpreis) * (1 - clampPercent(p.rabatt) / 100);

    if (p.splitPvPct !== null && p.splitPvPct !== undefined) {
      // Hybrid: Position anteilig auf PV-Anlage und Speicher verteilen. Jeder
      // Anteil bekommt den Gruppenrabatt SEINER Gruppe (konsistent zur Logik
      // unten). Die Position wird nur einmal gezählt (Summe = vkSum).
      const pvShare = clampPercent(p.splitPvPct) / 100;
      const pvRab = clampPercent(gruppenRabatte["PV-Anlage"]);
      const spRab = clampPercent(gruppenRabatte["Speicher"]);
      gruppenSummen["PV-Anlage"] += vkSum * pvShare * (1 - pvRab / 100);
      gruppenSummen["Speicher"] += vkSum * (1 - pvShare) * (1 - spRab / 100);
    } else {
      const group = groupOf(p);
      const grRab = clampPercent(gruppenRabatte[group]);
      gruppenSummen[group] += vkSum * (1 - grRab / 100);
    }
    ekGesamt += num(p.menge) * num(p.ek);
  }

  const nettoVorPauschal = POSITION_GROUPS.reduce(
    (s, g) => s + gruppenSummen[g],
    0,
  );

  // Schritt 3+4: Pauschalrabatt, Nachlass
  const pauschal = clampPercent(input.pauschalRabattPercent);
  const nachlass = num(input.nachlass);
  const netto = nettoVorPauschal * (1 - pauschal / 100) - nachlass;

  // Schritt 5: MwSt — je Gruppe (Pauschalrabatt & Nachlass anteilig auf die
  // Gruppen verteilt), damit § 12 Abs. 3 UStG (0 % PV+Speicher) korrekt greift.
  const rateOf = (g: PositionGroup) =>
    clampPercent(input.mwstPerGroup?.[g] ?? input.mwstPercent);
  const perRate = new Map<number, { netto: number; betrag: number }>();
  let mwstBetrag = 0;
  for (const g of POSITION_GROUPS) {
    const share = nettoVorPauschal !== 0 ? gruppenSummen[g] / nettoVorPauschal : 0;
    const groupNetto = gruppenSummen[g] * (1 - pauschal / 100) - nachlass * share;
    const rate = rateOf(g);
    const betrag = groupNetto * (rate / 100);
    mwstBetrag += betrag;
    const e = perRate.get(rate) ?? { netto: 0, betrag: 0 };
    e.netto += groupNetto;
    e.betrag += betrag;
    perRate.set(rate, e);
  }
  const mwstSaetze = [...perRate.entries()]
    .map(([rate, v]) => ({
      rate,
      netto: round2(v.netto),
      betrag: round2(v.betrag),
    }))
    .filter((r) => r.netto !== 0 || r.betrag !== 0)
    .sort((a, b) => b.rate - a.rate);
  // Einheitlicher Satz, wenn nur einer vorkommt; sonst gewichteter Effektivsatz.
  const mwstSatz =
    perRate.size === 1
      ? [...perRate.keys()][0]
      : netto > 0
        ? round2((mwstBetrag / netto) * 100)
        : 0;
  const brutto = netto + mwstBetrag;

  // Schritt 6: Skonto (auf brutto)
  const skonto = clampPercent(input.skontoPercent);
  const skontoBetrag = brutto * (skonto / 100);
  const bruttoNachSkonto = brutto - skontoBetrag;

  // Schritt 7: Marge
  const marge = netto - ekGesamt;
  const margeProzent = netto > 0 ? (marge / netto) * 100 : 0;

  // Spezifische Preise (netto-Basis = gruppenSummen, vor Pauschalrabatt).
  const kwp = num(input.systemSizeKwp);
  const kwh = num(input.storageKwh);
  const spezifischPvProKwp =
    kwp > 0 ? round2(gruppenSummen["PV-Anlage"] / kwp) : null;
  const spezifischSpeicherProKwh =
    kwh > 0 ? round2(gruppenSummen.Speicher / kwh) : null;

  const totals: CalcTotals = {
    nettoVorPauschal: round2(nettoVorPauschal),
    netto: round2(netto),
    mwstSatz,
    mwstBetrag: round2(mwstBetrag),
    mwstSaetze,
    brutto: round2(brutto),
    skontoBetrag: round2(skontoBetrag),
    bruttoNachSkonto: round2(bruttoNachSkonto),
    ekGesamt: round2(ekGesamt),
    marge: round2(marge),
    margeProzent: round2(margeProzent),
    gruppenSummen: {
      "PV-Anlage": round2(gruppenSummen["PV-Anlage"]),
      Speicher: round2(gruppenSummen.Speicher),
      Wallbox: round2(gruppenSummen.Wallbox),
      Sonstiges: round2(gruppenSummen.Sonstiges),
    },
    spezifischPvProKwp,
    spezifischSpeicherProKwh,
  };

  return { positions: input.positions.map(computePosition), totals };
}
