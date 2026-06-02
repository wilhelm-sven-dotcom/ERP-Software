"use client";

import * as React from "react";
import Link from "next/link";
import { Plus, Star } from "lucide-react";

import { Button } from "@/components/ui/button";
import { createVariant, selectVariant } from "@/app/(app)/kalkulation/actions";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Calculation } from "@/lib/types";

/**
 * Varianten-Umschalter über dem Kalkulations-Editor. Zeigt alle Varianten eines
 * Projekts, markiert die ausgewählte (Stern) und erlaubt Anlegen/Auswählen.
 */
export function VariantBar({
  projectId,
  variants,
  activeId,
}: {
  projectId: string;
  variants: Calculation[];
  activeId: string | null;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {variants.map((v) => (
        <Link
          key={v.id}
          href={`/kalkulation/${projectId}?calc=${v.id}`}
          className={cn(
            "flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm",
            v.id === activeId
              ? "border-primary bg-primary/5 font-medium"
              : "hover:bg-muted",
          )}
        >
          {v.is_selected ? (
            <Star className="size-3.5 fill-current text-amber-500" />
          ) : null}
          <span>{v.name ?? "Variante"}</span>
          {v.system_size_kwp ? (
            <span className="text-muted-foreground text-xs">
              {formatNumber(v.system_size_kwp)} kWp
            </span>
          ) : null}
        </Link>
      ))}

      <form action={createVariant}>
        <input type="hidden" name="project_id" value={projectId} />
        <Button type="submit" variant="outline" size="sm">
          <Plus className="size-4" /> Neue Variante
        </Button>
      </form>

      {activeId &&
      !variants.find((v) => v.id === activeId)?.is_selected ? (
        <form action={selectVariant}>
          <input type="hidden" name="project_id" value={projectId} />
          <input type="hidden" name="calc_id" value={activeId} />
          <Button type="submit" variant="ghost" size="sm" title="Als ausgewählte Variante markieren">
            <Star className="size-4" /> Als ausgewählt markieren
          </Button>
        </form>
      ) : null}
    </div>
  );
}
