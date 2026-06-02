/**
 * Liest die ip³-Preisliste (Excel .xlsm) und erzeugt scripts/preisliste.json
 * mit normalisierten Produkten/Dienstleistungen + Größenklassen-Flags.
 *
 * Ausführen:  npm run parse:preisliste            (Standard: scripts/ip_Preisliste.xlsm)
 *             npm run parse:preisliste -- pfad.xlsm
 *
 * Die Excel und die erzeugte JSON enthalten Geschäftsdaten (EK/Margen) und sind
 * per .gitignore vom Repo ausgeschlossen.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import * as XLSX from "xlsx";

const SRC = resolve(
  process.cwd(),
  process.argv.find((a, i) => i >= 2 && !a.startsWith("--")) ??
    "scripts/ip_Preisliste.xlsm",
);
const OUT = resolve(process.cwd(), "scripts/preisliste.json");

// ─── Spalten im Blatt „Produkte" (0-basiert) ────────────────────────────────
// C=Name(2) D=Beschr(3) E=Alle(4) F=bis10(5) G=bis30(6) H=30-135(7) I=Speicher(8)
// K=EK(10) N=Aufschlag%(13) P=VK(15) Q=Einheit(16) R=Gruppe(17) S=Art(18) T=Lief(19)
const COL = {
  name: 2,
  desc: 3,
  alle: 4,
  bis10: 5,
  bis30: 6,
  bis135: 7,
  speicher: 8,
  ek: 10,
  aufschlag: 13,
  vk: 15,
  unit: 16,
  group: 17,
  art: 18,
  supplier: 19,
} as const;

type Row = (string | number | null | undefined)[];

function str(v: unknown): string | null {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}
function numOrNull(v: unknown): number | null {
  if (v === undefined || v === null || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}
function flag(v: unknown): boolean {
  return str(v)?.toLowerCase() === "x";
}

/** Gruppe (PV/Speicher/Wallbox) → App-Hauptgruppe. */
function mapGroup(g: string | null): "PV-Anlage" | "Speicher" | "Wallbox" | "Sonstiges" {
  const s = (g ?? "").toLowerCase();
  if (s.startsWith("pv")) return "PV-Anlage";
  if (s.startsWith("speicher")) return "Speicher";
  if (s.startsWith("wallbox")) return "Wallbox";
  return "Sonstiges";
}

/** Dienstleistungs-Arten (keine Hardware). */
const SERVICE_ARTS = new Set([
  "Plan-IDL",
  "Plan-EDL",
  "PL",
  "M-AC",
  "M-UK",
  "M-Hilf",
  "HW-AC",
  "VT",
  "Fahrt",
]);

export interface PriceItem {
  name: string;
  description: string | null;
  ek: number | null;
  vk: number;
  aufschlag_pct: number | null;
  unit: string | null;
  group: "PV-Anlage" | "Speicher" | "Wallbox" | "Sonstiges";
  art: string | null;
  supplier: string | null;
  is_service: boolean;
  /**
   * Hybrid-Aufteilung: Anteil PV in % (Rest = Speicher). null = normaler Artikel.
   * Wird beim Zusammenführen doppelt gepflegter Hybrid-Wechselrichter gesetzt.
   */
  split_pv_pct: number | null;
  sizes: {
    alle: boolean;
    bis10: boolean;
    bis30: boolean;
    bis135: boolean;
    speicher: boolean;
  };
}

/** Name für Hybrid-Erkennung normalisieren (Whitespace/Case). */
function normName(name: string): string {
  return name.toLowerCase().replace(/\s+/g, " ").trim();
}

/**
 * Führt doppelt gepflegte Hybrid-Wechselrichter zusammen: derselbe (normalisierte)
 * Name kommt **genau einmal in PV-Anlage** und **genau einmal in Speicher** vor.
 * Ergebnis: EIN Artikel (Gruppe PV-Anlage), Preise summiert, split_pv_pct aus dem
 * Preisverhältnis abgeleitet. Nur bei eindeutigem 1:1-Match — sonst unverändert.
 * Gibt [zusammengeführte Liste, Anzahl Merges] zurück.
 */
