import { APP_VERSION } from "@/lib/app-meta";

/**
 * Sidebar-Fuß: App-Version, DB-Status, aktueller Nutzer.
 * Bildet den Legacy-Footer (#dbStatus / #currentUserBadge) nach.
 */
export function SidebarFooter({
  supabaseConfigured,
  userEmail,
}: {
  supabaseConfigured: boolean;
  userEmail: string | null;
}) {
  return (
    <div className="text-muted-foreground border-sidebar-border space-y-1 border-t px-5 py-3 text-xs">
      <div>
        ip³ PV-Tool <strong className="text-foreground">{APP_VERSION}</strong>
      </div>
      <div className="flex items-center gap-1.5">
        <span
          className={
            supabaseConfigured
              ? "size-2 rounded-full bg-[var(--success)]"
              : "size-2 rounded-full bg-[var(--warning)]"
          }
          aria-hidden
        />
        DB: {supabaseConfigured ? "Supabase verbunden" : "nicht konfiguriert"}
      </div>
      <div className="truncate">{userEmail ?? "nicht angemeldet"}</div>
    </div>
  );
}
