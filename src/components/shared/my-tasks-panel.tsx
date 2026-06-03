"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MessageSquare, Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import { TaskThread } from "@/components/projekte/task-thread";
import { toggleTask } from "@/app/(app)/workflow/actions";
import { formatDate } from "@/lib/format";

type Task = {
  id: string;
  title: string;
  due_date: string | null;
  project: { id: string; title: string | null } | null;
};

/** Interaktive „Meine Aufgaben"-Liste: Chat + Erledigt, auch für projektlose Aufgaben. */
export function MyTasksPanel({
  tasks,
  currentEmployeeId,
  readOnly = false,
}: {
  tasks: Task[];
  currentEmployeeId: string | null;
  readOnly?: boolean;
}) {
  const router = useRouter();
  const today = new Date().toISOString().slice(0, 10);

  async function done(t: Task) {
    const fd = new FormData();
    fd.set("id", t.id);
    if (t.project) fd.set("project_id", t.project.id);
    fd.set("done", "true");
    await toggleTask(fd);
    router.refresh();
  }

  if (tasks.length === 0) {
    return <p className="text-muted-foreground text-sm">Keine offenen Aufgaben. 🎉</p>;
  }

  const groups: { label: string; tone?: string; items: Task[] }[] = [
    { label: "Überfällig", tone: "text-destructive", items: tasks.filter((t) => t.due_date && t.due_date < today) },
    { label: "Heute", items: tasks.filter((t) => t.due_date === today) },
    { label: "Als Nächstes", items: tasks.filter((t) => !t.due_date || t.due_date > today) },
  ];

  return (
    <div className="space-y-4">
      {groups.map((g) =>
        g.items.length === 0 ? null : (
          <div key={g.label}>
            <p className={`mb-1 text-xs font-semibold ${g.tone ?? "text-muted-foreground"}`}>
              {g.label} ({g.items.length})
            </p>
            <ul className="divide-y">
              {g.items.map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                  <span className="min-w-0 flex-1">
                    {t.title}
                    {t.project ? (
                      <Link
                        href={`/projekte/${t.project.id}`}
                        className="text-muted-foreground ml-2 text-xs hover:underline"
                      >
                        {t.project.title ?? "Projekt"}
                      </Link>
                    ) : null}
                  </span>
                  <span className="text-muted-foreground shrink-0 text-xs">
                    {t.due_date ? formatDate(t.due_date) : ""}
                  </span>
                  {readOnly ? null : (
                    <>
                      <TaskThread
                        taskId={t.id}
                        taskTitle={t.title}
                        currentEmployeeId={currentEmployeeId}
                        trigger={
                          <Button variant="ghost" size="icon" className="size-8" title="Chat / Verlauf">
                            <MessageSquare className="size-4" />
                          </Button>
                        }
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        title="Erledigt"
                        onClick={() => done(t)}
                      >
                        <Check className="size-4" />
                      </Button>
                    </>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ),
      )}
    </div>
  );
}
