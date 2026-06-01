"use client";

import * as React from "react";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AddressAutocomplete } from "@/components/shared/address-autocomplete";
import { saveCustomer } from "@/app/(app)/kunden/actions";
import { type ActionResult } from "@/lib/actions";
import type { Customer } from "@/lib/types";

const initial: ActionResult = { ok: false };

export function CustomerFormDialog({
  customer,
  trigger,
}: {
  customer?: Customer;
  trigger: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [state, action, pending] = useActionState(saveCustomer, initial);
  const isEdit = Boolean(customer);

  // Adressfelder controlled, damit die Autovervollständigung sie füllen kann.
  const [street, setStreet] = React.useState(customer?.street ?? "");
  const [zip, setZip] = React.useState(customer?.zip ?? "");
  const [city, setCity] = React.useState(customer?.city ?? "");

  React.useEffect(() => {
    if (state.ok && open) {
      toast.success(isEdit ? "Kunde aktualisiert" : "Kunde angelegt");
      setOpen(false);
      router.refresh();
      state.ok = false;
    } else if (state.error) {
      toast.error(state.error);
    }
  }, [state, open, isEdit, router]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Kunde bearbeiten" : "Neuer Kunde"}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Stammdaten des Kunden ändern."
              : "Lege einen neuen Kunden an. Die Kundennummer wird automatisch vergeben."}
          </DialogDescription>
        </DialogHeader>

        <form action={action} className="grid gap-4">
          {customer ? (
            <input type="hidden" name="id" value={customer.id} />
          ) : null}

          <div className="grid gap-2 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="kind">Typ</Label>
              <Select name="kind" defaultValue={customer?.kind ?? undefined}>
                <SelectTrigger id="kind" className="w-full">
                  <SelectValue placeholder="Privat / Gewerbe" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="privat">Privat</SelectItem>
                  <SelectItem value="gewerbe">Gewerbe</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="company">Firma</Label>
              <Input
                id="company"
                name="company"
                defaultValue={customer?.company ?? ""}
              />
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-3">
            <div className="grid gap-2">
              <Label htmlFor="salutation">Anrede</Label>
              <Input
                id="salutation"
                name="salutation"
                defaultValue={customer?.salutation ?? ""}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="first_name">Vorname</Label>
              <Input
                id="first_name"
                name="first_name"
                defaultValue={customer?.first_name ?? ""}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="last_name">Nachname</Label>
              <Input
                id="last_name"
                name="last_name"
                defaultValue={customer?.last_name ?? ""}
              />
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-3">
            <div className="grid gap-2">
              <Label htmlFor="email">E-Mail</Label>
              <Input
                id="email"
                name="email"
                type="email"
                defaultValue={customer?.email ?? ""}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="phone">Telefon</Label>
              <Input
                id="phone"
                name="phone"
                defaultValue={customer?.phone ?? ""}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="mobile">Mobil</Label>
              <Input
                id="mobile"
                name="mobile"
                defaultValue={customer?.mobile ?? ""}
              />
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-[2fr_1fr_2fr]">
            <div className="grid gap-2">
              <Label htmlFor="street">Straße</Label>
              <AddressAutocomplete
                id="street"
                name="street"
                value={street}
                onChange={setStreet}
                onSelect={(p) => {
                  setStreet(p.street);
                  setZip(p.zip);
                  setCity(p.city);
                }}
                placeholder="Straße eingeben für Vorschläge …"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="zip">PLZ</Label>
              <Input
                id="zip"
                name="zip"
                value={zip}
                onChange={(e) => setZip(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="city">Ort</Label>
              <Input
                id="city"
                name="city"
                value={city}
                onChange={(e) => setCity(e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="notes">Notizen</Label>
            <Textarea
              id="notes"
              name="notes"
              defaultValue={customer?.notes ?? ""}
            />
          </div>

          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Speichern …" : "Speichern"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
