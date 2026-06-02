/**
 * Tests für die Kalkulations-Engine (Legacy `calculateSum`-Kaskade).
 * Ausführen: npm run test:calc
 */
import assert from "node:assert/strict";

import { calculate } from "./engine";
import { computeServicePrice, type ServicePricing } from "./service-pricing";

// 0) Dienstleistung marginal gestaffelt (0–10/10–30/30–135) + Sockel
{
  const p: ServicePricing = {
    mode: "tiered",
    base: 0,
    tiers: [
      { upToKwp: 10, perKwp: 150 },
      { upToKwp: 30, perKwp: 100 },
      { upToKwp: 135, perKwp: 60 },
      { upToKwp: null, perKwp: 0 },
    ],
  };
  assert.equal(computeServicePrice(p, 20), 2500); // 10*150 + 10*100
  assert.equal(computeServicePrice(p, 40), 4100); // 10*150 + 20*100 + 10*60
  assert.equal(computeServicePrice({ ...p, base: 500 }, 5), 1250); // 500 + 5*150
}

// 1) Positions- + Pauschalrabatt, PV-Nullsteuersatz
{
  const r = calculate({
    positions: [
      { id: "1", bezeichnung: "PV-Modul", menge: 20, ek: 100, einzelpreis: 150, rabatt: 0, group: "PV-Anlage" },
      { id: "2", bezeichnung: "Wechselrichter", menge: 1, ek: 1200, einzelpreis: 2000, rabatt: 10, group: "PV-Anlage" },
    ],
    pauschalRabattPercent: 5,
    mwstPercent: 0,
  });
  const t = r.totals;
  // vkSum: 3000 + 1800 = 4800 ; pauschal 5% -> 4560 ; mwst 0 -> brutto 4560
  assert.equal(t.nettoVorPauschal, 4800);
  assert.equal(t.netto, 4560);
  assert.equal(t.brutto, 4560);
  assert.equal(t.ekGesamt, 3200);
  assert.equal(t.marge, 1360);
  assert.equal(t.margeProzent, 29.82); // 1360/4560*100
}

// 2) 19 % MwSt + Skonto auf Brutto + Nachlass
{
  const r = calculate({
    positions: [{ id: "1", bezeichnung: "X", menge: 1, einzelpreis: 1000, ek: 0, rabatt: 0 }],
    nachlass: 100,
    mwstPercent: 19,
    skontoPercent: 2,
  });
  const t = r.totals;
  // netto = 1000 - 100 = 900 ; mwst 171 ; brutto 1071 ; skonto 2% = 21.42
  assert.equal(t.netto, 900);
  assert.equal(t.mwstBetrag, 171);
  assert.equal(t.brutto, 1071);
  assert.equal(t.skontoBetrag, 21.42);
  assert.equal(t.bruttoNachSkonto, 1049.58);
}

// 3) Gruppenrabatt nur auf eine Gruppe
{
  const r = calculate({
    positions: [
      { id: "1", bezeichnung: "Modul", menge: 1, einzelpreis: 1000, ek: 0, group: "PV-Anlage" },
      { id: "2", bezeichnung: "Speicher", menge: 1, einzelpreis: 1000, ek: 0, group: "Speicher" },
    ],
    gruppenRabatte: { Speicher: 10 },
    mwstPercent: 0,
  });
  const t = r.totals;
  assert.equal(t.gruppenSummen["PV-Anlage"], 1000);
  assert.equal(t.gruppenSummen.Speicher, 900);
  assert.equal(t.nettoVorPauschal, 1900);
  assert.equal(t.netto, 1900);
}

// 4) Leere Kalkulation
{
  const r = calculate({ positions: [], mwstPercent: 19 });
  assert.equal(r.totals.netto, 0);
  assert.equal(r.totals.brutto, 0);
  assert.equal(r.totals.margeProzent, 0);
}

