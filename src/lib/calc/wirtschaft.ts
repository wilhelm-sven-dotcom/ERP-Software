/**
 * Wirtschaftlichkeits-Engine — 1:1-Nachbau von Legacy `computeWirtschaft`
 * (legacy/ip3_PV_Tool_6_19.html, Funktion `computeWirtschaft` / `defaultWirtschaft`).
 *
 * Keine DB, kein React → rein und testbar.
 *
 * Legacy-Formeln (verbindlich):
 *   ertragJahr1            = kwp * ertragKwhProKwp
 *   eigenverbrauchProzent  = eigenverbrauchsAnteil (+25, max 80, wenn Speicher > 0)
 *   eigenverbrauchJahr1    = ertragJahr1 * eigenverbrauchProzent/100
 *   einspeisungJahr1       = ertragJahr1 - eigenverbrauchJahr1
 *   stromkostenErsparnis   = eigenverbrauch * strompreis
 *   einspeiseErloese       = einspeisung   * einspeiseverguetung
 *   Cashflow je Jahr y:    cf = eigen*kostenSatz + einsp*einspeiseverguetung
 *     danach: ertrag    *= (1 - degradation/100)
 *             kostenSatz*= (1 + strompreissteigerung/100)
 *   cumCF startet bei -investBrutto; Amortisation = erstes Jahr mit cumCF >= 0
 *   renditeProzent = ((summeErloese - invest)/invest*100) / laufzeit
 */

export interface WirtschaftParams {
  /** Spezifischer Jahresertrag in kWh/kWp (Legacy-Default 950). */
  ertragKwhProKwp: number;
  /** Eigenverbrauchsanteil in % (Legacy-Default 30). */
  eigenverbrauchsAnteil: number;
  /** Strompreis €/kWh (Legacy-Default 0.32). */
  strompreis: number;
  /** Einspeisevergütung €/kWh (Legacy-Default 0.0786). */
  einspeiseverguetung: number;
  /** Strompreissteigerung %/Jahr (Legacy-Default 3.0). */
  strompreissteigerung: number;
  /** Modul-Degradation %/Jahr (Legacy-Default 0.5). */
  degradation: number;
  /** Betrachtungszeitraum in Jahren (Legacy-Default 25). */
  laufzeit: number;
}

export const DEFAULT_WIRTSCHAFT: WirtschaftParams = {
  ertragKwhProKwp: 950,
  eigenverbrauchsAnteil: 30,
  strompreis: 0.32,
  einspeiseverguetung: 0.0786,
  strompreissteigerung: 3.0,
  degradation: 0.5,
  laufzeit: 25,
};

export interface WirtschaftRow {
  jahr: number;
  ertrag: number;
  eigenverbrauch: number;
  einspeisung: number;
  stromkostenErsparnis: number;
  einspeiseErloese: number;
  cashflow: number;
  kumuliert: number;
}

export interface WirtschaftResult {
  kwp: number;
  speicherKwh: number;
  investBrutto: number;
  ertragJahr1: number;
  eigenverbrauchJahr1: number;
  einspeisungJahr1: number;
  stromkostenErsparnisJahr1: number;
  einspeiseErloeseJahr1: number;
  ertragWirtschaftlichJahr1: number;
  eigenverbrauchProzent: number;
  summeErloese: number;
  renditeProzent: number;
  /** Amortisationsjahr (null, wenn innerhalb der Laufzeit nicht erreicht). */
  amortisationJahr: number | null;
  rows: WirtschaftRow[];
}

function num(v: number | null | undefined): number {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

export function computeWirtschaft(
  input: { kwp: number; speicherKwh: number; investBrutto: number },
  w: WirtschaftParams,
): WirtschaftResult {
  const kwp = num(input.kwp);
  const speicherKwh = num(input.speicherKwh);
  const investBrutto = num(input.investBrutto);
  const ertragJahr1 = kwp * num(w.ertragKwhProKwp);

  // Speicher erhöht Eigenverbrauchsquote grob heuristisch (Legacy).
  let eigenverbrauchProzent = num(w.eigenverbrauchsAnteil) || 30;
  if (speicherKwh > 0)
    eigenverbrauchProzent = Math.min(80, eigenverbrauchProzent + 25);

  const eigenverbrauchJahr1 = ertragJahr1 * (eigenverbrauchProzent / 100);
  const einspeisungJahr1 = ertragJahr1 - eigenverbrauchJahr1;
  const stromkostenErsparnisJahr1 = eigenverbrauchJahr1 * num(w.strompreis);
  const einspeiseErloeseJahr1 = einspeisungJahr1 * num(w.einspeiseverguetung);
  const ertragWirtschaftlichJahr1 =
    stromkostenErsparnisJahr1 + einspeiseErloeseJahr1;

  const rows: WirtschaftRow[] = [];
  let cumCF = -investBrutto;
  let ertrag = ertragJahr1;
  let kostenSatz = num(w.strompreis);
  let amortisationJahr: number | null = null;
  const laufzeit = Math.trunc(num(w.laufzeit)) || 25;

  for (let y = 1; y <= laufzeit; y++) {
    const eigen = ertrag * (eigenverbrauchProzent / 100);
    const einsp = ertrag - eigen;
    const erspn = eigen * kostenSatz;
    const eEr = einsp * num(w.einspeiseverguetung);
    const cf = erspn + eEr;
    cumCF += cf;
    rows.push({
      jahr: y,
      ertrag,
      eigenverbrauch: eigen,
      einspeisung: einsp,
      stromkostenErsparnis: erspn,
      einspeiseErloese: eEr,
      cashflow: cf,
      kumuliert: cumCF,
    });
    if (amortisationJahr === null && cumCF >= 0) amortisationJahr = y;
    ertrag = ertrag * (1 - num(w.degradation) / 100);
    kostenSatz = kostenSatz * (1 + num(w.strompreissteigerung) / 100);
  }

  const summeErloese = rows.reduce((s, r) => s + r.cashflow, 0);
  const renditeProzent =
    investBrutto > 0
      ? (((summeErloese - investBrutto) / investBrutto) * 100) / laufzeit
      : 0;

  return {
    kwp,
    speicherKwh,
    investBrutto,
    ertragJahr1,
    eigenverbrauchJahr1,
    einspeisungJahr1,
    stromkostenErsparnisJahr1,
    einspeiseErloeseJahr1,
    ertragWirtschaftlichJahr1,
    eigenverbrauchProzent,
    summeErloese,
    renditeProzent,
    amortisationJahr,
    rows,
  };
}
