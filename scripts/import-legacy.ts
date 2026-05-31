/**
 * Import des alten IndexedDB-Backups (Backup-Modul → JSON) nach Supabase.
 *
 * Voraussetzung:
 *   - scripts/legacy-backup.json  (Export aus dem alten ip³ PV-Tool)
 *   - .env.local mit:
 *       NEXT_PUBLIC_SUPABASE_URL=...
 *       SUPABASE_SERVICE_ROLE_KEY=...   (NUR lokal/serverseitig, niemals committen!)
 *
 * Ausführen:
 *   npm run import:legacy            # nutzt scripts/legacy-backup.json
 *   npm run import:legacy -- pfad/zur/backup.json
 *
 * Der Service-Role-Key umgeht RLS. Beim Import entstehende Audit-Einträge
 * (change_log) werden am Ende wieder entfernt (--keep-audit zum Behalten).
 *
 * Hinweis: Binär-Assets (Datenblätter/Bilder) werden NICHT übertragen — nur
 * deren Metadaten. Die Dateien wandern später separat in Supabase Storage.
 *
 * ⚠ Feld-Mapping: Die Legacy-Feldnamen wurden aus dem minifizierten Code
 * abgeleitet (deutsch/englisch gemischt) und sind tolerant via pick(...).
 * Beim ersten echten Backup das tatsächliche JSON prüfen und die Mappings
 * bei Bedarf nachschärfen. Die Legacy-changeLog-Historie wird bewusst NICHT
 * importiert (der Audit-Verlauf startet frisch).
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// ---- .env.local laden (ohne externe Dependency) ---------------------------
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
    /* .env.local optional, wenn Variablen schon gesetzt sind */
  }
}
loadEnvLocal();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error(
    "❌ NEXT_PUBLIC_SUPABASE_URL und SUPABASE_SERVICE_ROLE_KEY müssen gesetzt sein (.env.local).",
  );
  process.exit(1);
}

const args = process.argv.slice(2);
const keepAudit = args.includes("--keep-audit");
const backupPath = resolve(
  process.cwd(),
  args.find((a) => !a.startsWith("--")) ?? "scripts/legacy-backup.json",
);

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

// ---- Mapping-Helfer -------------------------------------------------------
type Row = Record<string, unknown>;

/** Erster definierter, nicht-leerer Wert aus mehreren möglichen Schlüsseln. */
function pick(o: Row, ...keys: string[]): unknown {
  for (const k of keys) {
    const v = o[k];
    if (v !== undefined && v !== null && v !== "") return v;
  }
  return undefined;
}

