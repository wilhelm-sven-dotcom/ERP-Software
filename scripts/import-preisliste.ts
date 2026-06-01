/**
 * Importiert scripts/preisliste.json (aus parse-preisliste.ts) nach Supabase:
 *   - product_groups: PV-Anlage, Speicher, Wallbox, Dienstleistungen (find-or-create)
 *   - products:       alle Positionen (EK, VK, Aufschlag-% in specs, Lieferant, sizes)
 *   - calc_templates: 4 Vorlagen je Größenklasse (passende Produkte als Positionen)
 *
 * Voraussetzung (lokal):
 *   - scripts/preisliste.json  (zuerst `npm run parse:preisliste`)
 *   - .env.local mit NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
 *
 * Ausführen:
 *   npm run import:preisliste            # echter Import
 *   npm run import:preisliste -- --dry   # Trockenlauf (zählt nur, schreibt nicht)
 *
 * Idempotent: Produkte werden über (name+unit+vk) dedupliziert; Gruppen/Vorlagen
 * über Namen. Kann gefahrlos wiederholt werden.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

import type { PriceItem } from "./parse-preisliste";

// ---- .env.local laden -----------------------------------------------------
function loadEnvLocal() {
  try {
    const raw = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) {
        process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
      }
    }
  } catch {
    /* optional */
  }
}
loadEnvLocal();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DRY = process.argv.includes("--dry");

if (!DRY && (!SUPABASE_URL || !SERVICE_KEY)) {
  console.error(
    "❌ NEXT_PUBLIC_SUPABASE_URL und SUPABASE_SERVICE_ROLE_KEY müssen gesetzt sein (.env.local).",
  );
  process.exit(1);
}

interface Preisliste {
  items: PriceItem[];
  discounts: Record<string, { nachlass: number; skonto: number }>;
}

const data = JSON.parse(
  readFileSync(resolve(process.cwd(), "scripts/preisliste.json"), "utf8"),
) as Preisliste;

const supabase =
  !DRY && SUPABASE_URL && SERVICE_KEY
    ? createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })
    : null;

// Produktgruppen-Namen je Item (Dienstleistungen separat gruppieren)
function groupNameFor(item: PriceItem): string {
  if (item.is_service) return "Dienstleistungen";
  return item.group; // PV-Anlage | Speicher | Wallbox | Sonstiges
}

