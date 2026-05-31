/**
 * Tests für die Kalkulations-Engine.
 * Ausführen: npx tsx src/lib/calc/engine.test.ts
 * (Bewusst ohne Test-Framework gehalten — reine Assertions.)
 */
import assert from "node:assert/strict";

import { calculate, round2 } from "./engine";

// 1) Positionsrabatt + Gesamtrabatt + Zuschlag + Nullsteuersatz (PV)
{
  const r = calculate({
    positions: [
      { id: "1", bezeichnung: "PV-Modul", menge: 20, ek: 100, einzelpreis: 150, rabatt: 0 },
      { id: "2", bezeichnung: "Wechselrichter", menge: 1, ek: 1200, einzelpreis: 2000, rabatt: 10 },
    ],
    mwstPercent: 0,
    gesamtRabattPercent: 5,
    zuschlaege: [{ bezeichnung: "Anfahrt", betrag: 150 }],
  });
  const t = r.totals;
  assert.equal(t.zwischensumme, 4800);
  assert.equal(t.sumZuschlag, 150);
  assert.equal(t.sumNetto, 4710);
  assert.equal(t.sumBrutto, 4710); // 0% MwSt
  assert.equal(t.sumEk, 3200);
  assert.equal(t.deckungsbeitrag, 1510);
  assert.equal(round2(t.margePercent), 32.06);
}

// 2) 19% MwSt
{
  const r = calculate({
    positions: [{ id: "1", bezeichnung: "X", menge: 1, einzelpreis: 1000, ek: 0, rabatt: 0 }],
    mwstPercent: 19,
  });
  assert.equal(r.totals.mwstBetrag, 190);
  assert.equal(r.totals.sumBrutto, 1190);
}

// 3) Leere Kalkulation
{
  const r = calculate({ positions: [], mwstPercent: 19 });
  assert.equal(r.totals.sumNetto, 0);
  assert.equal(r.totals.sumBrutto, 0);
  assert.equal(r.totals.margePercent, 0);
}

console.log("✓ engine.test.ts: alle Assertions bestanden");
