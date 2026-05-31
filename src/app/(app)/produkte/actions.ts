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

export async function saveProduct(
  _prev: ActionResult,
  fd: FormData,
): Promise<ActionResult> {
  const guard = ensureConfigured();
  if (guard) return guard;

  const id = s(fd, "id");
  const name = s(fd, "name");
  if (!name) return fail("Bitte einen Produktnamen angeben.");

  const payload = {
    name,
    group_id: s(fd, "group_id"),
    manufacturer: s(fd, "manufacturer"),
    category: s(fd, "category"),
    sku: s(fd, "sku"),
    unit: s(fd, "unit"),
    price_purchase: n(fd, "price_purchase"),
    price_sell: n(fd, "price_sell"),
  };

  const supabase = await createClient();
  const { error } = id
    ? await supabase.from("products").update(payload).eq("id", id)
    : await supabase.from("products").insert(payload);
  if (error) return fail(error.message);

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
