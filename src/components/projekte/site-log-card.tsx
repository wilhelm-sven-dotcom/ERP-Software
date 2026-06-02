"use client";

import * as React from "react";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { addSiteLogEntry, deleteSiteLogEntry } from "@/app/(app)/bautagebuch/actions";
import { type ActionResult } from "@/lib/actions";
import { formatDate } from "@/lib/format";
import type { SiteLogEntry } from "@/lib/types";

const initial: ActionResult = { ok: false };

export function SiteLogCard({
  projectId,
  entries,
}: {
  projectId: string;
  entries: SiteLogEntry[];
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState(addSiteLogEntry, initial);
  const [adding, setAdding] = React.useState(false);
  const formRef = React.useRef<HTMLFormElement>(null);

  React.useEffect(() => {
    if (state.ok) {
      toast.success("Eintrag gespeichert");
      formRef.current?.reset();
      setAdding(false);
      router.refresh();
      state.ok = false;
    } else if (state.error) {
      toast.error(state.error);
    }
  }, [state, router]);

  return (
    <div className="space-y-4">
      {entries.length === 0 ? (
        <p className="text-muted-foreground text-sm">Noch keine Bautagebuch-Einträge.</p>
      ) : (
        <ul className="space-y-3">
          {entries.map((e) => (
            <li key={e.id} className="rounded-lg border p-3 text-sm">
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="font-medium">{formatDate(e.log_date)}</span>
                <div className="flex items-center gap-2">
                  {e.weather ? (
                    <span className="text-muted-foreground text-xs">{e.weather}</span>
                  ) : null}
                  <form action={deleteSiteLogEntry}>
                    <input type="hidden" name="id" value={e.id} />
                    <input type="hidden" name="project_id" value={projectId} />
                    <Button variant="ghost" size="icon" className="size-7" type="submit" title="Löschen">
                      <Trash2 className="size-3.5" />
                    </Button>
                  </form>
                </div>
              </div>
              {e.crew ? (
                <p className="text-muted-foreground text-xs">Mannschaft: {e.crew}</p>
              ) : null}
              <p className="mt-1 whitespace-pre-wrap">{e.work_done}</p>
              {e.note ? (
                <p className="text-muted-foreground mt-1 text-xs whitespace-pre-wrap">{e.note}</p>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {adding ? (
        <form ref={formRef} action={action} className="grid gap-2 rounded-lg border p-3">
          <input type="hidden" name="project_id" value={projectId} />
          <div className="grid gap-2 sm:grid-cols-3">
            <Input name="log_date" type="date" defaultValue={new Date().toISOString().slice(0, 10)} className="h-9" />
            <Input name="weather" placeholder="Wetter" className="h-9" />
            <Input name="crew" placeholder="Mannschaft" className="h-9" />
          </div>
          <Textarea name="work_done" placeholder="Durchgeführte Arbeiten" rows={2} required />
          <Textarea name="note" placeholder="Bemerkungen (optional)" rows={2} />
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={pending}>
              {pending ? "Speichern …" : "Eintrag speichern"}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setAdding(false)}>
              Abbrechen
            </Button>
          </div>
        </form>
      ) : (
        <Button variant="outline" size="sm" onClick={() => setAdding(true)}>
          <Plus className="size-4" /> Eintrag
        </Button>
      )}
    </div>
  );
}