function str(v: unknown): string | null {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

function num(v: unknown): number | null {
  if (v === undefined || v === null || v === "") return null;
  const n =
    typeof v === "number" ? v : Number(String(v).replace(",", ".").replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function int(v: unknown): number | null {
  const n = num(v);
  return n === null ? null : Math.round(n);
}

function bool(v: unknown, dflt = false): boolean {
  if (v === undefined || v === null) return dflt;
  if (typeof v === "boolean") return v;
  return ["true", "1", "ja", "yes"].includes(String(v).toLowerCase());
}

/** Legacy-Zeitstempel (created/createdAt …) → ISO-String, sonst undefined (DB-Default greift). */
function date(v: unknown): string | undefined {
  if (v === undefined || v === null || v === "") return undefined;
  const d = new Date(typeof v === "number" ? v : String(v));
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

function legacyId(o: Row): string | null {
  const v = pick(o, "id", "_id", "uuid", "key");
  return v === undefined ? null : String(v);
}

function jsonObj(v: unknown): Row {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Row) : {};
}

function jsonArr(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

// ---- Backup laden & Stores normalisieren ----------------------------------
function loadStores(): Record<string, Row[]> {
  const raw = JSON.parse(readFileSync(backupPath, "utf8"));
  const root: Row =
    raw?.stores ?? raw?.data ?? raw?.db ?? raw; // verschiedene Backup-Formate tolerieren
  const out: Record<string, Row[]> = {};
  for (const [k, v] of Object.entries(root)) {
    if (Array.isArray(v)) out[k] = v as Row[];
  }
  return out;
}

/** Fügt Zeilen ein und liefert eine Map legacy_id → neue uuid. */
async function insertAndMap(
  db: SupabaseClient,
  table: string,
  rows: Row[],
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  for (const batch of chunk(rows, 500)) {
    const { data, error } = await db
      .from(table)
      .insert(batch)
      .select("id, legacy_id");
    if (error) throw new Error(`[${table}] ${error.message}`);
    for (const r of data ?? []) {
      if (r.legacy_id) map.set(String(r.legacy_id), String(r.id));
    }
  }
  console.log(`  ✓ ${table}: ${rows.length} importiert`);
  return map;
}

// ---- Hauptablauf ----------------------------------------------------------
async function main() {
  console.log(`📦 Lese Backup: ${backupPath}`);
  const S = loadStores();
  const count = (k: string) => (S[k]?.length ?? 0);
  console.log(
    "   Stores:",
    Object.keys(S)
      .map((k) => `${k}(${count(k)})`)
      .join(", "),
  );

  // 1) Produktgruppen (parent_id im zweiten Durchlauf)
  const groupRows = (S.productGroups ?? []).map((o) => ({
    legacy_id: legacyId(o),
    name: str(pick(o, "name", "title", "titel")) ?? "Unbenannt",
    sort: int(pick(o, "sort", "sortOrder")) ?? 0,
  }));
  const groupMap = await insertAndMap(supabase, "product_groups", groupRows);
  // parent_id nachziehen
  for (const o of S.productGroups ?? []) {
    const lid = legacyId(o);
    const parent = str(pick(o, "parentId", "parent_id", "hauptgruppe"));
    if (lid && parent && groupMap.has(lid) && groupMap.has(parent)) {
      await supabase
        .from("product_groups")
        .update({ parent_id: groupMap.get(parent) })
        .eq("id", groupMap.get(lid));
    }
  }

  // 2) Mitarbeiter
  const employeeRows = (S.employees ?? []).map((o) => ({
    legacy_id: legacyId(o),
    name: str(pick(o, "name", "fullName")),
    email: str(pick(o, "email", "mail")),
    role:
      str(pick(o, "role", "rolle"))?.toLowerCase() === "admin"
        ? "admin"
        : "mitarbeiter",
    active: bool(pick(o, "active", "aktiv"), true),
  }));
  const employeeMap = await insertAndMap(supabase, "employees", employeeRows);
  const emp = (o: Row, ...keys: string[]) => {
    const lid = str(pick(o, ...keys));
    return lid ? (employeeMap.get(lid) ?? null) : null;
  };

  // 3) Kunden
  const customerRows = (S.customers ?? []).map((o) => ({
    legacy_id: legacyId(o),
    customer_nr: int(pick(o, "customerNr", "kundennr", "nummer", "nr")),
    kind: ((): string | null => {
      const k = str(pick(o, "kind", "typ", "art"))?.toLowerCase();
      if (!k) return null;
      if (k.startsWith("gew") || k.startsWith("firm") || k.startsWith("b2b"))
        return "gewerbe";
      if (k.startsWith("priv") || k.startsWith("b2c")) return "privat";
      return null;
    })(),
    company: str(pick(o, "company", "firma")),
    salutation: str(pick(o, "salutation", "anrede")),
    academic_title: str(pick(o, "academicTitle", "titel", "title")),
    first_name: str(pick(o, "firstName", "vorname")),
    last_name: str(pick(o, "lastName", "nachname", "name")),
    email: str(pick(o, "email", "mail")),
    phone: str(pick(o, "phone", "telefon", "tel")),
    mobile: str(pick(o, "mobile", "mobil", "handy")),
    street: str(pick(o, "street", "strasse", "straße")),
    zip: str(pick(o, "zip", "plz")),
    city: str(pick(o, "city", "ort")),
    notes: str(pick(o, "notes", "notiz", "bemerkung")),
    created_by: emp(o, "createdBy", "bearbeiterId", "mitarbeiterId"),
    created_at: date(pick(o, "created", "createdAt", "erstellt")),
  }));
  const customerMap = await insertAndMap(supabase, "customers", customerRows);

  // 4) Projekte
  const known = new Set([
    "id", "customerId", "kundeId", "customer", "title", "titel", "name",
    "status", "bearbeiterId", "mitarbeiterId", "assignedTo",
    "street", "strasse", "montageStrasse", "zip", "plz", "montagePlz",
    "city", "ort", "montageort",
    "kwp", "kWp", "systemSize", "pvKwp", "notes", "notiz",
    "createdBy", "created", "createdAt", "updated", "updatedAt",
  ]);
  const projectRows = (S.projects ?? []).map((o) => {
    const details: Row = {};
    for (const [k, v] of Object.entries(o)) {
      if (!known.has(k) && v !== null && v !== "") details[k] = v;
    }
    return {
      legacy_id: legacyId(o),
      customer_id: ((): string | null => {
        const lid = str(pick(o, "customerId", "kundeId", "customer"));
        return lid ? (customerMap.get(lid) ?? null) : null;
      })(),
      title: str(pick(o, "title", "titel", "name")),
      status: str(pick(o, "status")) ?? "Anfrage",
      assigned_employee_id: emp(o, "assignedTo", "bearbeiterId", "mitarbeiterId"),
      street: str(pick(o, "street", "strasse", "montageStrasse")),
      zip: str(pick(o, "zip", "plz", "montagePlz")),
      city: str(pick(o, "city", "ort", "montageort")),
      system_size_kwp: num(pick(o, "systemSize", "kwp", "pvKwp", "kWp")),
      notes: str(pick(o, "notes", "notiz")),
      details,
      created_by: emp(o, "createdBy", "bearbeiterId"),
      created_at: date(pick(o, "created", "createdAt")),
    };
  });
  const projectMap = await insertAndMap(supabase, "projects", projectRows);
  const proj = (o: Row, ...keys: string[]) => {
    const lid = str(pick(o, ...keys));
    return lid ? (projectMap.get(lid) ?? null) : null;
  };
  const cust = (o: Row, ...keys: string[]) => {
    const lid = str(pick(o, ...keys));
    return lid ? (customerMap.get(lid) ?? null) : null;
  };

  // 5) Aktivitäten
  const activityRows = (S.activities ?? []).map((o) => ({
    legacy_id: legacyId(o),
    project_id: proj(o, "projectId", "projektId"),
    customer_id: cust(o, "customerId", "kundeId"),
    type: str(pick(o, "type", "typ", "art")),
    title: str(pick(o, "title", "titel")),
    body: str(pick(o, "body", "text", "content", "inhalt", "beschreibung")),
    employee_id: emp(o, "employeeId", "bearbeiterId", "mitarbeiterId"),
    occurred_at: str(pick(o, "date", "datum", "occurredAt", "created", "createdAt")),
    created_at: date(pick(o, "created", "createdAt")),
  }));
  await insertAndMap(supabase, "activities", activityRows);

  // 6) Produkte (unbekannte Felder verlustfrei nach specs)
  const knownProduct = new Set([
    "id", "groupId", "gruppeId", "gruppe", "untergruppe", "hauptgruppe",
    "name", "bezeichnung", "title", "manufacturer", "hersteller",
    "category", "kategorie", "sku", "artikelnr", "artikelNr", "artnr",
    "pricePurchase", "ek", "ekPreis", "einkaufspreis",
    "priceSell", "vk", "vkPreis", "verkaufspreis", "preis",
    "unit", "einheit", "specs", "details", "technik",
    "created", "createdAt", "updated", "updatedAt",
  ]);
  const productRows = (S.products ?? []).map((o) => {
    const specs: Row = { ...jsonObj(pick(o, "specs", "details", "technik")) };
    for (const [k, v] of Object.entries(o)) {
      if (!knownProduct.has(k) && v !== null && v !== "") specs[k] = v;
    }
    return {
      legacy_id: legacyId(o),
      group_id: ((): string | null => {
        const lid = str(pick(o, "groupId", "gruppeId", "gruppe", "untergruppe", "hauptgruppe"));
        return lid ? (groupMap.get(lid) ?? null) : null;
      })(),
      name: str(pick(o, "name", "bezeichnung", "title")) ?? "Unbenannt",
      manufacturer: str(pick(o, "manufacturer", "hersteller")),
      category: str(pick(o, "category", "kategorie")),
      sku: str(pick(o, "sku", "artikelnr", "artikelNr", "artnr")),
      price_purchase: num(pick(o, "pricePurchase", "ek", "ekPreis", "einkaufspreis")),
      price_sell: num(pick(o, "priceSell", "vk", "vkPreis", "verkaufspreis", "preis")),
      unit: str(pick(o, "unit", "einheit")),
      specs,
      created_at: date(pick(o, "created", "createdAt")),
    };
  });
  const productMap = await insertAndMap(supabase, "products", productRows);

  // 7) Produkt-Assets (nur Metadaten)
  const assetRows = (S.productAssets ?? []).map((o) => ({
    legacy_id: legacyId(o),
    product_id: ((): string | null => {
      const lid = str(pick(o, "productId", "produktId"));
      return lid ? (productMap.get(lid) ?? null) : null;
    })(),
    kind: str(pick(o, "kind", "type", "typ")),
    name: str(pick(o, "name", "filename", "dateiname")),
    mime: str(pick(o, "mime", "mimeType", "contentType")),
    storage_path: null,
  }));
  if (assetRows.length) await insertAndMap(supabase, "product_assets", assetRows);

  // 8) Angebotsvorlagen
  const offerRows = (S.templates ?? []).map((o) => ({
    legacy_id: legacyId(o),
    name: str(pick(o, "name", "titel", "title")) ?? "Vorlage",
    kind: str(pick(o, "kind", "type", "typ")),
    is_default: bool(pick(o, "isDefault", "standard")),
    content: ((): Row => {
      const c = pick(o, "content", "inhalt", "html");
      return typeof c === "object" && c ? (c as Row) : { html: str(c) ?? "" };
    })(),
  }));
  if (offerRows.length) await insertAndMap(supabase, "offer_templates", offerRows);

  // 9) Kalkulationsvorlagen
  const calcTplRows = (S.calcTemplates ?? []).map((o) => ({
    legacy_id: legacyId(o),
    name: str(pick(o, "name", "titel")) ?? "Vorlage",
    is_default: bool(pick(o, "isDefault", "standard")),
    positions: jsonArr(pick(o, "positions", "positionen", "items")),
    defaults: jsonObj(pick(o, "defaults", "standardwerte")),
  }));
  if (calcTplRows.length)
    await insertAndMap(supabase, "calc_templates", calcTplRows);

  // 10) Kalkulationen
  const calcRows = (S.calc ?? []).map((o) => ({
    legacy_id: legacyId(o),
    project_id: proj(o, "projectId", "projektId"),
    positions: jsonArr(pick(o, "positions", "positionen", "items")),
    totals: jsonObj(pick(o, "totals", "summen", "sums")),
    margin: num(pick(o, "margin", "marge")),
  }));
  if (calcRows.length) await insertAndMap(supabase, "calculations", calcRows);

  // 11) Einstellungen (settings + ggf. kv)
  const settingsRecords = [...(S.settings ?? []), ...(S.kv ?? [])];
  const settingRows = settingsRecords.map((o) => ({
    key: String(pick(o, "key", "id") ?? ""),
    value: pick(o, "value", "val", "data") ?? o,
  }));
  if (settingRows.length) {
    const valid = settingRows.filter((r) => r.key);
    const { error } = await supabase
      .from("settings")
      .upsert(valid, { onConflict: "key" });
    if (error) throw new Error(`[settings] ${error.message}`);
    console.log(`  ✓ settings: ${valid.length} importiert`);
  }

  // Import-bedingte Audit-Einträge aufräumen (frischer Verlauf nach Import)
  if (!keepAudit) {
    const { error } = await supabase
      .from("change_log")
      .delete()
      .gte("created_at", "1970-01-01");
    if (error) console.warn(`  ⚠ change_log konnte nicht geleert werden: ${error.message}`);
    else console.log("  ✓ change_log (Import-Rauschen) geleert");
  }

  console.log("\n🎉 Import abgeschlossen.");
  console.log(
    "   Nächster Schritt: ersten Nutzer zum Admin machen:\n" +
      "   update public.employees set role='admin' where email='DEINE@MAIL';",
  );
}

main().catch((err) => {
  console.error("\n❌ Import fehlgeschlagen:", err.message);
  process.exit(1);
});
