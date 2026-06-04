"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { getCurrentEmployee } from "@/lib/supabase/auth";
import { ensureConfigured, OK, fail, type ActionResult } from "@/lib/actions";

/** Abmelden: Supabase-Session beenden und zur Login-Seite. */
export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
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

/**
 * Gespräche durchsuchen — über den Titel UND den Nachrichteninhalt. RLS sichert,
 * dass nur eigene Gespräche/Nachrichten gefunden werden. Leerer Suchbegriff →
 * normale Liste.
 */
export async function searchConversations(query: string): Promise<AiConversation[]> {
  const q = (query ?? "").trim();
  if (!q) return getConversations();
  const supabase = await createClient();
  const like = `%${q.replace(/[\\%_]/g, (m) => "\\" + m)}%`;

  const [titleRes, msgRes] = await Promise.all([
    supabase
      .from("ai_conversations")
      .select("*")
      .ilike("title", like)
      .order("updated_at", { ascending: false })
      .limit(30),
    supabase.from("ai_messages").select("conversation_id").ilike("content", like).limit(100),
  ]);

  const byId = new Map<string, AiConversation>();
  for (const c of (titleRes.data ?? []) as AiConversation[]) byId.set(c.id, c);

  const ids = Array.from(new Set((msgRes.data ?? []).map((m) => m.conversation_id as string))).filter(
    (id) => !byId.has(id),
  );
  if (ids.length > 0) {
    const { data } = await supabase.from("ai_conversations").select("*").in("id", ids).limit(30);
    for (const c of (data ?? []) as AiConversation[]) byId.set(c.id, c);
  }

  return Array.from(byId.values())
    .sort((a, b) => (b.updated_at ?? "").localeCompare(a.updated_at ?? ""))
    .slice(0, 30);
}

/** Nachrichten eines Gesprächs laden (Client-Aufruf). */
export async function loadConversation(id: string): Promise<AiMessage[]> {
  return getConversationMessages(id);
}
