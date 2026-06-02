"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { MessageSquare, Plus, Trash2, UserPlus, Undo2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TaskThread } from "@/components/projekte/task-thread";
import {
  addTask,
  assignTask,
  claimTask,
  deleteTask,
  handBackTask,
  offerTask,
  startWorkflow,
  toggleTask,
  updateTask,
} from "@/app/(app)/workflow/actions";
import { cn } from "@/lib/utils";
import type { Employee, ProjectTask } from "@/lib/types";

const UNASSIGNED = "__none__";

export function TaskList({
  projectId,
  tasks,
  employees,
  candidatesByTask = {},
  currentEmployeeId = null,
}: {
  projectId: string;
  tasks: ProjectTask[];
  employees: Employee[];
  /** Mitarbeiter-IDs, denen die jeweilige Aufgabe angeboten wurde. */
  candidatesByTask?: Record<string, string[]>;
  currentEmployeeId?: string | null;
}) {
  const router = useRouter();
  const [adding, setAdding] = React.useState(false);
  const [newTitle, setNewTitle] = React.useState("");

  const open = tasks.filter((t) => t.status !== "erledigt").length;
  const empName = (id: string | null) =>
    id ? employees.find((e) => e.id === id)?.name ?? "Mitarbeiter" : "—";

  async function run(fn: () => Promise<unknown>) {
    await fn();
    router.refresh();
  }

  function fd(task: ProjectTask, extra: Record<string, string> = {}) {
    const f = new FormData();
    f.set("id", task.id);
    f.set("project_id", projectId);
    for (const [k, v] of Object.entries(extra)) f.set(k, v);
    return f;
  }

  async function toggle(task: ProjectTask) {
    await run(() => toggleTask(fd(task, { done: String(task.status !== "erledigt") })));
  }
  async function changeAssignee(task: ProjectTask, value: string) {
    if (value === UNASSIGNED) {
      await run(() =>
        updateTask(fd(task, { assignee_employee_id: "", due_date: task.due_date ?? "" })),
      );
    } else {
      await run(() => assignTask(fd(task, { employee_id: value })));
    }
  }
  async function changeDue(task: ProjectTask, value: string) {
    await run(() =>
      updateTask(
        fd(task, { assignee_employee_id: task.assignee_employee_id ?? "", due_date: value }),
      ),
    );
  }
  async function claim(task: ProjectTask) {
    await claimTask(fd(task));
    router.refresh();
  }
  async function handBack(task: ProjectTask) {
    await run(() => handBackTask(fd(task)));
  }
  async function remove(task: ProjectTask) {
    await run(() => deleteTask(fd(task)));
  }
  async function add() {
    const v = newTitle.trim();
    if (!v) return;
    const f = new FormData();
    f.set("project_id", projectId);
    f.set("title", v);
    const res = await addTask({ ok: false }, f);
    if (res.ok) {
      setNewTitle("");
      setAdding(false);
      router.refresh();
    } else {
      toast.error(res.error ?? "Konnte Aufgabe nicht anlegen");
    }
  }

  if (tasks.length === 0) {
    return (
      <div className="text-sm">
        <p className="text-muted-foreground mb-3">
          Noch keine Aufgaben. Starte den Projektablauf passend zum Anlagentyp.
        </p>
        <form action={startWorkflow}>
          <input type="hidden" name="project_id" value={projectId} />
          <Button type="submit" size="sm">
            Ablauf starten
          </Button>
        </form>
      </div>
    );
  }

  // Nach group_label bündeln (parallele Aufgaben), Reihenfolge wie geliefert.
  const groups = new Map<string, ProjectTask[]>();
  for (const t of tasks) {
    const key = t.group_label?.trim() || "Aufgaben";
    (groups.get(key) ?? groups.set(key, []).get(key)!).push(t);
  }

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-xs">
        {open} von {tasks.length} Aufgaben offen
      </p>

      {[...groups.entries()].map(([label, list]) => (
        <div key={label}>
          {groups.size > 1 ? (
            <p className="text-muted-foreground mb-1 text-xs font-semibold">{label}</p>
          ) : null}
          <ul className="divide-y">
            {list.map((t) => {
              const done = t.status === "erledigt";
              const offered = t.status === "angeboten";
              const candidates = candidatesByTask[t.id] ?? [];
              const iAmCandidate = currentEmployeeId
                ? candidates.includes(currentEmployeeId)
                : false;
              const overdue = !done && t.due_date && new Date(t.due_date) < new Date();
              return (
                <li key={t.id} className="flex flex-wrap items-center gap-2 py-2">
                  <input
                    type="checkbox"
                    checked={done}
                    onChange={() => toggle(t)}
                    className="size-4 shrink-0"
                    title="Erledigt"
                  />
                  <span
                    className={cn(
                      "min-w-40 flex-1 text-sm",
                      done && "text-muted-foreground line-through",
                    )}
                  >
                    {t.title}
                    {offered ? (
                      <Badge variant="secondary" className="ml-2 align-middle">
                        angeboten an {candidates.map(empName).join(", ") || "—"}
                      </Badge>
                    ) : null}
                    {t.description ? (
                      <span className="text-muted-foreground block text-xs">
                        {t.description}
                      </span>
                    ) : null}
                  </span>

                  {iAmCandidate ? (
                    <Button size="sm" onClick={() => claim(t)}>
                      Annehmen
                    </Button>
                  ) : null}

                  <Input
                    type="date"
                    value={t.due_date ?? ""}
                    onChange={(e) => changeDue(t, e.target.value)}
                    className={cn(
                      "h-8 w-36",
                      overdue && "border-destructive text-destructive",
                    )}
                  />

                  <Select
                    value={offered ? UNASSIGNED : t.assignee_employee_id ?? UNASSIGNED}
                    onValueChange={(v) => changeAssignee(t, v)}
                  >
                    <SelectTrigger size="sm" className="h-8 w-40">
                      <SelectValue placeholder="Verantwortlich" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={UNASSIGNED}>—</SelectItem>
                      {employees.map((e) => (
                        <SelectItem key={e.id} value={e.id}>
                          {e.name ?? e.email ?? "Mitarbeiter"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <OfferDialog
                    employees={employees}
                    onOffer={(ids) =>
                      run(() => offerTask(fd(t, { employee_ids: ids.join(",") })))
                    }
                    trigger={
                      <Button variant="ghost" size="icon" className="size-8" title="Anbieten an mehrere">
                        <UserPlus className="size-4" />
                      </Button>
                    }
                  />

                  <TaskThread
                    taskId={t.id}
                    taskTitle={t.title}
                    currentEmployeeId={currentEmployeeId}
                    trigger={
                      <Button variant="ghost" size="icon" className="size-8" title="Verlauf / Chat">
                        <MessageSquare className="size-4" />
                      </Button>
                    }
                  />

                  {t.assignee_employee_id ? (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      title="Zurückgeben"
                      onClick={() => handBack(t)}
                    >
                      <Undo2 className="size-4" />
                    </Button>
                  ) : null}

                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    title="Aufgabe löschen"
                    onClick={() => remove(t)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </li>
              );
            })}
          </ul>
        </div>
      ))}

      {adding ? (
        <div className="flex gap-2">
          <Input
            autoFocus
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") add();
              if (e.key === "Escape") setAdding(false);
            }}
            placeholder="Neue Aufgabe"
            className="h-8"
          />
          <Button size="sm" onClick={add}>
            Hinzufügen
          </Button>
        </div>
      ) : (
        <Button variant="outline" size="sm" onClick={() => setAdding(true)}>
          <Plus className="size-4" /> Aufgabe
        </Button>
      )}
    </div>
  );
}

/** Auswahl-Dialog: Aufgabe mehreren Kollegen anbieten. */
function OfferDialog({
  employees,
  onOffer,
  trigger,
}: {
  employees: Employee[];
  onOffer: (ids: string[]) => void;
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
  const [sel, setSel] = React.useState<Set<string>>(new Set());

  function toggle(id: string) {
    setSel((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>An Kollegen anbieten</DialogTitle>
        </DialogHeader>
        <p className="text-muted-foreground text-sm">
          Wer zuerst annimmt, bekommt die Aufgabe — bei den anderen verschwindet sie.
        </p>
        <div className="max-h-64 space-y-1 overflow-y-auto">
          {employees.map((e) => (
            <label
              key={e.id}
              className="hover:bg-muted flex items-center gap-2 rounded-md px-2 py-1.5 text-sm"
            >
              <input
                type="checkbox"
                checked={sel.has(e.id)}
                onChange={() => toggle(e.id)}
                className="size-4"
              />
              {e.name ?? e.email ?? "Mitarbeiter"}
            </label>
          ))}
        </div>
        <DialogFooter>
          <Button
            disabled={sel.size === 0}
            onClick={() => {
              onOffer([...sel]);
              setSel(new Set());
              setOpen(false);
            }}
          >
            Anbieten
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
