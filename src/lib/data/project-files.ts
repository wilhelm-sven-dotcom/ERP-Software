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

export interface IncomingDocument extends ProjectFile {
  project: {
    id: string;
    title: string | null;
    customer: { first_name: string | null; last_name: string | null; company: string | null } | null;
  } | null;
}

/**
 * Eingezogene Belege (z. B. Eingangsrechnungen): Projekt-Dateien mit KI-Beleg-
 * Metadaten. Für die Buchhaltungs-Übersicht „Eingangsbelege".
 */
export async function getIncomingDocuments(): Promise<IncomingDocument[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("project_files")
    .select(
      "*, project:projects(id, title, customer:customers(first_name, last_name, company))",
    )
    .not("doc_meta", "is", null)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) {
    console.error("getIncomingDocuments:", error.message);
    return [];
  }
  return (data ?? []) as unknown as IncomingDocument[];
}

/** Öffentliche URL zu einer Projekt-Datei. */
export async function getProjectFileUrl(path: string): Promise<string | null> {
  if (!isSupabaseConfigured() || !path) return null;
  const supabase = await createClient();
  const { data } = supabase.storage.from(PROJECT_FILES_BUCKET).getPublicUrl(path);
  return data.publicUrl ?? null;
}
