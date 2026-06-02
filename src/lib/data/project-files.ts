import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import type { ProjectFile } from "@/lib/types";

export const PROJECT_FILES_BUCKET = "project-files";

export async function getProjectFiles(projectId: string): Promise<ProjectFile[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("project_files")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("getProjectFiles:", error.message);
    return [];
  }
  return (data ?? []) as ProjectFile[];
}

/** Öffentliche URL zu einer Projekt-Datei. */
export async function getProjectFileUrl(path: string): Promise<string | null> {
  if (!isSupabaseConfigured() || !path) return null;
  const supabase = await createClient();
  const { data } = supabase.storage.from(PROJECT_FILES_BUCKET).getPublicUrl(path);
  return data.publicUrl ?? null;
}
