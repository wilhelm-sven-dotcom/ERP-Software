import { NextResponse } from "next/server";

import { getCurrentEmployee } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { embed, isAiConfigured } from "@/lib/ai/openai";

const TABLES = ["project_files", "product_assets", "service_ticket_files"] as const;
const BATCH = 18; // pro Aufruf (Timeout-/Kostenkontrolle)

/**
 * Backfill der Embeddings für bereits hochgeladene Dokumente (semantische Suche).
 * Verarbeitet pro Aufruf einen kleinen Batch und meldet, wie viele noch offen sind
 * — die Oberfläche ruft die Route wiederholt auf, bis remaining = 0.
 * Fehlt die Migration/der Key, passiert nichts (graceful).
 */
export async function POST() {
  const me = await getCurrentEmployee();
  if (!me) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!isAiConfigured()) return NextResponse.json({ enabled: false });

  const supabase = await createClient();
  let embedded = 0;
  let remaining = 0;

  for (const table of TABLES) {
    try {
      const { data, error } = await supabase
        .from(table)
        .select("id, text_content")
        .is("embedding", null)
        .not("text_content", "is", null)
        .limit(BATCH);
      if (error) continue; // Spalte evtl. nicht vorhanden → Migration fehlt
      const rows = data ?? [];
      for (const r of rows) {
        if (embedded >= BATCH) {
          remaining += 1;
          continue;
        }
        const vec = await embed(String((r as { text_content: string }).text_content));
        if (!vec) continue;
        await supabase
          .from(table)
          .update({ embedding: JSON.stringify(vec) })
          .eq("id", (r as { id: string }).id);
        embedded += 1;
      }
      if (rows.length === BATCH) remaining += 1; // evtl. mehr vorhanden
    } catch {
      /* still */
    }
  }

  return NextResponse.json({ enabled: true, embedded, remaining });
}