// 5) Hybrid-Split: ein Artikel anteilig PV/Speicher + spezifische Preise
{
  const r = calculate({
    positions: [
      { id: "1", bezeichnung: "Hybrid-WR", menge: 1, einzelpreis: 1000, ek: 0, splitPvPct: 50 },
    ],
    mwstPercent: 0,
    systemSizeKwp: 10,
    storageKwh: 20,
  });
  const t = r.totals;
  // 50/50 auf die Töpfe, aber nur EINMAL gezählt
  assert.equal(t.gruppenSummen["PV-Anlage"], 500);
  assert.equal(t.gruppenSummen.Speicher, 500);
  assert.equal(t.netto, 1000); // kein Doppelzählen
  assert.equal(t.spezifischPvProKwp, 50); // 500 / 10 kWp
  assert.equal(t.spezifischSpeicherProKwh, 25); // 500 / 20 kWh
}

// 6) Hybrid-Split mit Gruppenrabatt nur auf Speicher
{
  const r = calculate({
    positions: [
      { id: "1", bezeichnung: "Hybrid-WR", menge: 1, einzelpreis: 1000, ek: 0, splitPvPct: 50 },
    ],
    gruppenRabatte: { Speicher: 10 },
    mwstPercent: 0,
  });
  const t = r.totals;
  assert.equal(t.gruppenSummen["PV-Anlage"], 500); // PV-Anteil unverändert
  assert.equal(t.gruppenSummen.Speicher, 450); // 500 - 10 %
  assert.equal(t.netto, 950);
  assert.equal(t.spezifischPvProKwp, null); // keine kWp hinterlegt
  assert.equal(t.spezifischSpeicherProKwh, null);
}

// 7) MwSt je Gruppe (§ 12 Abs. 3 UStG): PV+Speicher 0 %, Wallbox 19 %
{
  const r = calculate({
    positions: [
      { id: "1", bezeichnung: "PV", menge: 1, einzelpreis: 10000, ek: 0, group: "PV-Anlage" },
      { id: "2", bezeichnung: "Speicher", menge: 1, einzelpreis: 5000, ek: 0, group: "Speicher" },
      { id: "3", bezeichnung: "Wallbox", menge: 1, einzelpreis: 1000, ek: 0, group: "Wallbox" },
    ],
    mwstPercent: 19,
    mwstPerGroup: { "PV-Anlage": 0, Speicher: 0, Wallbox: 19, Sonstiges: 19 },
  });
  const t = r.totals;
  // netto 16000 ; MwSt nur auf Wallbox 1000 * 19% = 190
  assert.equal(t.netto, 16000);
  assert.equal(t.mwstBetrag, 190);
  assert.equal(t.brutto, 16190);
  // zwei Sätze ausgewiesen: 19% auf 1000, 0% auf 15000
  const r19 = t.mwstSaetze.find((x) => x.rate === 19);
  const r0 = t.mwstSaetze.find((x) => x.rate === 0);
  assert.equal(r19?.netto, 1000);
  assert.equal(r19?.betrag, 190);
  assert.equal(r0?.netto, 15000);
  assert.equal(r0?.betrag, 0);
}

// 8) Pauschalrabatt vor MwSt je Gruppe korrekt anteilig verteilt
{
  const r = calculate({
    positions: [
      { id: "1", bezeichnung: "PV", menge: 1, einzelpreis: 8000, ek: 0, group: "PV-Anlage" },
      { id: "2", bezeichnung: "Wallbox", menge: 1, einzelpreis: 2000, ek: 0, group: "Wallbox" },
    ],
    pauschalRabattPercent: 10,
    mwstPercent: 19,
    mwstPerGroup: { "PV-Anlage": 0, Wallbox: 19 },
  });
  const t = r.totals;
  // nettoVorPauschal 10000 ; -10% -> 9000 ; Wallbox-Anteil 2000*0.9=1800 -> MwSt 342
  assert.equal(t.netto, 9000);
  assert.equal(t.mwstBetrag, 342);
  assert.equal(t.brutto, 9342);
}

console.log("✓ engine.test.ts: alle Assertions bestanden");
