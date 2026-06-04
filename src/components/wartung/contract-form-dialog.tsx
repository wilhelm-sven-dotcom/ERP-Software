"use client";

import * as React from "react";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
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
import { saveContract } from "@/app/(app)/wartung/actions";
import { type ActionResult } from "@/lib/actions";
import type { ServiceContract } from "@/lib/types";

const initial: ActionResult = { ok: false };

export function ContractFormDialog({
  contract,
  customers,
  trigger,
}: {
  contract?: ServiceContract;
  customers: { id: string; name: string }[];
  trigger?: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [state, action, pending] = useActionState(saveContract, initial);

  React.useEffect(() => {
    if (state.ok && open) {
      toast.success("Wartungsvertrag gespeichert");
      setOpen(false);
      router.refresh();
      state.ok = false;
    } else if (state.error) {
      toast.error(state.error);
    }
  }, [state, open, router]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm">
            <Plus className="size-4" /> Neuer Vertrag
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{contract ? "Vertrag bearbeiten" : "Neuer Wartungsvertrag"}</DialogTitle>
          <DialogDescription>Wiederkehrende Wartung mit Intervall.</DialogDescription>
        </DialogHeader>
        <form action={action} className="grid gap-4">
          {contract ? <input type="hidden" name="id" value={contract.id} /> : null}
          <div className="grid gap-2">
            <Label htmlFor="title">Titel</Label>
            <Input id="title" name="title" defaultValue={contract?.title ?? ""} required placeholder="z. B. PV-Wartung jährlich" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="customer_id">Kunde</Label>
            <Select name="customer_id" defaultValue={contract?.customer_id ?? undefined}>
              <SelectTrigger id="customer_id" className="w-full">
                <SelectValue placeholder="Kunde wählen" />
              </SelectTrigger>
              <SelectContent>
                {customers.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            <div className="grid gap-2">
              <Label htmlFor="start_date">Beginn</Label>
              <Input id="start_date" name="start_date" type="date" defaultValue={contract?.start_date ?? ""} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="interval_months">Intervall (Monate)</Label>
              <Input id="interval_months" name="interval_months" type="number" min={1} defaultValue={contract?.interval_months ?? 12} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="next_due">Nächste Fälligkeit</Label>
              <Input id="next_due" name="next_due" type="date" defaultValue={contract?.next_due ?? ""} />
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="price">Preis (€/Jahr)</Label>
              <Input id="price" name="price" type="number" step="0.01" defaultValue={contract?.price ?? ""} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="status">Status</Label>
              <Select name="status" defaultValue={contract?.status ?? "aktiv"}>
                <SelectTrigger id="status" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="aktiv">aktiv</SelectItem>
                  <SelectItem value="pausiert">pausiert</SelectItem>
                  <SelectItem value="beendet">beendet</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="notes">Notiz</Label>
            <Textarea id="notes" name="notes" rows={2} defaultValue={contract?.notes ?? ""} />
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
