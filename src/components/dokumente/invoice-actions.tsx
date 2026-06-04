"use client";

import { ChevronDown, Receipt } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { createInvoice } from "@/app/(app)/dokumente/actions";
import { INVOICE_SCHEME_PV } from "@/lib/constants";

/** Dropdown an einer Auftragsbestätigung: Abschlags-/Schluss-/Vollrechnung erzeugen. */
export function InvoiceActions({ sourceId }: { sourceId: string }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm">
          <Receipt className="size-4" /> Rechnung <ChevronDown className="size-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Abschlagsrechnung</DropdownMenuLabel>
        {INVOICE_SCHEME_PV.map((s) => (
          <form key={s.label} action={createInvoice}>
            <input type="hidden" name="source_id" value={sourceId} />
            <input type="hidden" name="invoice_type" value="abschlag" />
            <input type="hidden" name="percent" value={s.percent} />
            <input type="hidden" name="label" value={s.label} />
            <DropdownMenuItem asChild>
              <button type="submit" className="w-full text-left">
                {s.label} ({s.percent} %)
              </button>
            </DropdownMenuItem>
          </form>
        ))}
        <DropdownMenuSeparator />
        <form action={createInvoice}>
          <input type="hidden" name="source_id" value={sourceId} />
          <input type="hidden" name="invoice_type" value="schluss" />
          <DropdownMenuItem asChild>
            <button type="submit" className="w-full text-left">
              Schlussrechnung (Rest)
            </button>
          </DropdownMenuItem>
        </form>
        <form action={createInvoice}>
          <input type="hidden" name="source_id" value={sourceId} />
          <input type="hidden" name="invoice_type" value="voll" />
          <DropdownMenuItem asChild>
            <button type="submit" className="w-full text-left">
              Vollrechnung (100 %)
            </button>
          </DropdownMenuItem>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
