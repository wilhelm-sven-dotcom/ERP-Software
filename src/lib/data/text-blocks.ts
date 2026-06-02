import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import type { OfferTextBlock } from "@/lib/types";

/** Alle Textbausteine (für die Verwaltung). */
export async function getAllTextBlocks(): Promise<OfferTextBlock[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("offer_text_blocks")
    .select("*")
    .order("project_type", { ascending: true, nullsFirst: true })
    .order("kind", { ascending: true })
    .order("sort", { ascending: true });
  if (error) {
    console.error("getAllTextBlocks:", error.message);
    return [];
  }
  return (data ?? []) as OfferTextBlock[];
}

/**
 * Bausteine für einen Anlagentyp: typ-spezifische Blöcke haben Vorrang, sonst
 * greifen die Standard-Blöcke (project_type IS NULL) je `kind`.
 */
export async function getTextBlocksFor(
  projectType: string | null,
): Promise<OfferTextBlock[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("offer_text_blocks")
    .select("*")
    .or(
      projectType
        ? `project_type.is.null,project_type.eq.${projectType}`
        : "project_type.is.null",
    )
    .order("sort", { ascending: true });
  if (error) {
    console.error("getTextBlocksFor:", error.message);
    return [];
  }
  const all = (data ?? []) as OfferTextBlock[];
  // Für jeden kind: typ-spezifische Blöcke bevorzugen, sonst Standard.
  const hasSpecific = new Set(
    all.filter((b) => b.project_type === projectType && projectType).map((b) => b.kind),
  );
  return all.filter((b) =>
    hasSpecific.has(b.kind) ? b.project_type === projectType : b.project_type === null,
  );
}
