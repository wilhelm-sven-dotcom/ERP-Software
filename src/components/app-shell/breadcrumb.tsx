"use client";

import { usePathname } from "next/navigation";

import { findNavItemByPath } from "@/lib/navigation";

/** Zeigt den Titel des aktiven Moduls (Legacy `#breadcrumb`). */
export function Breadcrumb() {
  const pathname = usePathname();
  const item = findNavItemByPath(pathname);
  return (
    <div className="truncate text-sm font-medium">
      {item?.label ?? "ip³ PV-Tool"}
    </div>
  );
}
