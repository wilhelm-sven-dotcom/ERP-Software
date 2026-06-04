import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import type { DispoEntryWithProject } from "@/lib/types";

/** Dispo-Einträge im Zeitraum [from, to] (inklusive), mit Projekttitel. */
export async function getDispoEntries(
  from: string,
  to: string,
): Promise<DispoEntryWithProject[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("dispo_entries")
    .select("*, project:projects(id, title)")
    .gte("date", from)
    .lte("date", to)
    .order("date", { ascending: true });
  if (error) {
    console.error("getDispoEntries:", error.message);
    return [];
  }
  return (data ?? []) as unknown as DispoEntryWithProject[];
}
