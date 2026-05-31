/**
 * Supabase ist optional, solange keine Keys vorhanden sind (Phase 1).
 * Alle Auth-Pfade prüfen `isSupabaseConfigured()` und verhalten sich
 * sonst als No-op, damit die App ohne Keys lauffähig und deploybar bleibt.
 */
export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

export function getSupabaseEnv(): { url: string; anonKey: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      "Supabase ist nicht konfiguriert. Bitte NEXT_PUBLIC_SUPABASE_URL und NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local setzen.",
    );
  }
  return { url, anonKey };
}
