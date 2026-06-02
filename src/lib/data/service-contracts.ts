import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import type { ServiceContractWithCustomer } from "@/lib/types";

const SELECT =
  "*, customer:customers(id, first_name, last_name, company)";

/** Alle Wartungsverträge (für die Übersicht), nach Fälligkeit sortiert. */
export async function getServiceContracts(): Promise<ServiceContractWithCustomer[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("service_contracts")
    .select(SELECT)
    .order("next_due", { ascending: true, nullsFirst: false });
  if (error) {
    console.error("getServiceContracts:", error.message);
    return [];
  }
  return (data ?? []) as unknown as ServiceContractWithCustomer[];
}

/** Demnächst fällige (oder überfällige) aktive Wartungen bis `withinDays`. */
export async function getDueServiceContracts(
  withinDays = 30,
): Promise<ServiceContractWithCustomer[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const limit = new Date();
  limit.setDate(limit.getDate() + withinDays);
  const { data, error } = await supabase
    .from("service_contracts")
    .select(SELECT)
    .eq("status", "aktiv")
    .not("next_due", "is", null)
    .lte("next_due", limit.toISOString().slice(0, 10))
    .order("next_due", { ascending: true });
  if (error) {
    console.error("getDueServiceContracts:", error.message);
    return [];
  }
  return (data ?? []) as unknown as ServiceContractWithCustomer[];
}
