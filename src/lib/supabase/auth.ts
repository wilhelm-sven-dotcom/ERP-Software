import { isSupabaseConfigured } from "./config";
import { createClient } from "./server";

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
