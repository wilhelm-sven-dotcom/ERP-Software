import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import type { Product, ProductGroup } from "@/lib/types";

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
