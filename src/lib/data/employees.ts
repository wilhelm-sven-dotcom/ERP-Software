import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import type { Employee } from "@/lib/types";

export async function getEmployees(): Promise<Employee[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("employees")
    .select("*")
    .order("name", { ascending: true });
  if (error) {
    console.error("getEmployees:", error.message);
    return [];
  }
  return (data ?? []) as Employee[];
}

/** Aktive Mitarbeiter mit Vertriebs-Kennzeichen (für die Anfragen-Zuweisung). */
export async function getSalesEmployees(): Promise<Employee[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("employees")
    .select("*")
    .eq("is_sales", true)
    .eq("active", true)
    .order("name", { ascending: true });
  if (error) {
    console.error("getSalesEmployees:", error.message);
    return [];
  }
  return (data ?? []) as Employee[];
}
