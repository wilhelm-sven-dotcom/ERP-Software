import { isSupabaseConfigured } from "@/lib/supabase/config";

/** Einheitliches Ergebnis für Server-Actions (für useActionState). */
export type ActionResult = { ok: boolean; error?: string };

export const OK: ActionResult = { ok: true };

export function fail(error: string): ActionResult {
  return { ok: false, error };
}

/** Standard-Guard für alle schreibenden Actions. */
export function ensureConfigured(): ActionResult | null {
  if (!isSupabaseConfigured()) {
    return fail(
      "Supabase ist nicht konfiguriert. Bitte .env.local mit den Keys anlegen.",
    );
  }
  return null;
}