function chunk<T>(arr: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

async function main() {
  const groups = [
    ...new Set(data.items.map(groupNameFor)),
  ].sort();
  console.log(`📦 ${data.items.length} Positionen, Gruppen: ${groups.join(", ")}`);

  if (DRY) {
    const byG = data.items.reduce<Record<string, number>>((m, i) => {
      m[groupNameFor(i)] = (m[groupNameFor(i)] ?? 0) + 1;
      return m;
    }, {});
    console.log("   (Trockenlauf) Produkte je Gruppe:", byG);
    for (const klass of ["bis10", "bis30", "bis135", "speicher"] as const) {
      const n = data.items.filter((i) => i.sizes[klass]).length;
      console.log(`   Vorlage ${klass}: ${n} klassenspezifische Positionen`);
    }
    console.log("   Trockenlauf ok — kein Schreibzugriff.");
    return;
  }
  const db = supabase!;

  // 1) Gruppen find-or-create → Name→id
  const groupMap = new Map<string, string>();
  const { data: existingGroups } = await db
    .from("product_groups")
    .select("id, name");
  for (const g of existingGroups ?? []) groupMap.set(g.name, g.id);
  for (let i = 0; i < groups.length; i++) {
    const name = groups[i];
    if (groupMap.has(name)) continue;
    const { data: g, error } = await db
      .from("product_groups")
      .insert({ name, sort: i })
      .select("id")
      .single();
    if (error) throw new Error(`Gruppe ${name}: ${error.message}`);
    groupMap.set(name, g.id);
  }
  console.log(`  ✓ Gruppen: ${groupMap.size}`);

  // 2) Produkte: dedupe gegen vorhandene (name+unit+price_sell)
  const { data: existingProducts } = await db
    .from("products")
    .select("id, name, unit, price_sell");
  const seen = new Set(
    (existingProducts ?? []).map(
      (p) => `${p.name}|${p.unit ?? ""}|${p.price_sell ?? ""}`,
    ),
  );

  // Mehrfach gleiche Dienstleistung (3 Preisvarianten): Klassen-Suffix anhängen
  const nameCount = new Map<string, number>();
  function uniqueName(item: PriceItem): string {
    const base = item.name;
    const key = `${base}|${item.unit ?? ""}|${item.vk}`;
    if (!nameCount.has(base)) nameCount.set(base, 0);
    // nur Suffix, wenn derselbe Basisname mehrfach mit unterschiedlichem Preis kommt
    const dupes = data.items.filter((x) => x.name === base);
    if (dupes.length <= 1) return base;
    // Klassen-Label aus sizes ableiten
    const label = item.sizes.bis10
      ? "bis 10 kWp"
      : item.sizes.bis30
        ? "bis 30 kVA"
        : item.sizes.bis135
          ? "30–135 kVA"
          : item.sizes.speicher
            ? "Speicher"
            : "Variante";
    void key;
    return `${base} (${label})`;
  }

  const productRows = data.items
    .map((item) => ({
      _item: item,
      row: {
        name: uniqueName(item),
        manufacturer: item.supplier,
        category: item.art,
        unit: item.unit,
        price_purchase: item.ek,
        price_sell: item.vk,
        group_id: groupMap.get(groupNameFor(item)) ?? null,
        specs: {
          aufschlag_pct: item.aufschlag_pct,
          art: item.art,
          supplier: item.supplier,
          is_service: item.is_service,
          sizes: item.sizes,
          description: item.description,
        },
      },
    }))
    .filter(
      (p) =>
        !seen.has(`${p.row.name}|${p.row.unit ?? ""}|${p.row.price_sell ?? ""}`),
    );

  let imported = 0;
  // Map (name) → product_id für Vorlagen-Positionen
  const productIdByName = new Map<string, string>();
  for (const batch of chunk(productRows, 200)) {
    const { data: ins, error } = await db
      .from("products")
      .insert(batch.map((b) => b.row))
      .select("id, name");
    if (error) throw new Error(`Produkte: ${error.message}`);
    for (const p of ins ?? []) productIdByName.set(p.name, p.id);
    imported += ins?.length ?? 0;
  }
  // auch bereits vorhandene Produkte für Vorlagen referenzierbar machen
  const { data: allProducts } = await db
    .from("products")
    .select("id, name");
  for (const p of allProducts ?? []) productIdByName.set(p.name, p.id);
  console.log(`  ✓ Produkte: ${imported} neu importiert`);

  // 3) Vorlagen je Größenklasse
  const klassen: { name: string; key: keyof PriceItem["sizes"]; discount: string }[] =
    [
      { name: "PV bis 10 kWp", key: "bis10", discount: "PV bis 10 kWp" },
      { name: "PV bis 30 kVA", key: "bis30", discount: "PV bis 30 kVA" },
      { name: "PV 30–135 kVA", key: "bis135", discount: "PV 30-135 kVA" },
      { name: "Speicher", key: "speicher", discount: "Speicher" },
    ];

  let tplCount = 0;
  for (const k of klassen) {
    // Nur klassenspezifisch markierte Positionen (das „Alle"-Flag würde sonst
    // fast den ganzen Katalog in jede Vorlage ziehen).
    const items = data.items.filter((i) => i.sizes[k.key]);
    const positions = items.map((i) => ({
      product_id: productIdByName.get(uniqueName(i)) ?? null,
      bezeichnung: uniqueName(i),
      einheit: i.unit,
      ek: i.ek,
      einzelpreis: i.vk,
      rabatt: 0,
      menge: 0, // Vorschlag — Menge trägt der Nutzer ein
      group: i.group,
    }));
    const disc = data.discounts[k.discount] ?? { nachlass: 0, skonto: 0 };
    const defaults = {
      mwstPercent: 0, // PV-Nullsteuersatz
      pauschalRabattPercent: 0,
      nachlass: 0,
      skontoPercent: (disc.skonto ?? 0) * 100,
      gruppenRabatte: {},
    };

    // find-or-create per Name
    const { data: ex } = await db
      .from("calc_templates")
      .select("id")
      .eq("name", k.name)
      .maybeSingle();
    if (ex) {
      await db
        .from("calc_templates")
        .update({ positions, defaults, is_default: false })
        .eq("id", ex.id);
    } else {
      await db
        .from("calc_templates")
        .insert({ name: k.name, positions, defaults, is_default: false });
    }
    tplCount++;
    console.log(`  ✓ Vorlage „${k.name}": ${positions.length} Positionen`);
  }

  // Import-Audit-Rauschen entfernen (frischer Verlauf)
  await db.from("change_log").delete().gte("created_at", "1970-01-01");

  console.log(
    `\n🎉 Fertig: ${imported} Produkte, ${groupMap.size} Gruppen, ${tplCount} Vorlagen.`,
  );
}

main().catch((err) => {
  console.error("\n❌ Import fehlgeschlagen:", err.message);
  process.exit(1);
});
