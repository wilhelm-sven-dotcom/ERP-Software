"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { navItems } from "@/lib/navigation";
import { useSidebarCollapsed } from "@/components/app-shell/sidebar-context";
import { cn } from "@/lib/utils";

/**
 * Navigationsliste, geteilt zwischen Desktop-Sidebar und mobilem Sheet.
 * Active-State über den aktuellen Pfad (Goldene Regel #2 — eine Quelle).
 * Eingeklappte Sidebar (Kontext) → nur Icons, Label als Tooltip.
 */
export function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const collapsed = useSidebarCollapsed();

  return (
    <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-2">
      {navItems.map((item) => {
        const active =
          pathname === item.href || pathname.startsWith(item.href + "/");
        const Icon = item.icon;
        return (
          <Link
            key={item.key}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            title={collapsed ? item.label : undefined}
            className={cn(
              "flex items-center rounded-lg text-sm font-medium transition-colors",
              collapsed ? "justify-center px-2 py-2" : "gap-2.5 px-3 py-2",
              active
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
            )}
          >
            <Icon className="size-4 shrink-0" />
            {collapsed ? null : item.label}
          </Link>
        );
      })}
    </nav>
  );
}
