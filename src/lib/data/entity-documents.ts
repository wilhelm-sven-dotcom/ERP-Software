import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export type DocumentEntityType = "kunde" | "mitarbeiter" | "allgemein";

export interface EntityDocument {
  id: string;
  entity_type: DocumentEntityType | string;
  entity_id: string | null;
  name: string;
  storage_path: string;
  mime: string | null;
  kind: string;
  doc_meta: Record<string, unknown> | null;
  text_content: string | null;
  uploaded_by: string | null;
  created_at: string;
}

/** Dokumente einer Entität (Kunde/Mitarbeiter) laden — neueste zuerst. RLS gilt. */
export async function getDocumentsFor(
  entityType: DocumentEntityType,
  entityId: string,
): Promise<EntityDocument[]> {
  if (!isSupabaseConfigured() || !entityId) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("entity_documents")
    .select("*")
    .eq("entity_type", entityType)
    .eq("entity_id", entityId)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("getDocumentsFor:", error.message);
    return [];
  }
  return (data ?? []) as EntityDocument[];
}

/** Dokumente einer Entität inkl. zeitlich begrenzter Download-Links (signed URLs). */
export async function getDocumentsWithUrls(
  entityType: DocumentEntityType,
  entityId: string,
): Promise<(EntityDocument & { url: string | null })[]> {
  const docs = await getDocumentsFor(entityType, entityId);
  if (docs.length === 0) return [];
  const supabase = await createClient();
  return Promise.all(
    docs.map(async (d) => {
      const { data } = await supabase.storage
        .from("entity-documents")
        .createSignedUrl(d.storage_path, 3600);
      return { ...d, url: data?.signedUrl ?? null };
    }),
  );
}
