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
import { saveProject } from "@/app/(app)/projekte/actions";
import { type ActionResult } from "@/lib/actions";
import { PROJECT_STATUSES, PROJECT_TYPES } from "@/lib/constants";
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
  projectTypes = PROJECT_TYPES,
  openOnMount = false,
  trigger,
}: {
  project?: Project;
  customers: CustomerOption[];
  employees: Employee[];
  defaultCustomerId?: string;
  /** Wählbare Anlagentypen (Default-Konstante ∪ selbst angelegte Vorlagen-Typen). */
  projectTypes?: readonly string[];
  /** Dialog beim ersten Rendern automatisch öffnen (z. B. via ?neu=1). */
  openOnMount?: boolean;
  trigger: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(openOnMount);
  const [state, action, pending] = useActionState(saveProject, initial);
  const isEdit = Boolean(project);

  // Adressfelder controlled für die Autovervollständigung.
  const [street, setStreet] = React.useState(project?.street ?? "");
  const [zip, setZip] = React.useState(project?.zip ?? "");
  const [city, setCity] = React.useState(project?.city ?? "");

  // Technische Stammdaten aus projects.details lesen (für Default-Werte).
  const projectDetails = (project?.details as Record<string, unknown> | undefined) ?? {};
  const detail = (k: string) => {
    const v = projectDetails[k];
    return v == null ? "" : String(v);
  };

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

          <div className="grid gap-2">
            <Label htmlFor="project_type">Anlagentyp</Label>
            <Select
              name="project_type"
              defaultValue={project?.project_type ?? undefined}
            >
              <SelectTrigger id="project_type" className="w-full">
                <SelectValue placeholder="Anlagentyp wählen" />
              </SelectTrigger>
              <SelectContent>
                {projectTypes.map((pt) => (
                  <SelectItem key={pt} value={pt}>
                    {pt}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
            <div className="grid gap-2 sm:grid-cols-2">
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
              <div className="grid gap-2">
                <Label htmlFor="storage_kwh">Speicherkapazität (kWh)</Label>
                <Input
                  id="storage_kwh"
                  name="storage_kwh"
                  type="number"
                  step="0.01"
                  defaultValue={project?.storage_kwh ?? ""}
                />
              </div>
            </div>
          </div>

          {/* Technische Stammdaten für Auslegung & Ertragsprognose */}
          <div className="grid gap-2 sm:grid-cols-3">
            <div className="grid gap-2">
              <Label htmlFor="dach_ausrichtung">Dachausrichtung</Label>
              <Input id="dach_ausrichtung" name="dach_ausrichtung" placeholder="z. B. Süd / SO-NW"
                defaultValue={detail("dach_ausrichtung")} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="dach_neigung">Dachneigung (°)</Label>
              <Input id="dach_neigung" name="dach_neigung" type="number" step="1" min={0} max={90}
                placeholder="z. B. 30" defaultValue={detail("dach_neigung")} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="dach_flaeche">Dachfläche (m²)</Label>
              <Input id="dach_flaeche" name="dach_flaeche" type="number" step="1" min={0}
                placeholder="z. B. 60" defaultValue={detail("dach_flaeche")} />
            </div>
            <div className="grid gap-2 sm:col-span-2">
              <Label htmlFor="jahresverbrauch_kwh">Jahresverbrauch (kWh)</Label>
              <Input id="jahresverbrauch_kwh" name="jahresverbrauch_kwh" type="number" step="1" min={0}
                placeholder="z. B. 4500" defaultValue={detail("jahresverbrauch_kwh")} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="zaehlernummer">Zählernummer</Label>
              <Input id="zaehlernummer" name="zaehlernummer" defaultValue={detail("zaehlernummer")} />
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-[2fr_1fr_2fr]">
            <div className="grid gap-2">
              <Label htmlFor="street">Straße (Montageort)</Label>
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
