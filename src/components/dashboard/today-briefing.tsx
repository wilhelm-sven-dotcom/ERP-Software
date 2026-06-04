import Link from "next/link";
import { CalendarClock, ListTodo, Inbox as InboxIcon } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getDispoEntries } from "@/lib/data/dispo";
import { getMyOpenTasks } from "@/lib/data/workflow";
import { getInbox } from "@/lib/data/notifications";

/**
 * Proaktives Tagesbriefing für den angemeldeten Nutzer: heutige Einsätze
 * (Plantafel), überfällige Aufgaben und Posteingang — immer sichtbar oben
 * im Dashboard. Datengestützt (keine KI-Kosten).
 */
export async function TodayBriefing({ employeeId }: { employeeId: string }) {
  const today = new Date().toISOString().slice(0, 10);
  const [dispo, tasks, inbox] = await Promise.all([
    getDispoEntries(today, today),
    getMyOpenTasks(employeeId),
    getInbox(employeeId),
  ]);
  const myDispo = dispo.filter((d) => d.employee_id === employeeId);
  const overdue = tasks.filter((t) => t.due_date && t.due_date < today);

  const dateLabel = new Intl.DateTimeFormat("de-DE", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  }).format(new Date());

  return (
    <Card className="mb-4">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Heute · {dateLabel}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-3">
        {/* Einsätze */}
        <div>
          <p className="text-muted-foreground mb-1 flex items-center gap-1 text-xs font-semibold">
            <CalendarClock className="size-3.5" /> Einsätze heute ({myDispo.length})
          </p>
          {myDispo.length === 0 ? (
            <p className="text-muted-foreground text-sm">Keine Einsätze geplant.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {myDispo.slice(0, 4).map((d) => (
                <li key={d.id} className="truncate">
                  {d.project ? (
                    <Link href={`/projekte/${d.project.id}`} className="hover:underline">
                      {d.title}
                    </Link>
                  ) : (
                    d.title
                  )}
                  {d.project?.title ? <span className="text-muted-foreground"> · {d.project.title}</span> : null}
                </li>
              ))}
            </ul>
          )}
          <Link href="/plantafel" className="text-primary text-xs hover:underline">Plantafel →</Link>
        </div>

        {/* Überfällige Aufgaben */}
        <div>
          <p className="text-muted-foreground mb-1 flex items-center gap-1 text-xs font-semibold">
            <ListTodo className="size-3.5" /> Überfällig ({overdue.length})
          </p>
          {overdue.length === 0 ? (
            <p className="text-muted-foreground text-sm">Nichts überfällig. 👍</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {overdue.slice(0, 4).map((t) => (
                <li key={t.id} className="text-destructive truncate">
                  {t.project ? (
                    <Link href={`/projekte/${t.project.id}`} className="hover:underline">{t.title}</Link>
                  ) : (
                    t.title
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Posteingang */}
        <div>
          <p className="text-muted-foreground mb-1 flex items-center gap-1 text-xs font-semibold">
            <InboxIcon className="size-3.5" /> Posteingang
          </p>
          <ul className="space-y-1 text-sm">
            <li>{inbox.offered.length} dir angeboten</li>
            <li>{inbox.unread.length} ungelesen</li>
            <li className={inbox.overdue.length > 0 ? "text-destructive" : ""}>{inbox.overdue.length} überfällig</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
