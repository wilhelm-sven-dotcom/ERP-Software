/**
 * Erzeugt aus scripts/preisliste.json eine fertige SQL-Datei
 * (supabase/seed_preisliste.sql), die im Supabase SQL Editor mit einem Klick
 * ausgeführt werden kann — ganz ohne lokalen Service-Role-Key / Terminal-Import.
 *
 * Ausführen:  npm run gen:preisliste-sql
 *
 * Idempotent: Gruppen/Produkte/Vorlagen werden per Namen abgeglichen
 * (delete-by-source + insert), kann gefahrlos wiederholt werden.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import type { PriceItem } from "./parse-preisliste";

interface Preisliste {
  items: PriceItem[];
  discounts: Record<string, { nachlass: number; skonto: number }>;
}

const data = JSON.parse(
  readFileSync(resolve(process.cwd(), "scripts/preisliste.json"), "utf8"),
) as Preisliste;

// ---- SQL-Helfer -----------------------------------------------------------
function q(v: string | null | undefined): string {
  if (v === null || v === undefined) return "null";
  return "'" + String(v).replace(/'/g, "''") + "'";
}
function num(v: number | null | undefined): string {
  return v === null || v === undefined || !Number.isFinite(v)
    ? "null"
    : String(v);
}
function jsonb(o: unknown): string {
  return "'" + JSON.stringify(o).replace(/'/g, "''") + "'::jsonb";
}

function groupNameFor(item: PriceItem): string {
  return item.is_service ? "Dienstleistungen" : item.group;
}

// Mehrfach gleiche Dienstleistung (3 Preisvarianten) → Klassen-Suffix
function uniqueName(item: PriceItem): string {
  const dupes = data.items.filter((x) => x.name === item.name);
  if (dupes.length <= 1) return item.name;
  const label = item.sizes.bis10
    ? "bis 10 kWp"
    : item.sizes.bis30
      ? "bis 30 kVA"
      : item.sizes.bis135
        ? "30–135 kVA"
        : item.sizes.speicher
          ? "Speicher"
          : "Variante";
  return `${item.name} (${label})`;
}

const groups = [...new Set(data.items.map(groupNameFor))].sort();

const lines: string[] = [];
lines.push("-- =====================================================================");
lines.push("-- ip³ PV-Tool — Preisliste (Produkte, Gruppen, Vorlagen)");
lines.push("-- Automatisch erzeugt aus der Excel-Preisliste.");
lines.push("-- Im Supabase SQL Editor EINMAL ausführen (idempotent, wiederholbar).");
lines.push("-- =====================================================================");
lines.push("");
lines.push("begin;");
lines.push("");

// 1) Vorhandene Import-Daten entfernen (nur die per Quelle markierten)
lines.push("-- Frühere Preislisten-Importe entfernen (an specs.source erkennbar)");
lines.push("delete from public.products where specs->>'source' = 'preisliste';");
lines.push("delete from public.calc_templates where name in ('PV bis 10 kWp','PV bis 30 kVA','PV 30–135 kVA','Speicher');");
lines.push("");

// 2) Gruppen (find-or-create per Name)
lines.push("-- Produktgruppen anlegen (falls noch nicht vorhanden)");
groups.forEach((g, i) => {
  lines.push(
    `insert into public.product_groups (name, sort) select ${q(g)}, ${i} ` +
      `where not exists (select 1 from public.product_groups where name = ${q(g)});`,
  );
});
lines.push("");

// 3) Produkte
lines.push("-- Produkte einfügen");
for (const item of data.items) {
  const name = uniqueName(item);
  const grp = groupNameFor(item);
  const specs = {
    aufschlag_pct: item.aufschlag_pct,
    art: item.art,
    supplier: item.supplier,
    is_service: item.is_service,
    sizes: item.sizes,
    description: item.description,
    source: "preisliste",
  };
  lines.push(
    `insert into public.products (name, manufacturer, category, unit, price_purchase, price_sell, group_id, specs) ` +
      `select ${q(name)}, ${q(item.supplier)}, ${q(item.art)}, ${q(item.unit)}, ${num(item.ek)}, ${num(item.vk)}, ` +
      `(select id from public.product_groups where name = ${q(grp)} limit 1), ${jsonb(specs)};`,
  );
}
lines.push("");

// 4) Vorlagen je Größenklasse
const klassen: {
  name: string;
  key: keyof PriceItem["sizes"];
  discount: string;
}[] = [
  { name: "PV bis 10 kWp", key: "bis10", discount: "PV bis 10 kWp" },
  { name: "PV bis 30 kVA", key: "bis30", discount: "PV bis 30 kVA" },
  { name: "PV 30–135 kVA", key: "bis135", discount: "PV 30-135 kVA" },
  { name: "Speicher", key: "speicher", discount: "Speicher" },
];

lines.push("-- Kalkulationsvorlagen je Größenklasse");
for (const k of klassen) {
  const items = data.items.filter((i) => i.sizes[k.key]);
  const positions = items.map((i) => ({
    product_id: null,
    bezeichnung: uniqueName(i),
    einheit: i.unit,
    ek: i.ek,
    einzelpreis: i.vk,
    rabatt: 0,
    menge: 0,
    group: i.group,
  }));
  const disc = data.discounts[k.discount] ?? { nachlass: 0, skonto: 0 };
  const defaults = {
    mwstPercent: 0,
    pauschalRabattPercent: 0,
    nachlass: 0,
    skontoPercent: (disc.skonto ?? 0) * 100,
    gruppenRabatte: {},
  };
  lines.push(
    `insert into public.calc_templates (name, positions, defaults, is_default) ` +
      `values (${q(k.name)}, ${jsonb(positions)}, ${jsonb(defaults)}, false);`,
  );
}
lines.push("");
lines.push("commit;");
lines.push("");

const out = resolve(process.cwd(), "supabase/seed_preisliste.sql");
writeFileSync(out, lines.join("\n"), "utf8");
console.log(`✅ ${out}`);
console.log(`   ${data.items.length} Produkte, ${groups.length} Gruppen, ${klassen.length} Vorlagen`);
console.log(`   Dateigröße: ${Math.round(lines.join("\n").length / 1024)} KB`);