function mergeHybrids(items: PriceItem[]): [PriceItem[], number] {
  const byName = new Map<string, PriceItem[]>();
  for (const it of items) {
    const key = normName(it.name);
    (byName.get(key) ?? byName.set(key, []).get(key)!).push(it);
  }

  const merged: PriceItem[] = [];
  const consumed = new Set<PriceItem>();
  let mergeCount = 0;

  for (const it of items) {
    if (consumed.has(it)) continue;
    const group = byName.get(normName(it.name)) ?? [];
    const pv = group.filter((g) => g.group === "PV-Anlage");
    const sp = group.filter((g) => g.group === "Speicher");
    // Eindeutiges Hybrid-Paar: je genau eine PV- und eine Speicher-Zeile.
    if (group.length === 2 && pv.length === 1 && sp.length === 1) {
      const pvItem = pv[0];
      const spItem = sp[0];
      const vkSum = pvItem.vk + spItem.vk;
      const splitPv = vkSum > 0 ? Math.round((pvItem.vk / vkSum) * 100) : 50;
      merged.push({
        ...pvItem,
        vk: round2(vkSum),
        ek: pvItem.ek !== null || spItem.ek !== null
          ? round2((pvItem.ek ?? 0) + (spItem.ek ?? 0))
          : null,
        group: "PV-Anlage",
        split_pv_pct: splitPv,
        sizes: {
          alle: pvItem.sizes.alle || spItem.sizes.alle,
          bis10: pvItem.sizes.bis10 || spItem.sizes.bis10,
          bis30: pvItem.sizes.bis30 || spItem.sizes.bis30,
          bis135: pvItem.sizes.bis135 || spItem.sizes.bis135,
          speicher: pvItem.sizes.speicher || spItem.sizes.speicher,
        },
      });
      consumed.add(pvItem);
      consumed.add(spItem);
      mergeCount += 1;
    } else {
      merged.push(it);
      consumed.add(it);
    }
  }
  return [merged, mergeCount];
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function main() {
  const wb = XLSX.read(readFileSync(SRC), { type: "buffer" });
  const ws = wb.Sheets["Produkte"];
  if (!ws) throw new Error("Blatt 'Produkte' nicht gefunden.");
  const rows = XLSX.utils.sheet_to_json<Row>(ws, { header: 1, blankrows: false });

  const items: PriceItem[] = [];
  for (const r of rows) {
    const name = str(r[COL.name]);
    const vkRaw = numOrNull(r[COL.vk]);
    const group = str(r[COL.group]);
    const art = str(r[COL.art]);
    // Echte Position: Name + VK + (Gruppe oder Art)
    if (!name || vkRaw === null || (!group && !art)) continue;
    // Preise auf 2 Nachkommastellen runden (geteilte Dienstleistungen ergeben
    // sonst Werte wie 13,3333…).
    const vk = round2(vkRaw);
    const ekRaw = numOrNull(r[COL.ek]);
    // Spec-Zeilen (Phasen/MPP-Tracker…) haben keine Gruppe/Art → oben gefiltert
    items.push({
      name,
      description: str(r[COL.desc]),
      ek: ekRaw === null ? null : round2(ekRaw),
      vk,
      aufschlag_pct: numOrNull(r[COL.aufschlag]),
      unit: str(r[COL.unit]),
      group: mapGroup(group),
      art,
      supplier: str(r[COL.supplier]),
      is_service: art ? SERVICE_ARTS.has(art) : false,
      split_pv_pct: null,
      sizes: {
        alle: flag(r[COL.alle]),
        bis10: flag(r[COL.bis10]),
        bis30: flag(r[COL.bis30]),
        bis135: flag(r[COL.bis135]),
        speicher: flag(r[COL.speicher]),
      },
    });
  }

  // Nachlass/Skonto je Größenklasse aus „Basisdaten"
  const basis = wb.Sheets["Basisdaten"];
  const discounts: Record<string, { nachlass: number; skonto: number }> = {};
  if (basis) {
    const brows = XLSX.utils.sheet_to_json<Row>(basis, { header: 1, blankrows: false });
    for (const r of brows) {
      const label = str(r[1]); // B
      const nachlass = numOrNull(r[2]); // C
      const skonto = numOrNull(r[3]); // D
      if (label && (nachlass !== null || skonto !== null)) {
        discounts[label] = { nachlass: nachlass ?? 0, skonto: skonto ?? 0 };
      }
    }
  }

  // Doppelt gepflegte Hybrid-Wechselrichter zu einem Artikel zusammenführen.
  const [mergedItems, hybridCount] = mergeHybrids(items);

  const out = {
    items: mergedItems,
    discounts,
    generated_at: new Date().toISOString(),
  };
  writeFileSync(OUT, JSON.stringify(out, null, 2), "utf8");

  // Kurzbericht
  const byGroup = mergedItems.reduce<Record<string, number>>((m, i) => {
    m[i.group] = (m[i.group] ?? 0) + 1;
    return m;
  }, {});
  const services = mergedItems.filter((i) => i.is_service).length;
  console.log(`✅ ${mergedItems.length} Positionen → ${OUT}`);
  console.log("   Gruppen:", byGroup);
  console.log(`   davon Dienstleistungen: ${services}`);
  console.log(`   Hybrid-Artikel zusammengeführt: ${hybridCount}`);
  console.log("   Nachlass/Skonto:", discounts);
}

main();
