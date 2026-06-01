import { Suspense } from "react";

import { APP_VERSION } from "@/lib/app-meta";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getCurrentUserEmail } from "@/lib/supabase/auth";

/**
 * Sidebar-Fuß: App-Version, DB-Status, aktueller Nutzer.
 * Bildet den Legacy-Footer (#dbStatus / #currentUserBadge) nach.
 *
 * Der Nutzer-Abruf (Netzwerk) ist per Suspense entkoppelt, damit die Shell
 * bei jeder Navigation sofort rendert und nicht auf Supabase wartet.
 */
export function SidebarFooter() {
  const supabaseConfigured = isSupabaseConfigured();
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
      <Suspense fallback={<div className="truncate">…</div>}>
        <UserBadge />
      </Suspense>
    </div>
  );
}

async function UserBadge() {
  const userEmail = await getCurrentUserEmail();
  return <div className="truncate">{userEmail ?? "nicht angemeldet"}</div>;
}
