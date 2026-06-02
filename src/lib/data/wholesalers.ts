import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import type { ProductWholesaler, Wholesaler } from "@/lib/types";

export async function getWholesalers(): Promise<Wholesaler[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("wholesalers")
    .select("*")
    .order("name", { ascending: true });
  if (error) {
    console.error("getWholesalers:", error.message);
    return [];
  }
  return (data ?? []) as Wholesaler[];
}

/** Alle Großhändler-Verknüpfungen, gruppiert nach product_id. */
export async function getAllProductWholesalers(): Promise<
  Record<string, ProductWholesaler[]>
> {
  if (!isSupabaseConfigured()) return {};
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("product_wholesalers")
    .select("*, wholesaler:wholesalers(name)")
    .order("created_at", { ascending: true });
  if (error) {
    console.error("getAllProductWholesalers:", error.message);
    return {};
  }
  const map: Record<string, ProductWholesaler[]> = {};
  for (const row of (data ?? []) as unknown as ProductWholesaler[]) {
    (map[row.product_id] ??= []).push(row);
  }
  return map;
}

/** Großhändler-Verknüpfungen eines Produkts inkl. Händlername. */
export async function getProductWholesalers(
  productId: string,
): Promise<ProductWholesaler[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("product_wholesalers")
    .select("*, wholesaler:wholesalers(name)")
    .eq("product_id", productId)
    .order("created_at", { ascending: true });
  if (error) {
    console.error("getProductWholesalers:", error.message);
    return [];
  }
  return (data ?? []) as unknown as ProductWholesaler[];
}
