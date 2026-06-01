import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import type { Product, ProductAsset, ProductGroup } from "@/lib/types";

export const PRODUCT_ASSETS_BUCKET = "product-assets";

export async function getProductAssets(
  productId: string,
): Promise<ProductAsset[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("product_assets")
    .select("*")
    .eq("product_id", productId)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("getProductAssets:", error.message);
    return [];
  }
  return (data ?? []) as ProductAsset[];
}

/** Alle Produkt-Assets, gruppiert nach product_id (für die Listenansicht). */
export async function getAllProductAssets(): Promise<
  Record<string, ProductAsset[]>
> {
  if (!isSupabaseConfigured()) return {};
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("product_assets")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) {
    console.error("getAllProductAssets:", error.message);
    return {};
  }
  const map: Record<string, ProductAsset[]> = {};
  for (const a of (data ?? []) as ProductAsset[]) {
    if (!a.product_id) continue;
    (map[a.product_id] ??= []).push(a);
  }
  return map;
}

/** Öffentliche URL zu einem gespeicherten Asset-Pfad. */
export async function getAssetPublicUrl(path: string): Promise<string | null> {
  if (!isSupabaseConfigured() || !path) return null;
  const supabase = await createClient();
  const { data } = supabase.storage
    .from(PRODUCT_ASSETS_BUCKET)
    .getPublicUrl(path);
  return data.publicUrl ?? null;
}

export async function getProducts(): Promise<Product[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .order("name", { ascending: true });
  if (error) {
    console.error("getProducts:", error.message);
    return [];
  }
  return (data ?? []) as Product[];
}

export async function getProductGroups(): Promise<ProductGroup[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("product_groups")
    .select("*")
    .order("sort", { ascending: true })
    .order("name", { ascending: true });
  if (error) {
    console.error("getProductGroups:", error.message);
    return [];
  }
  return (data ?? []) as ProductGroup[];
}
