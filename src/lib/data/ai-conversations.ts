import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export interface AiConversation {
  id: string;
  employee_id: string;
  title: string | null;
  created_at: string;
  updated_at: string;
}

export interface AiMessage {
  id: string;
  conversation_id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

/** Gespräche des aktuellen Mitarbeiters (neueste zuerst). RLS sichert die Zuordnung. */
export async function getConversations(): Promise<AiConversation[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ai_conversations")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(50);
  if (error) {
    console.error("getConversations:", error.message);
    return [];
  }
  return (data ?? []) as AiConversation[];
}

/** Nachrichten eines Gesprächs (chronologisch). */
export async function getConversationMessages(conversationId: string): Promise<AiMessage[]> {
  if (!isSupabaseConfigured() || !conversationId) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ai_messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });
  if (error) {
    console.error("getConversationMessages:", error.message);
    return [];
  }
  return (data ?? []) as AiMessage[];
}
