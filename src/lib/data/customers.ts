import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import type { ActivityWithEmployee, Customer } from "@/lib/types";

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

/**
 * Findet mögliche Kunden-Duplikate über Name (company/last_name) + Ort/PLZ.
 * Case-insensitive Teiltreffer (ILIKE). Liefert bis zu 5 Kandidaten.
 */
export async function findCustomerDuplicates(opts: {
  company?: string | null;
  lastName?: string | null;
  zip?: string | null;
  city?: string | null;
  excludeId?: string | null;
}): Promise<Customer[]> {
  if (!isSupabaseConfigured()) return [];
  const name = (opts.company || opts.lastName || "").trim();
  if (name.length < 2) return [];

  const supabase = await createClient();
  let query = supabase.from("customers").select("*").limit(5);

  // Name-Treffer (Firma ODER Nachname)
  query = query.or(`company.ilike.%${name}%,last_name.ilike.%${name}%`);
  // Auf gleiche PLZ oder Ort eingrenzen, falls vorhanden
  if (opts.zip) query = query.eq("zip", opts.zip);
  else if (opts.city) query = query.ilike("city", opts.city);
  if (opts.excludeId) query = query.neq("id", opts.excludeId);

  const { data, error } = await query;
  if (error) {
    console.error("findCustomerDuplicates:", error.message);
    return [];
  }
  return (data ?? []) as Customer[];
}

export async function getCustomerActivities(
  customerId: string,
): Promise<ActivityWithEmployee[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("activities")
    .select("*, employee:employees(name)")
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("getCustomerActivities:", error.message);
    return [];
  }
  return (data ?? []) as unknown as ActivityWithEmployee[];
}
