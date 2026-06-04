import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import type { TimeEntry } from "@/lib/types";

export type TimeEntryWithRefs = TimeEntry & {
  employee: { name: string | null } | null;
  project: { id: string; title: string | null } | null;
};

export async function getTimeEntriesByProject(
  projectId: string,
): Promise<TimeEntryWithRefs[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("time_entries")
    .select("*, employee:employees(name), project:projects(id, title)")
    .eq("project_id", projectId)
    .order("work_date", { ascending: false });
  if (error) {
    console.error("getTimeEntriesByProject:", error.message);
    return [];
  }
  return (data ?? []) as unknown as TimeEntryWithRefs[];
}

/** Zeiteinträge (für die Modul-Liste), optional auf einen Mitarbeiter gefiltert. */
export async function getTimeEntries(
  employeeId?: string,
): Promise<TimeEntryWithRefs[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  let q = supabase
    .from("time_entries")
    .select("*, employee:employees(name), project:projects(id, title)")
    .order("work_date", { ascending: false })
    .limit(200);
  if (employeeId) q = q.eq("employee_id", employeeId);
  const { data, error } = await q;
  if (error) {
    console.error("getTimeEntries:", error.message);
    return [];
  }
  return (data ?? []) as unknown as TimeEntryWithRefs[];
}
