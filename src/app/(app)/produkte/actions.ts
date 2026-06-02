"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { ensureConfigured, fail, OK, type ActionResult } from "@/lib/actions";

function s(fd: FormData, key: string): string | null {
  const v = fd.get(key);
  if (v === null) return null;
  const t = String(v).trim();
  return t === "" ? null : t;
}
function n(fd: FormData, key: string): number | null {
  const v = s(fd, key);
  if (v === null) return null;
  const x = Number(v.replace(",", "."));
  return Number.isFinite(x) ? x : null;
}
/** Auf 2 Nachkommastellen runden (null bleibt null). */
function round2(v: number | null): number | null {
  return v === null ? null : Math.round((v + Number.EPSILON) * 100) / 100;
}

export async function saveProduct(
  _prev: ActionResult,
  fd: FormData,
): Promise<ActionResult> {
  const guard = ensureConfigured();
  if (guard) return guard;

  const id = s(fd, "id");
  const name = s(fd, "name");
  if (!name) return fail("Bitte einen Produktnamen angeben.");

  const supabase = await createClient();

  // Hybrid-Aufteilung (Anteil PV %) in specs.split_pv_pct mergen, ohne andere
  // specs-Felder (z. B. aus dem Preislisten-Import) zu verlieren.
  const splitPvPct = n(fd, "split_pv_pct");
  let specs: Record<string, unknown> = {};
  if (id) {
    const { data: existing } = await supabase
      .from("products")
      .select("specs")
      .eq("id", id)
      .maybeSingle();
    if (existing?.specs && typeof existing.specs === "object") {
      specs = { ...(existing.specs as Record<string, unknown>) };
    }
  }
  if (splitPvPct === null) delete specs.split_pv_pct;
  else specs.split_pv_pct = Math.min(Math.max(splitPvPct, 0), 100);

  // Modulleistung (Wp) und Speicherkapazität (kWh je Einheit) für die
  // automatische kWp/kWh-Berechnung in der Kalkulation.
  const moduleWp = n(fd, "module_wp");
  if (moduleWp === null) delete specs.module_wp;
  else specs.module_wp = Math.max(moduleWp, 0);
  const storageKwh = n(fd, "storage_kwh");
  if (storageKwh === null) delete specs.storage_kwh;
  else specs.storage_kwh = Math.max(storageKwh, 0);

  const payload = {
    name,
    group_id: s(fd, "group_id"),
    manufacturer: s(fd, "manufacturer"),
    category: s(fd, "category"),
    sku: s(fd, "sku"),
    unit: s(fd, "unit"),
    price_purchase: round2(n(fd, "price_purchase")),
    price_sell: round2(n(fd, "price_sell")),
    specs,
  };

  let error;
  if (id) {
    ({ error } = await supabase.from("products").update(payload).eq("id", id));
  } else {
    // Neues Produkt ans Ende seiner Gruppe sortieren (max(sort)+1).
    const { data: last } = await supabase
      .from("products")
      .select("sort")
      .eq("group_id", payload.group_id ?? "")
      .order("sort", { ascending: false })
      .limit(1)
      .maybeSingle();
    const nextSort = (last?.sort ?? -1) + 1;
    ({ error } = await supabase
      .from("products")
      .insert({ ...payload, sort: nextSort }));
  }
  if (error) return fail(error.message);

  revalidatePath("/produkte");
  return OK;
}

/** Produkt-Reihenfolge/Gruppenzuordnung nach Drag & Drop speichern. */
export async function reorderProducts(
  updates: { id: string; group_id: string | null; sort: number }[],
): Promise<ActionResult> {
  const guard = ensureConfigured();
  if (guard) return guard;
  if (!Array.isArray(updates) || updates.length === 0) return OK;

  const supabase = await createClient();
  for (const u of updates) {
    if (!u.id) continue;
    const { error } = await supabase
      .from("products")
      .update({ group_id: u.group_id, sort: u.sort })
      .eq("id", u.id);
    if (error) return fail(error.message);
  }
  revalidatePath("/produkte");
  return OK;
}

/** Gruppen-Reihenfolge nach Drag & Drop speichern. */
export async function reorderGroups(
  updates: { id: string; sort: number }[],
): Promise<ActionResult> {
  const guard = ensureConfigured();
  if (guard) return guard;
  if (!Array.isArray(updates) || updates.length === 0) return OK;

  const supabase = await createClient();
  for (const u of updates) {
    if (!u.id) continue;
    const { error } = await supabase
      .from("product_groups")
      .update({ sort: u.sort })
      .eq("id", u.id);
    if (error) return fail(error.message);
  }
  revalidatePath("/produkte");
  return OK;
}

export async function deleteProduct(fd: FormData): Promise<void> {
  const id = String(fd.get("id") ?? "");
  if (!id || ensureConfigured()) return;
  const supabase = await createClient();
  await supabase.from("products").delete().eq("id", id);
  revalidatePath("/produkte");
}

export async function saveGroup(
  _prev: ActionResult,
  fd: FormData,
): Promise<ActionResult> {
  const guard = ensureConfigured();
  if (guard) return guard;
  const name = s(fd, "name");
  if (!name) return fail("Bitte einen Gruppennamen angeben.");
  const supabase = await createClient();
  const { error } = await supabase
    .from("product_groups")
    .insert({ name, sort: Number(s(fd, "sort") ?? "0") || 0 });
  if (error) return fail(error.message);
  revalidatePath("/produkte");
  return OK;
}

