import { isSupabaseConfigured } from "@/lib/supabase/config";

/** Hinweis, dass ohne Supabase-Keys keine Daten geladen/gespeichert werden. */
export function SupabaseNotice() {
  if (isSupabaseConfigured()) return null;
  return (
    <div className="mb-4 rounded-md border border-[var(--warning)]/40 bg-[var(--warning)]/10 p-3 text-sm">
      <strong className="text-foreground">Supabase nicht konfiguriert</strong> —
      es werden keine Daten geladen oder gespeichert. Lege <code>.env.local</code>{" "}
      mit den Supabase-Keys an, um die Module mit echten Daten zu nutzen.
    </div>
  );
}
