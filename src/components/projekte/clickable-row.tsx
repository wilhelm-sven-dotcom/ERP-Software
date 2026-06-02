"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { TableRow } from "@/components/ui/table";

/**
 * Tabellenzeile, die als Ganzes auf eine Route navigiert. Klicks auf echte
 * Links/Buttons innerhalb der Zeile lösen NICHT die Zeilennavigation aus.
 */
export function ClickableRow({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  return (
    <TableRow
      onClick={(e) => {
        if ((e.target as HTMLElement).closest("a,button")) return;
        router.push(href);
      }}
      className="cursor-pointer"
    >
      {children}
    </TableRow>
  );
}
