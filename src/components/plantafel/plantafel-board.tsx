"use client";

import * as React from "react";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  DndContext,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { saveDispoEntry, moveDispoEntry, deleteDispoEntry } from "@/app/(app)/plantafel/actions";
import { type ActionResult } from "@/lib/actions";
import { cn } from "@/lib/utils";
import type { DispoEntryWithProject } from "@/lib/types";

const NONE = "none";
const initial: ActionResult = { ok: false };

type Person = { id: string; name: string };
type Proj = { id: string; title: string };

const dayLabel = (iso: string) =>
  new Intl.DateTimeFormat("de-DE", { weekday: "short", day: "2-digit", month: "2-digit" }).format(
    new Date(iso),
  );

export function PlantafelBoard({
  employees,
  projects,
  days,
  entries,
}: {
  employees: Person[];
  projects: Proj[];
  days: string[];
  entries: DispoEntryWithProject[];
}) {
  const router = useRouter();
  const [items, setItems] = React.useState(entries);
  React.useEffect(() => setItems(entries), [entries]);

  const [addOpen, setAddOpen] = React.useState(false);
  const [preset, setPreset] = React.useState<{ employeeId: string; date: string }>({
    employeeId: NONE,
    date: days[0],
  });

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const rows: Person[] = [...employees, { id: NONE, name: "Ohne Zuordnung" }];

  function cellEntries(employeeId: string, date: string) {
    return items.filter(
      (e) => (e.employee_id ?? NONE) === employeeId && e.date === date,
    );
  }

  async function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over) return;
    const id = String(active.id);
    const [employeeId, date] = String(over.id).split("|");
    const entry = items.find((x) => x.id === id);
    if (!entry || (`${entry.employee_id ?? NONE}` === employeeId && entry.date === date)) return;
    setItems((prev) =>
      prev.map((x) =>
        x.id === id ? { ...x, employee_id: employeeId === NONE ? null : employeeId, date } : x,
      ),
    );
    const res = await moveDispoEntry(id, employeeId === NONE ? null : employeeId, date);
    if (!res.ok) {
      toast.error(res.error ?? "Konnte nicht verschieben");
      router.refresh();
    }
  }

  function openAdd(employeeId: string, date: string) {
    setPreset({ employeeId, date });
    setAddOpen(true);
  }

  return (
    <>
      <DndContext sensors={sensors} onDragEnd={onDragEnd}>
        <div className="overflow-x-auto">
          <div className="min-w-[900px]">
            {/* Kopfzeile mit Tagen */}
            <div className="grid grid-cols-[160px_repeat(7,1fr)] gap-2">
              <div />
              {days.map((d) => (
                <div key={d} className="text-muted-foreground px-1 pb-1 text-center text-xs font-medium">
                  {dayLabel(d)}
                </div>
              ))}
            </div>
            {/* Zeilen je Mitarbeiter */}
            <div className="space-y-2">
              {rows.map((p) => (
                <div key={p.id} className="grid grid-cols-[160px_repeat(7,1fr)] gap-2">
                  <div className="flex items-center px-2 text-sm font-medium">{p.name}</div>
                  {days.map((d) => (
                    <Cell
                      key={d}
                      employeeId={p.id}
                      date={d}
                      onAdd={() => openAdd(p.id, d)}
                    >
                      {cellEntries(p.id, d).map((entry) => (
                        <DispoCard key={entry.id} entry={entry} />
                      ))}
                    </Cell>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </DndContext>

      <AddDispoDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        employees={employees}
        projects={projects}
        preset={preset}
        onSaved={() => router.refresh()}
      />
    </>
  );
}

function Cell({
  employeeId,
  date,
  onAdd,
  children,
}: {
  employeeId: string;
  date: string;
  onAdd: () => void;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `${employeeId}|${date}` });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "group bg-muted/30 min-h-16 rounded-lg border p-1",
        isOver && "ring-primary ring-2",
      )}
    >
      <div className="space-y-1">{children}</div>
      <button
        type="button"
        onClick={onAdd}
        className="text-muted-foreground hover:text-foreground mt-1 hidden w-full justify-center group-hover:flex"
        title="Termin hinzufügen"
      >
        <Plus className="size-3.5" />
      </button>
    </div>
  );
}

function DispoCard({ entry }: { entry: DispoEntryWithProject }) {
  const { setNodeRef, attributes, listeners, isDragging } = useDraggable({ id: entry.id });
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={cn(
        "bg-primary/10 text-primary cursor-grab touch-none rounded-md px-1.5 py-1 text-xs",
        isDragging && "opacity-40",
      )}
      title={entry.note ?? undefined}
    >
      <p className="font-medium">{entry.title}</p>
      {entry.project ? (
        <Link
          href={`/projekte/${entry.project.id}`}
          className="text-primary/70 block truncate hover:underline"
          onPointerDown={(e) => e.stopPropagation()}
        >
          {entry.project.title}
        </Link>
      ) : null}
    </div>
  );
}

function AddDispoDialog({
  open,
  onOpenChange,
  employees,
  projects,
  preset,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  employees: Person[];
  projects: Proj[];
  preset: { employeeId: string; date: string };
  onSaved: () => void;
}) {
  const [state, action, pending] = useActionState(saveDispoEntry, initial);

  React.useEffect(() => {
    if (state.ok && open) {
      toast.success("Termin gespeichert");
      onOpenChange(false);
      onSaved();
      state.ok = false;
    } else if (state.error) {
      toast.error(state.error);
    }
  }, [state, open, onOpenChange, onSaved]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Termin / Einsatz</DialogTitle>
        </DialogHeader>
        <form action={action} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="title">Titel</Label>
            <Input id="title" name="title" required placeholder="z. B. Montage Müller" />
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="date">Datum</Label>
              <Input id="date" name="date" type="date" defaultValue={preset.date} required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="kind">Art</Label>
              <Select name="kind" defaultValue="einsatz">
                <SelectTrigger id="kind" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="einsatz">Einsatz</SelectItem>
                  <SelectItem value="montage">Montage</SelectItem>
                  <SelectItem value="aufmass">Aufmaß</SelectItem>
                  <SelectItem value="wartung">Wartung</SelectItem>
                  <SelectItem value="sonstiges">Sonstiges</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="employee_id">Mitarbeiter</Label>
            <Select name="employee_id" defaultValue={preset.employeeId === NONE ? undefined : preset.employeeId}>
              <SelectTrigger id="employee_id" className="w-full">
                <SelectValue placeholder="—" />
              </SelectTrigger>
              <SelectContent>
                {employees.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="project_id">Projekt (optional)</Label>
            <Select name="project_id">
              <SelectTrigger id="project_id" className="w-full">
                <SelectValue placeholder="—" />
              </SelectTrigger>
              <SelectContent>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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

/** Kompakte Lösch-Schaltfläche (separat, um DnD nicht zu stören) — derzeit
 *  über die Karten-Detailansicht nicht nötig; Platzhalter für spätere Nutzung. */
export function DeleteDispoButton({ id }: { id: string }) {
  return (
    <form action={deleteDispoEntry}>
      <input type="hidden" name="id" value={id} />
      <Button variant="ghost" size="icon" className="size-7" type="submit" title="Löschen">
        <Trash2 className="size-3.5" />
      </Button>
    </form>
  );
}