export async function deleteGroup(fd: FormData): Promise<void> {
  const id = String(fd.get("id") ?? "");
  if (!id || ensureConfigured()) return;
  const supabase = await createClient();
  await supabase.from("product_groups").delete().eq("id", id);
  revalidatePath("/produkte");
}

/** Metadaten eines hochgeladenen Assets in product_assets schreiben. */
export async function registerProductAsset(input: {
  productId: string;
  kind: "image" | "datasheet";
  name: string;
  storagePath: string;
  mime: string | null;
}): Promise<ActionResult> {
  const guard = ensureConfigured();
  if (guard) return guard;
  if (!input.productId || !input.storagePath) return fail("Ungültige Daten.");

  const supabase = await createClient();
  const { error } = await supabase.from("product_assets").insert({
    product_id: input.productId,
    kind: input.kind,
    name: input.name,
    storage_path: input.storagePath,
    mime: input.mime,
  });
  if (error) return fail(error.message);

  revalidatePath("/produkte");
  return OK;
}

export async function deleteProductAsset(fd: FormData): Promise<void> {
  const id = String(fd.get("id") ?? "");
  const path = String(fd.get("path") ?? "");
  if (!id || ensureConfigured()) return;
  const supabase = await createClient();
  if (path) {
    await supabase.storage.from("product-assets").remove([path]);
  }
  await supabase.from("product_assets").delete().eq("id", id);
  revalidatePath("/produkte");
}

/** Großhändler-Verknüpfung eines Produkts anlegen/aktualisieren. */
export async function saveProductWholesaler(
  _prev: ActionResult,
  fd: FormData,
): Promise<ActionResult> {
  const guard = ensureConfigured();
  if (guard) return guard;

  const productId = s(fd, "product_id");
  const wholesalerId = s(fd, "wholesaler_id");
  if (!productId || !wholesalerId) return fail("Produkt und Großhändler wählen.");

  const payload = {
    product_id: productId,
    wholesaler_id: wholesalerId,
    order_number: s(fd, "order_number"),
    price_purchase: round2(n(fd, "price_purchase")),
  };

  const supabase = await createClient();
  const id = s(fd, "id");
  const { error } = id
    ? await supabase.from("product_wholesalers").update(payload).eq("id", id)
    : await supabase.from("product_wholesalers").insert(payload);
  if (error) return fail(error.message);

  revalidatePath("/produkte");
  return OK;
}

export async function deleteProductWholesaler(fd: FormData): Promise<void> {
  const id = String(fd.get("id") ?? "");
  if (!id || ensureConfigured()) return;
  const supabase = await createClient();
  await supabase.from("product_wholesalers").delete().eq("id", id);
  revalidatePath("/produkte");
}

export interface CsvProductRow {
  name?: string;
  hersteller?: string;
  kategorie?: string;
  artikelnr?: string;
  einheit?: string;
  ek?: string;
  vk?: string;
  gruppe?: string;
}

export interface ImportResult extends ActionResult {
  imported?: number;
  skipped?: number;
}

function toNum(v: string | undefined): number | null {
  if (!v) return null;
  const x = Number(String(v).replace(/\./g, "").replace(",", "."));
  return Number.isFinite(x) ? x : null;
}

/** Produkte aus geparsten CSV-Zeilen importieren (Batch). Gruppen per Name auflösen/anlegen. */
export async function importProducts(
  rows: CsvProductRow[],
): Promise<ImportResult> {
  const guard = ensureConfigured();
  if (guard) return guard;
  if (!Array.isArray(rows) || rows.length === 0) {
    return fail("Keine Zeilen zum Importieren.");
  }

  const supabase = await createClient();

  // Bestehende Gruppen laden (Name → id)
  const { data: groups } = await supabase
    .from("product_groups")
    .select("id, name");
  const groupMap = new Map<string, string>(
    (groups ?? []).map((g) => [g.name.toLowerCase(), g.id]),
  );

  async function ensureGroup(name: string | undefined): Promise<string | null> {
    const n = (name ?? "").trim();
    if (!n) return null;
    const existing = groupMap.get(n.toLowerCase());
    if (existing) return existing;
    const { data, error } = await supabase
      .from("product_groups")
      .insert({ name: n })
      .select("id")
      .single();
    if (error || !data) return null;
    groupMap.set(n.toLowerCase(), data.id);
    return data.id;
  }

  let imported = 0;
  let skipped = 0;
  for (const r of rows) {
    const name = (r.name ?? "").trim();
    if (!name) {
      skipped++;
      continue;
    }
    const group_id = await ensureGroup(r.gruppe);
    const { error } = await supabase.from("products").insert({
      name,
      manufacturer: r.hersteller?.trim() || null,
      category: r.kategorie?.trim() || null,
      sku: r.artikelnr?.trim() || null,
      unit: r.einheit?.trim() || null,
      price_purchase: round2(toNum(r.ek)),
      price_sell: round2(toNum(r.vk)),
      group_id,
    });
    if (error) skipped++;
    else imported++;
  }

  revalidatePath("/produkte");
  return { ok: true, imported, skipped };
}
