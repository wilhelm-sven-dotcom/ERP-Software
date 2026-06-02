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
import { saveWholesaler } from "@/app/(app)/grosshaendler/actions";
import { type ActionResult } from "@/lib/actions";
import type { Wholesaler } from "@/lib/types";

const initial: ActionResult = { ok: false };

export function WholesalerFormDialog({
  wholesaler,
  trigger,
}: {
  wholesaler?: Wholesaler;
  trigger: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [state, action, pending] = useActionState(saveWholesaler, initial);
  const isEdit = Boolean(wholesaler);

  React.useEffect(() => {
    if (state.ok && open) {
      toast.success(isEdit ? "Großhändler aktualisiert" : "Großhändler angelegt");
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setOpen(false);
      router.refresh();
      // eslint-disable-next-line react-hooks/immutability
      state.ok = false;
    } else if (state.error) {
      toast.error(state.error);
    }
  }, [state, open, isEdit, router]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Großhändler bearbeiten" : "Neuer Großhändler"}
          </DialogTitle>
          <DialogDescription>
            Lieferant für Produkte – mit Ansprechpartner und Kontaktdaten.
          </DialogDescription>
        </DialogHeader>

        <form action={action} className="grid gap-4">
          {wholesaler ? (
            <input type="hidden" name="id" value={wholesaler.id} />
          ) : null}

          <div className="grid gap-2">
            <Label htmlFor="name">Name *</Label>
            <Input
              id="name"
              name="name"
              defaultValue={wholesaler?.name ?? ""}
              required
            />
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="contact">Ansprechpartner</Label>
              <Input
                id="contact"
                name="contact"
                defaultValue={wholesaler?.contact ?? ""}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="phone">Telefon</Label>
              <Input
                id="phone"
                name="phone"
                defaultValue={wholesaler?.phone ?? ""}
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="email">E-Mail</Label>
            <Input
              id="email"
              name="email"
              type="email"
              defaultValue={wholesaler?.email ?? ""}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="notes">Notizen</Label>
            <Textarea
              id="notes"
              name="notes"
              defaultValue={wholesaler?.notes ?? ""}
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
