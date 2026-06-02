import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import type { Measurement } from "@/lib/types";

export async function getMeasurements(projectId: string): Promise<Measurement[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("measurements")
    .select("*")
    .eq("project_id", projectId)
    .order("sort", { ascending: true });
  if (error) {
    console.error("getMeasurements:", error.message);
    return [];
  }
  return (data ?? []) as Measurement[];
}
