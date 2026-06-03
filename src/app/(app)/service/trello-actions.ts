"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { getCurrentEmployee } from "@/lib/supabase/auth";
import { ensureConfigured, fail } from "@/lib/actions";

export interface TrelloImportCard {
  external_id: string;
  title: string;
  description?: string | null;
  due?: string | null; // yyyy-mm-dd
  status: string;
}

/**
 * Importiert Trello-Karten (aus dem Board-JSON-Export) als Service-Tickets.
 * Dedupe über (source='trello', external_id) — mehrfacher Import ist unkritisch.
 */
export async function importTrelloCards(
  cards: TrelloImportCard[],
): Promise<{ ok: boolean; imported?: number; skipped?: number; error?: string }> {
  const guard = ensureConfigured();
  if (guard) return { ok: false, error: guard.error };
  if (!Array.isArray(cards) || cards.length === 0) return { ok: false, error: "Keine Karten." };

  const supabase = await createClient();
  const me = await getCurrentEmployee();

  // Bereits importierte Trello-Karten überspringen.
  const { data: existing } = await supabase
    .from("service_tickets")
    .select("external_id")
    .eq("source", "trello");
  const seen = new Set((existing ?? []).map((r) => r.external_id).filter(Boolean));

  const rows = cards
    .filter((c) => c.external_id && c.title && !seen.has(c.external_id))
    .map((c) => ({
      title: c.title,
      description: c.description ?? null,
      due_date: c.due ?? null,
      status: c.status,
      source: "trello",
      external_id: c.external_id,
      created_by: me?.id ?? null,
    }));
  if (rows.length === 0) return { ok: true, imported: 0, skipped: cards.length };

  const { error } = await supabase.from("service_tickets").insert(rows);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/service");
  return { ok: true, imported: rows.length, skipped: cards.length - rows.length };
}
