"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const TABS = [
  { href: "/vorlagen", label: "Vorlagen & Bausteine" },
  { href: "/workflow", label: "Abläufe" },
];

/** Gemeinsame Tab-Leiste für Vorlagen und Ablauf-Vorlagen (ein Menüpunkt). */
export function VorlagenSectionTabs() {
  const pathname = usePathname();
  return (
    <div className="mb-4 inline-flex gap-1 rounded-lg border p-1">
      {TABS.map((t) => {
        const active = pathname === t.href || pathname.startsWith(t.href + "/");
        return (
          <Link
            key={t.href}
            href={t.href}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm transition-colors",
              active ? "bg-primary text-primary-foreground" : "hover:bg-muted text-muted-foreground",
            )}
          >
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
