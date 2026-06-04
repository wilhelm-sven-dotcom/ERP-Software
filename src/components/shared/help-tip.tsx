"use client";

import * as React from "react";
import { HelpCircle } from "lucide-react";

import { cn } from "@/lib/utils";
import { helpEntry } from "@/lib/help/help-content";

/**
 * Kleines (i)-Symbol mit Kurzerklärung. Entweder `id` (aus der zentralen
 * Hilfe-Registry) oder direkt `text`. Klick öffnet ein kleines Panel; Klick
 * daneben oder Escape schließt es (mobil-tauglich, keine Abhängigkeit).
 */
export function HelpTip({
  id,
  text,
  title,
  className,
}: {
  id?: string;
  text?: string;
  title?: string;
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLSpanElement>(null);

  const entry = id ? helpEntry(id) : undefined;
  const body = text ?? entry?.short ?? "";
  const heading = title ?? entry?.term;

  React.useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!body) return null;

  return (
    <span ref={ref} className={cn("relative inline-flex align-middle", className)}>
      <button
        type="button"
        aria-label={heading ? `Hilfe: ${heading}` : "Hilfe"}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        className="text-muted-foreground hover:text-foreground inline-flex transition-colors"
      >
        <HelpCircle className="size-3.5" />
      </button>
      {open ? (
        <span
          role="tooltip"
          className="bg-popover text-popover-foreground absolute top-5 left-1/2 z-50 w-64 -translate-x-1/2 rounded-lg border p-3 text-left text-xs leading-relaxed shadow-xl"
        >
          {heading ? <span className="mb-1 block font-semibold">{heading}</span> : null}
          <span className="text-muted-foreground block font-normal">{body}</span>
        </span>
      ) : null}
    </span>
  );
}
