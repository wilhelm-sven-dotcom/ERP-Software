import { isSupabaseConfigured } from "./config";
import { createClient } from "./server";
import type { CurrentUser, Role } from "@/lib/types";

/**
 * E-Mail des aktuell angemeldeten Nutzers (oder null).
 * Ohne konfigurierte Keys immer null — die App läuft trotzdem.
 */
export async function getCurrentUserEmail(): Promise<string | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.email ?? null;
}

/**
 * Aktueller Mitarbeiter inkl. Rolle (verknüpft Auth-User → employees).
 * null, wenn nicht angemeldet oder Supabase nicht konfiguriert.
 */
export async function getCurrentEmployee(): Promise<CurrentUser | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("employees")
    .select("id, name, email, role")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (!data) {
    return { id: "", name: null, email: user.email ?? "", role: "mitarbeiter" };
  }
  return {
    id: data.id,
    name: data.name,
    email: data.email ?? user.email ?? "",
    role: (data.role as Role) ?? "mitarbeiter",
  };
}

export function isAdmin(user: CurrentUser | null): boolean {
  return user?.role === "admin";
}
