"use client";

import * as React from "react";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { MessagesSquare } from "lucide-react";
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
import { createRueckfrage } from "@/app/(app)/workflow/actions";
import { type ActionResult } from "@/lib/actions";
import type { Employee } from "@/lib/types";

const initial: ActionResult = { ok: false };

/**
 * Rückfrage an Kollegen: erzeugt eine Aufgabe (einem zugewiesen oder mehreren
 * angeboten) inkl. erster Nachricht — landet beim Kollegen als Aufgabe mit Chat.
 */
export function RueckfrageDialog({
  projectId,
  employees,
}: {
  projectId: string;
  employees: Employee[];
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [sel, setSel] = React.useState<Set<string>>(new Set());
  const [state, action, pending] = useActionState(createRueckfrage, initial);

  React.useEffect(() => {
    if (state.ok && open) {
      toast.success("Rückfrage gesendet");
      setOpen(false);
      setSel(new Set());
      router.refresh();
      state.ok = false;
    } else if (state.error) {
      toast.error(state.error);
    }
  }, [state, open, router]);

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
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <MessagesSquare className="size-4" /> Rückfrage an Kollegen
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Rückfrage an Kollegen</DialogTitle>
          <DialogDescription>
            Wird beim Kollegen als Aufgabe mit Chat angezeigt. Bei mehreren gilt:
            wer zuerst annimmt, übernimmt.
          </DialogDescription>
        </DialogHeader>
        <form action={action} className="grid gap-3">
          <input type="hidden" name="project_id" value={projectId} />
          <input type="hidden" name="employee_ids" value={[...sel].join(",")} />
          <div className="grid gap-2">
            <Label htmlFor="title">Betreff</Label>
            <Input id="title" name="title" required placeholder="Worum geht es?" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="body">Nachricht</Label>
            <Textarea id="body" name="body" rows={3} placeholder="Deine Frage / Info …" />
          </div>
          <div className="grid gap-1">
            <Label>An wen?</Label>
            <div className="max-h-48 space-y-1 overflow-y-auto rounded-md border p-1">
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
          </div>
          <DialogFooter>
            <Button type="submit" disabled={pending || sel.size === 0}>
              {pending ? "Senden …" : "Senden"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
