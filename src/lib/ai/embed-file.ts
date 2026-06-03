import "server-only";

import { embed } from "@/lib/ai/openai";
import { createClient } from "@/lib/supabase/server";

type FileTable = "project_files" | "product_assets" | "service_ticket_files";

/**
 * Best-effort: Embedding für eine Datei-Zeile berechnen und speichern (für die
 * semantische Suche). Schlägt NIE hart fehl — fehlt die `embedding`-Spalte
 * (Migration nicht eingespielt) oder der KI-Key, wird still übersprungen.
 */
export async function embedFileRow(
  table: FileTable,
  id: string,
  text: string | null | undefined,
): Promise<void> {
  if (!id || !text) return;
  try {
    const vec = await embed(text);
    if (!vec) return;
    const supabase = await createClient();
    // pgvector erwartet die Textform "[...]".
    await supabase.from(table).update({ embedding: JSON.stringify(vec) }).eq("id", id);
  } catch {
    /* still: Spalte/Key evtl. nicht vorhanden */
  }
}
