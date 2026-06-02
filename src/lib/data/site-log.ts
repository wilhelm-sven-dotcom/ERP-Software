import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import type { SiteLogEntry } from "@/lib/types";

export async function getSiteLog(projectId: string): Promise<SiteLogEntry[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("site_log")
    .select("*")
    .eq("project_id", projectId)
    .order("log_date", { ascending: false });
  if (error) {
    console.error("getSiteLog:", error.message);
    return [];
  }
  return (data ?? []) as SiteLogEntry[];
}
