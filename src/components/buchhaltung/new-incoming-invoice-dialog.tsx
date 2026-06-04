"use client";

import * as React from "react";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { bookIncomingInvoice } from "@/app/(app)/buchhaltung/actions";

export interface InvoiceInitial {
  supplier?: string | null;
  invoice_number?: string | null;
  invoice_date?: string | null;
  due_date?: string | null;
  amount?: number | string | null;
  currency?: string | null;
  notes?: string | null;
}

/** Eingangsrechnung manuell erfassen (ohne Posteingang) — auch zum Duplizieren. */
export function NewIncomingInvoiceDialog({
  suppliers = [],
  initial,
  trigger,
  title = "Eingangsrechnung erfassen",
}: {
  suppliers?: string[];
  initial?: InvoiceInitial;
  trigger?: React.ReactNode;
  title?: string;
}) {
  const [open, setOpen] = React.useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline" size="sm">
            <Plus className="size-4" /> Neue Eingangsrechnung
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>Lieferantenrechnung als offenen Posten anlegen.</DialogDescription>
        </DialogHeader>
        <form action={bookIncomingInvoice} onSubmit={() => setOpen(false)} className="space-y-3">
          <div>
            <label className="text-muted-foreground text-xs">Lieferant</label>
            <Input name="supplier" required list="supplier-list" defaultValue={initial?.supplier ?? ""} className="h-9" />
            <datalist id="supplier-list">
              {suppliers.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-muted-foreground text-xs">Rechnungsnr.</label>
              <Input name="invoice_number" defaultValue={initial?.invoice_number ?? ""} className="h-9" />
            </div>
            <div>
              <label className="text-muted-foreground text-xs">Betrag (Brutto)</label>
              <Input name="amount" inputMode="decimal" defaultValue={initial?.amount != null ? String(initial.amount) : ""} className="h-9" />
            </div>
            <div>
              <label className="text-muted-foreground text-xs">Rechnungsdatum</label>
              <Input name="invoice_date" type="date" defaultValue={initial?.invoice_date ?? ""} className="h-9" />
            </div>
            <div>
              <label className="text-muted-foreground text-xs">Fällig am</label>
              <Input name="due_date" type="date" defaultValue={initial?.due_date ?? ""} className="h-9" />
            </div>
            <div>
              <label className="text-muted-foreground text-xs">Währung</label>
              <Input name="currency" defaultValue={initial?.currency ?? "EUR"} className="h-9" />
            </div>
          </div>
          <div>
            <label className="text-muted-foreground text-xs">Notiz</label>
            <Textarea name="notes" rows={2} defaultValue={initial?.notes ?? ""} />
          </div>
          <DialogFooter>
            <Button type="submit">Anlegen</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
