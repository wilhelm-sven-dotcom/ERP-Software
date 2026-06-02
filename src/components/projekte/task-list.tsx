"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  addTask,
  deleteTask,
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
}: {
  projectId: string;
  tasks: ProjectTask[];
  employees: Employee[];
}) {
  const router = useRouter();
  const [adding, setAdding] = React.useState(false);
  const [newTitle, setNewTitle] = React.useState("");

  const open = tasks.filter((t) => t.status !== "erledigt").length;

  async function toggle(task: ProjectTask) {
    const fd = new FormData();
    fd.set("id", task.id);
    fd.set("project_id", projectId);
    fd.set("done", String(task.status !== "erledigt"));
    await toggleTask(fd);
    router.refresh();
  }

  async function changeAssignee(task: ProjectTask, value: string) {
    const fd = new FormData();
    fd.set("id", task.id);
    fd.set("project_id", projectId);
    fd.set("assignee_employee_id", value === UNASSIGNED ? "" : value);
    fd.set("due_date", task.due_date ?? "");
    await updateTask(fd);
    router.refresh();
  }

  async function changeDue(task: ProjectTask, value: string) {
    const fd = new FormData();
    fd.set("id", task.id);
    fd.set("project_id", projectId);
    fd.set("assignee_employee_id", task.assignee_employee_id ?? "");
    fd.set("due_date", value);
    await updateTask(fd);
    router.refresh();
  }

  async function remove(task: ProjectTask) {
    const fd = new FormData();
    fd.set("id", task.id);
    fd.set("project_id", projectId);
    await deleteTask(fd);
    router.refresh();
  }

  async function add() {
    const v = newTitle.trim();
    if (!v) return;
    const fd = new FormData();
    fd.set("project_id", projectId);
    fd.set("title", v);
    const res = await addTask({ ok: false }, fd);
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

  return (
    <div className="space-y-3">
      <p className="text-muted-foreground text-xs">
        {open} von {tasks.length} Aufgaben offen
      </p>
      <ul className="divide-y">
        {tasks.map((t) => {
          const done = t.status === "erledigt";
          const overdue =
            !done && t.due_date && new Date(t.due_date) < new Date();
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
                {t.description ? (
                  <span className="text-muted-foreground block text-xs">
                    {t.description}
                  </span>
                ) : null}
              </span>
              <Input
                type="date"
                value={t.due_date ?? ""}
                onChange={(e) => changeDue(t, e.target.value)}
                className={cn("h-8 w-36", overdue && "border-destructive text-destructive")}
              />
              <Select
                value={t.assignee_employee_id ?? UNASSIGNED}
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
