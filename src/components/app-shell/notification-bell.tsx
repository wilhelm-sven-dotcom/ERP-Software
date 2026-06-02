"use client";

import * as React from "react";
import Link from "next/link";
import { Bell } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { fetchMyInbox } from "@/app/(app)/notifications/actions";
import type { Inbox } from "@/lib/data/notifications";

const EMPTY: Inbox = { offered: [], unread: [], total: 0 };

/** Glocke in der Topbar: angebotene Aufgaben + ungelesene Nachrichten, live. */
export function NotificationBell() {
  const [inbox, setInbox] = React.useState<Inbox>(EMPTY);
  const [open, setOpen] = React.useState(false);

  const reload = React.useCallback(() => {
    void fetchMyInbox().then(setInbox);
  }, []);

  React.useEffect(() => {
    reload();
    // Live: bei neuen Nachrichten/Angeboten den Posteingang neu laden.
    const supabase = createClient();
    const channel = supabase
      .channel("inbox")
      .on("postgres_changes", { event: "*", schema: "public", table: "task_messages" }, reload)
      .on("postgres_changes", { event: "*", schema: "public", table: "task_candidates" }, reload)
      .on("postgres_changes", { event: "*", schema: "public", table: "project_tasks" }, reload)
      .subscribe();
    // Fallback-Polling alle 60 s.
    const iv = setInterval(reload, 60_000);
    return () => {
      void supabase.removeChannel(channel);
      clearInterval(iv);
    };
  }, [reload]);

  const items = [...inbox.offered, ...inbox.unread];

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="hover:bg-muted relative inline-flex size-9 items-center justify-center rounded-md"
        title="Benachrichtigungen"
        aria-label="Benachrichtigungen"
      >
        <Bell className="size-5" />
        {inbox.total > 0 ? (
          <span className="bg-destructive absolute top-1 right-1 inline-flex min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold text-white">
            {inbox.total}
          </span>
        ) : null}
      </button>

      {open ? (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="bg-popover absolute right-0 z-50 mt-1 w-80 rounded-md border p-2 shadow-lg">
            <p className="text-muted-foreground px-2 py-1 text-xs font-semibold">
              Posteingang
            </p>
            {items.length === 0 ? (
              <p className="text-muted-foreground px-2 py-3 text-sm">
                Nichts Neues.
              </p>
            ) : (
              <ul className="max-h-80 overflow-y-auto">
                {items.map((it) => (
                  <li key={`${it.reason}-${it.task_id}`}>
                    <Link
                      href={it.project_id ? `/projekte/${it.project_id}` : "/dashboard"}
                      onClick={() => setOpen(false)}
                      className="hover:bg-muted block rounded-md px-2 py-1.5 text-sm"
                    >
                      <span className="font-medium">{it.title}</span>
                      <span className="text-muted-foreground block text-xs">
                        {it.reason === "angeboten"
                          ? "Dir angeboten — annehmen?"
                          : "Neue Nachricht"}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}
