"use client";

import * as React from "react";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

/** Eingangsrechnung manuell erfassen (ohne Posteingang). */
export function NewIncomingInvoiceDialog() {
  const [open, setOpen] = React.useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Plus className="size-4" /> Neue Eingangsrechnung
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Eingangsrechnung erfassen</DialogTitle>
          <DialogDescription>Lieferantenrechnung als offenen Posten anlegen.</DialogDescription>
        </DialogHeader>
        <form action={bookIncomingInvoice} onSubmit={() => setOpen(false)} className="space-y-3">
          <div>
            <label className="text-muted-foreground text-xs">Lieferant</label>
            <Input name="supplier" required className="h-9" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-muted-foreground text-xs">Rechnungsnr.</label>
              <Input name="invoice_number" className="h-9" />
            </div>
            <div>
              <label className="text-muted-foreground text-xs">Betrag (Brutto)</label>
              <Input name="amount" inputMode="decimal" className="h-9" />
            </div>
            <div>
              <label className="text-muted-foreground text-xs">Rechnungsdatum</label>
              <Input name="invoice_date" type="date" className="h-9" />
            </div>
            <div>
              <label className="text-muted-foreground text-xs">Fällig am</label>
              <Input name="due_date" type="date" className="h-9" />
            </div>
            <div>
              <label className="text-muted-foreground text-xs">Währung</label>
              <Input name="currency" defaultValue="EUR" className="h-9" />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit">Anlegen</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
