/**
 * Tests für die Wirtschaftlichkeits-Engine (Legacy `computeWirtschaft`).
 * Ausführen: npm run test:wirtschaft
 */
import assert from "node:assert/strict";

import {
  computeWirtschaft,
  DEFAULT_WIRTSCHAFT,
  type WirtschaftParams,
} from "./wirtschaft";

const round = (n: number, d = 2) => Math.round(n * 10 ** d) / 10 ** d;

// 1) Ohne Speicher: Jahr-1-Werte exakt nach Legacy-Formeln
{
  const r = computeWirtschaft(
    { kwp: 10, speicherKwh: 0, investBrutto: 15000 },
    DEFAULT_WIRTSCHAFT,
  );
  // ertragJahr1 = 10 * 950 = 9500
  assert.equal(r.ertragJahr1, 9500);
  assert.equal(r.eigenverbrauchProzent, 30);
  // eigen = 2850 ; einsp = 6650
  assert.equal(round(r.eigenverbrauchJahr1), 2850);
  assert.equal(round(r.einspeisungJahr1), 6650);
  // ersparnis = 2850*0.32 = 912 ; einspeise = 6650*0.0786 = 522.69
  assert.equal(round(r.stromkostenErsparnisJahr1), 912);
  assert.equal(round(r.einspeiseErloeseJahr1), 522.69);
  assert.equal(r.rows.length, 25);
}

// 2) Mit Speicher: Eigenverbrauchsquote +25 (max 80)
{
  const r = computeWirtschaft(
    { kwp: 10, speicherKwh: 10, investBrutto: 20000 },
    DEFAULT_WIRTSCHAFT,
  );
  assert.equal(r.eigenverbrauchProzent, 55); // 30 + 25
}

// 3) Deckelung bei 80 %
{
  const w: WirtschaftParams = { ...DEFAULT_WIRTSCHAFT, eigenverbrauchsAnteil: 60 };
  const r = computeWirtschaft({ kwp: 5, speicherKwh: 5, investBrutto: 1 }, w);
  assert.equal(r.eigenverbrauchProzent, 80); // 60+25=85 -> max 80
}

// 4) Amortisation & Rendite plausibel
{
  const r = computeWirtschaft(
    { kwp: 10, speicherKwh: 0, investBrutto: 15000 },
    DEFAULT_WIRTSCHAFT,
  );
  assert.ok(r.amortisationJahr !== null && r.amortisationJahr > 0);
  // kumuliert im letzten Jahr = summeErloese - invest
  assert.equal(
    round(r.rows[r.rows.length - 1].kumuliert),
    round(r.summeErloese - r.investBrutto),
  );
  // Rendite = ((summe-invest)/invest*100)/laufzeit
  assert.equal(
    round(r.renditeProzent),
    round(((r.summeErloese - 15000) / 15000) * 100 / 25),
  );
}

// 5) Invest 0 → Rendite 0 (Division vermieden)
{
  const r = computeWirtschaft(
    { kwp: 10, speicherKwh: 0, investBrutto: 0 },
    DEFAULT_WIRTSCHAFT,
  );
  assert.equal(r.renditeProzent, 0);
  assert.equal(r.amortisationJahr, 1); // cumCF startet bei 0 → sofort >= 0
}

console.log("✓ wirtschaft.test.ts: alle Assertions bestanden");
