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
