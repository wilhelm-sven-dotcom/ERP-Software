"use client";

import * as React from "react";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { Inbox } from "lucide-react";
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
import { createLead } from "@/app/(app)/vertrieb/actions";
import { LEAD_SOURCES } from "@/lib/constants";
import { type ActionResult } from "@/lib/actions";
import type { Employee } from "@/lib/types";

const initial: ActionResult = { ok: false };

export function LeadIntakeDialog({
  salesEmployees,
  trigger,
}: {
  salesEmployees: Employee[];
  trigger?: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [state, action, pending] = useActionState(createLead, initial);

  const [kind, setKind] = React.useState<"privat" | "gewerbe">("privat");
  const [street, setStreet] = React.useState("");
  const [zip, setZip] = React.useState("");
  const [city, setCity] = React.useState("");
  const [sel, setSel] = React.useState<Set<string>>(new Set());

  React.useEffect(() => {
    if (state.ok && open) {
      toast.success("Anfrage angelegt");
      if (state.warning) toast.warning(state.warning);
      setOpen(false);
      setSel(new Set());
      setStreet("");
      setZip("");
      setCity("");
      router.refresh();
      state.ok = false;
    } else if (state.error) {
      toast.error(state.error);
    }
  }, [state, open, router]);

  function toggleRep(id: string) {
    setSel((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm">
            <Inbox className="size-4" /> Neue Anfrage
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Neue Anfrage erfassen</DialogTitle>
          <DialogDescription>
            Kunde anlegen, Quelle festhalten und an den Vertrieb übergeben.
          </DialogDescription>
        </DialogHeader>
        <form action={action} className="grid gap-4">
          <input type="hidden" name="kind" value={kind} />
          <input type="hidden" name="employee_ids" value={[...sel].join(",")} />

          <div className="flex gap-2">
            {(["privat", "gewerbe"] as const).map((k) => (
              <Button
                key={k}
                type="button"
                size="sm"
                variant={kind === k ? "default" : "outline"}
                onClick={() => setKind(k)}
                className="capitalize"
              >
                {k}
              </Button>
            ))}
          </div>

          {kind === "gewerbe" ? (
            <div className="grid gap-2">
              <Label htmlFor="company">Firma</Label>
              <Input id="company" name="company" />
            </div>
          ) : null}

          <div className="grid gap-2 sm:grid-cols-[120px_1fr_1fr]">
            <div className="grid gap-2">
              <Label htmlFor="salutation">Anrede</Label>
              <Input id="salutation" name="salutation" placeholder="Herr/Frau" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="first_name">Vorname</Label>
              <Input id="first_name" name="first_name" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="last_name">Nachname</Label>
              <Input id="last_name" name="last_name" />
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-3">
            <div className="grid gap-2">
              <Label htmlFor="email">E-Mail</Label>
              <Input id="email" name="email" type="email" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="phone">Telefon</Label>
              <Input id="phone" name="phone" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="mobile">Mobil</Label>
              <Input id="mobile" name="mobile" />
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
                placeholder="Straße eingeben …"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="zip">PLZ</Label>
              <Input id="zip" name="zip" value={zip} onChange={(e) => setZip(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="city">Ort</Label>
              <Input id="city" name="city" value={city} onChange={(e) => setCity(e.target.value)} />
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="source">Quelle der Anfrage</Label>
              <Select name="source">
                <SelectTrigger id="source" className="w-full">
                  <SelectValue placeholder="Quelle wählen" />
                </SelectTrigger>
                <SelectContent>
                  {LEAD_SOURCES.map((q) => (
                    <SelectItem key={q} value={q}>
                      {q}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="notes">Notiz</Label>
            <Textarea id="notes" name="notes" rows={2} placeholder="Worum geht es?" />
          </div>

          <div className="grid gap-2">
            <Label>An Vertrieb übergeben</Label>
            {salesEmployees.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                Noch keine Vertriebs-Mitarbeiter markiert (unter „Mitarbeiter").
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {salesEmployees.map((e) => (
                  <label
                    key={e.id}
                    className="hover:bg-muted flex items-center gap-2 rounded-md border px-2 py-1.5 text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={sel.has(e.id)}
                      onChange={() => toggleRep(e.id)}
                      className="size-4"
                    />
                    {e.name ?? e.email ?? "Mitarbeiter"}
                  </label>
                ))}
              </div>
            )}
            <p className="text-muted-foreground text-xs">
              Einer → direkt zugewiesen. Mehrere → angeboten, wer zuerst annimmt,
              übernimmt die Anfrage.
            </p>
          </div>

          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Anlegen …" : "Anfrage anlegen"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
