"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentEmployee } from "@/lib/supabase/auth";
import { ensureConfigured, OK, fail, type ActionResult } from "@/lib/actions";
import {
  getConversations,
  getConversationMessages,
  type AiConversation,
  type AiMessage,
} from "@/lib/data/ai-conversations";

/** Neues Gespräch anlegen (Titel = gekürzte erste Frage). Gibt die ID zurück. */
export async function createConversation(
  firstUserMessage: string,
): Promise<ActionResult & { id?: string }> {
  const guard = ensureConfigured();
  if (guard) return guard;
  const me = await getCurrentEmployee();
  if (!me?.id) return fail("Nicht angemeldet.");
  const supabase = await createClient();
  const title = (firstUserMessage || "Gespräch").trim().slice(0, 60);
  const { data, error } = await supabase
    .from("ai_conversations")
    .insert({ employee_id: me.id, title })
    .select("id")
    .single();
  if (error || !data) return fail(error?.message ?? "Konnte Gespräch nicht anlegen.");
  return { ok: true, id: data.id };
}

/** Nachrichten an ein Gespräch anhängen (z. B. Frage + Antwort). */
export async function appendMessages(
  conversationId: string,
  messages: { role: "user" | "assistant"; content: string }[],
): Promise<ActionResult> {
  const guard = ensureConfigured();
  if (guard) return guard;
  if (!conversationId || messages.length === 0) return fail("Nichts zu speichern.");
  const supabase = await createClient();
  const { error } = await supabase.from("ai_messages").insert(
    messages.map((m) => ({ conversation_id: conversationId, role: m.role, content: m.content })),
  );
  if (error) return fail(error.message);
  await supabase
    .from("ai_conversations")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", conversationId);
  return OK;
}

export async function renameConversation(id: string, title: string): Promise<ActionResult> {
  const guard = ensureConfigured();
  if (guard) return guard;
  const supabase = await createClient();
  const { error } = await supabase
    .from("ai_conversations")
    .update({ title: title.trim().slice(0, 80) })
    .eq("id", id);
  return error ? fail(error.message) : OK;
}

export async function deleteConversation(id: string): Promise<ActionResult> {
  const guard = ensureConfigured();
  if (guard) return guard;
  const supabase = await createClient();
  const { error } = await supabase.from("ai_conversations").delete().eq("id", id);
  return error ? fail(error.message) : OK;
}

/** Verlauf-Leiste: Liste der Gespräche laden (Client-Aufruf). */
export async function listConversations(): Promise<AiConversation[]> {
  return getConversations();
}

/** Nachrichten eines Gesprächs laden (Client-Aufruf). */
export async function loadConversation(id: string): Promise<AiMessage[]> {
  return getConversationMessages(id);
}
