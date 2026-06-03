"use client";

import * as React from "react";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { Send } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createRueckfrage } from "@/app/(app)/workflow/actions";
import { type ActionResult } from "@/lib/actions";
import { cn } from "@/lib/utils";

const initial: ActionResult = { ok: false };

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

/** Apple-artiges Kompositionsfeld: schnell einem Kollegen eine Aufgabe/Rückfrage senden. */
export function QuickTask({
  employees,
  projects,
  onDone,
}: {
  employees: { id: string; name: string }[];
  projects: { id: string; title: string }[];
  onDone?: () => void;
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState(createRueckfrage, initial);
  const [sel, setSel] = React.useState<Set<string>>(new Set());
  const [projectId, setProjectId] = React.useState<string>("");
  const formRef = React.useRef<HTMLFormElement>(null);

  React.useEffect(() => {
    if (state.ok) {
      toast.success("Gesendet");
      formRef.current?.reset();
      setSel(new Set());
      setProjectId("");
      router.refresh();
      state.ok = false;
      onDone?.();
    } else if (state.error) {
      toast.error(state.error);
    }
  }, [state, router, onDone]);

  function toggle(id: string) {
    setSel((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <form ref={formRef} action={action} className="space-y-3">
      <input type="hidden" name="employee_ids" value={[...sel].join(",")} />
      <input type="hidden" name="project_id" value={projectId} />

      <div>
        <p className="text-muted-foreground mb-1.5 text-xs">An</p>
        <div className="flex flex-wrap gap-1.5">
          {employees.map((e) => {
            const active = sel.has(e.id);
            return (
              <button
                key={e.id}
                type="button"
                onClick={() => toggle(e.id)}
                className={cn(
                  "flex items-center gap-1.5 rounded-full border py-1 pr-3 pl-1 text-sm transition-colors",
                  active
                    ? "border-primary bg-primary/10 text-primary"
                    : "hover:bg-muted text-foreground/80",
                )}
              >
                <span
                  className={cn(
                    "grid size-6 place-items-center rounded-full text-[10px] font-semibold",
                    active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                  )}
                >
                  {initials(e.name)}
                </span>
                {e.name}
              </button>
            );
          })}
          {employees.length === 0 ? (
            <span className="text-muted-foreground text-sm">Keine Kollegen vorhanden.</span>
          ) : null}
        </div>
      </div>

      <Input name="title" placeholder="Betreff (z. B. Bitte Zählernummer prüfen)" required className="h-9" />
      <Textarea name="body" rows={2} placeholder="Nachricht (optional)" />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Select value={projectId} onValueChange={setProjectId}>
          <SelectTrigger size="sm" className="h-8 w-64">
            <SelectValue placeholder="Projekt (optional)" />
          </SelectTrigger>
          <SelectContent>
            {projects.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button type="submit" size="sm" disabled={pending || sel.size === 0}>
          <Send className="size-4" /> {pending ? "Senden …" : "Senden"}
        </Button>
      </div>
      <p className="text-muted-foreground text-xs">
        Ein Empfänger → direkt zugewiesen. Mehrere → angeboten (wer zuerst annimmt, übernimmt).
      </p>
    </form>
  );
}
