import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import type { DocumentRecord } from "@/lib/types";

export async function getDocument(id: string): Promise<DocumentRecord | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("documents")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) {
    console.error("getDocument:", error.message);
    return null;
  }
  return (data as DocumentRecord) ?? null;
}

export async function getDocumentsByProject(
  projectId: string,
  kind?: string,
): Promise<DocumentRecord[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  let q = supabase
    .from("documents")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });
  if (kind) q = q.eq("kind", kind);
  const { data, error } = await q;
  if (error) {
    console.error("getDocumentsByProject:", error.message);
    return [];
  }
  return (data ?? []) as DocumentRecord[];
}

export type DocumentWithProject = DocumentRecord & {
  project: {
    id: string;
    title: string | null;
    customer: {
      first_name: string | null;
      last_name: string | null;
      company: string | null;
    } | null;
  } | null;
};

/** Alle Dokumente einer Art (für Listenseiten), mit Projekt + Kunde. */
export async function getDocumentsByKind(
  kind: string,
): Promise<DocumentWithProject[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("documents")
    .select(
      "*, project:projects(id, title, customer:customers(first_name, last_name, company))",
    )
    .eq("kind", kind)
    .order("doc_number", { ascending: false });
  if (error) {
    console.error("getDocumentsByKind:", error.message);
    return [];
  }
  return (data ?? []) as unknown as DocumentWithProject[];
}
