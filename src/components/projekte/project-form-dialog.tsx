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
import { saveProject } from "@/app/(app)/projekte/actions";
import { type ActionResult } from "@/lib/actions";
import { PROJECT_STATUSES } from "@/lib/constants";
import { customerName } from "@/lib/format";
import type { Customer, Employee, Project } from "@/lib/types";

const initial: ActionResult = { ok: false };

type CustomerOption = Pick<
  Customer,
  "id" | "first_name" | "last_name" | "company"
>;

export function ProjectFormDialog({
  project,
  customers,
  employees,
  defaultCustomerId,
  openOnMount = false,
  trigger,
}: {
  project?: Project;
  customers: CustomerOption[];
  employees: Employee[];
  defaultCustomerId?: string;
  /** Dialog beim ersten Rendern automatisch öffnen (z. B. via ?neu=1). */
  openOnMount?: boolean;
  trigger: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(openOnMount);
  const [state, action, pending] = useActionState(saveProject, initial);
  const isEdit = Boolean(project);

  React.useEffect(() => {
    if (state.ok && open) {
      toast.success(isEdit ? "Projekt aktualisiert" : "Projekt angelegt");
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
            {isEdit ? "Projekt bearbeiten" : "Neues Projekt"}
          </DialogTitle>
          <DialogDescription>
            Projektdaten und Zuordnung zu Kunde und Bearbeiter.
          </DialogDescription>
        </DialogHeader>

        <form action={action} className="grid gap-4">
          {project ? <input type="hidden" name="id" value={project.id} /> : null}

          <div className="grid gap-2">
            <Label htmlFor="title">Titel *</Label>
            <Input
              id="title"
              name="title"
              defaultValue={project?.title ?? ""}
              required
            />
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="customer_id">Kunde</Label>
              <Select
                name="customer_id"
                defaultValue={project?.customer_id ?? defaultCustomerId}
              >
                <SelectTrigger id="customer_id" className="w-full">
                  <SelectValue placeholder="Kunde wählen" />
                </SelectTrigger>
                <SelectContent>
                  {customers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {customerName(c)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="status">Status</Label>
              <Select
                name="status"
                defaultValue={project?.status ?? "Anfrage"}
              >
                <SelectTrigger id="status" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROJECT_STATUSES.map((st) => (
                    <SelectItem key={st} value={st}>
                      {st}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="assigned_employee_id">Bearbeiter</Label>
              <Select
                name="assigned_employee_id"
                defaultValue={project?.assigned_employee_id ?? undefined}
              >
                <SelectTrigger id="assigned_employee_id" className="w-full">
                  <SelectValue placeholder="Bearbeiter wählen" />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.name ?? e.email ?? "Mitarbeiter"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="system_size_kwp">Anlagengröße (kWp)</Label>
              <Input
                id="system_size_kwp"
                name="system_size_kwp"
                type="number"
                step="0.01"
                defaultValue={project?.system_size_kwp ?? ""}
              />
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-[2fr_1fr_2fr]">
            <div className="grid gap-2">
              <Label htmlFor="street">Straße (Montageort)</Label>
              <Input
                id="street"
                name="street"
                defaultValue={project?.street ?? ""}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="zip">PLZ</Label>
              <Input id="zip" name="zip" defaultValue={project?.zip ?? ""} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="city">Ort</Label>
              <Input id="city" name="city" defaultValue={project?.city ?? ""} />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="notes">Notizen</Label>
            <Textarea
              id="notes"
              name="notes"
              defaultValue={project?.notes ?? ""}
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
