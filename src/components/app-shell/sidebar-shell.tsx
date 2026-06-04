"use client";

import * as React from "react";
import { PanelLeft } from "lucide-react";

import { SidebarCollapsedContext } from "@/components/app-shell/sidebar-context";
import { cn } from "@/lib/utils";

/**
 * Client-Hülle der Desktop-Sidebar: hält den Ein-/Ausklapp-Zustand, blendet im
 * eingeklappten Zustand Schrift/Fuß aus (nur Icons) und merkt die Wahl in einem
 * Cookie (server-seitig gelesen → kein Flackern). Marke/Navigation/Fuß werden als
 * Server-Knoten hereingereicht (der Fuß lädt den Nutzer asynchron).
 */
export function SidebarShell({
  brand,
  nav,
  footer,
  defaultCollapsed,
}: {
  brand: React.ReactNode;
  nav: React.ReactNode;
  footer: React.ReactNode;
  defaultCollapsed: boolean;
}) {
  const [collapsed, setCollapsed] = React.useState(defaultCollapsed);

  function toggle() {
    setCollapsed((c) => {
      const next = !c;
      try {
        document.cookie = `sb_collapsed=${next ? "1" : "0"}; path=/; max-age=31536000; samesite=lax`;
      } catch {
        /* Cookies nicht verfügbar → nur für diese Sitzung */
      }
      return next;
    });
  }

  return (
    <aside
      data-app-shell-chrome
      data-collapsed={collapsed}
      className={cn(
        "bg-sidebar/80 text-sidebar-foreground border-sidebar-border supports-[backdrop-filter]:bg-sidebar/65 sticky top-0 hidden h-svh shrink-0 flex-col border-r backdrop-blur-xl transition-[width] duration-200 lg:flex",
        collapsed ? "w-16" : "w-64",
      )}
    >
      <div
        className={cn(
          "border-sidebar-border flex h-16 items-center border-b",
          collapsed ? "justify-center px-2" : "justify-between px-5",
        )}
      >
        {collapsed ? null : <div className="min-w-0">{brand}</div>}
        <button
          type="button"
          onClick={toggle}
          title={collapsed ? "Menü ausklappen" : "Menü einklappen"}
          aria-label={collapsed ? "Menü ausklappen" : "Menü einklappen"}
          className="text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground shrink-0 rounded-md p-1.5 transition-colors"
        >
          <PanelLeft className="size-4" />
        </button>
      </div>

      <SidebarCollapsedContext.Provider value={collapsed}>
        {nav}
      </SidebarCollapsedContext.Provider>

      {collapsed ? null : footer}
    </aside>
  );
}
