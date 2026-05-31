import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import type { Activity, Customer } from "@/lib/types";

/** Alle Kunden (nach Kundennummer). Leer, wenn Supabase nicht konfiguriert. */
export async function getCustomers(): Promise<Customer[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("customers")
    .select("*")
    .order("customer_nr", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });
  if (error) {
    console.error("getCustomers:", error.message);
    return [];
  }
  return (data ?? []) as Customer[];
}

export async function getCustomer(id: string): Promise<Customer | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("customers")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) {
    console.error("getCustomer:", error.message);
    return null;
  }
  return (data as Customer) ?? null;
}

export async function getCustomerActivities(
  customerId: string,
): Promise<Activity[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("activities")
    .select("*")
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("getCustomerActivities:", error.message);
    return [];
  }
  return (data ?? []) as Activity[];
}
