"use client";

import * as React from "react";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Trash2 } from "lucide-react";
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
  saveWorkflowStep,
  deleteWorkflowStep,
} from "@/app/(app)/workflow/actions";
import { type ActionResult } from "@/lib/actions";
import type { WorkflowStep } from "@/lib/types";

const initial: ActionResult = { ok: false };

export function WorkflowStepManager({
  templateId,
  steps,
  depsByStep = {},
}: {
  templateId: string;
  steps: WorkflowStep[];
  /** step_id → Vorgänger-step_ids. */
  depsByStep?: Record<string, string[]>;
}) {
  const titleById = new Map(steps.map((s) => [s.id, s.title]));
  return (
    <div className="space-y-2">
      {steps.length === 0 ? (
        <p className="text-muted-foreground text-sm">Noch keine Schritte.</p>
      ) : (
        <ol className="divide-y rounded-md border">
          {steps.map((st) => {
            const preds = (depsByStep[st.id] ?? [])
              .map((id) => titleById.get(id))
              .filter(Boolean) as string[];
            return (
              <li key={st.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                <span className="text-muted-foreground w-10 shrink-0 text-right">
                  +{st.offset_days}T
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium">
                    {st.title}
                    {st.group_label ? (
                      <span className="bg-muted text-muted-foreground ml-2 rounded px-1.5 py-0.5 text-[10px]">
                        {st.group_label}
                      </span>
                    ) : null}
                  </p>
                  {st.description ? (
                    <p className="text-muted-foreground truncate text-xs">
                      {st.description}
                    </p>
                  ) : null}
                  {preds.length > 0 ? (
                    <p className="text-muted-foreground text-xs">
                      ↳ nach: {preds.join(", ")}
                    </p>
                  ) : null}
                </div>
                <div className="flex shrink-0 items-center gap-0.5">
                  <StepDialog
                    templateId={templateId}
                    step={st}
                    siblings={steps}
                    selectedDeps={depsByStep[st.id] ?? []}
                    trigger={
                      <Button variant="ghost" size="icon" className="size-8" title="Bearbeiten">
                        <Pencil className="size-4" />
                      </Button>
                    }
                  />
                  <form action={deleteWorkflowStep}>
                    <input type="hidden" name="id" value={st.id} />
                    <Button variant="ghost" size="icon" className="size-8" type="submit" title="Löschen">
                      <Trash2 className="size-4" />
                    </Button>
                  </form>
                </div>
              </li>
            );
          })}
        </ol>
      )}
      <StepDialog
        templateId={templateId}
        nextSort={steps.length}
        siblings={steps}
        selectedDeps={[]}
        trigger={
          <Button variant="outline" size="sm">
            <Plus className="size-4" /> Schritt
          </Button>
        }
      />
    </div>
  );
}

function StepDialog({
  templateId,
  step,
  nextSort = 0,
  siblings,
  selectedDeps,
  trigger,
}: {
  templateId: string;
  step?: WorkflowStep;
  nextSort?: number;
  siblings: WorkflowStep[];
  selectedDeps: string[];
  trigger: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [state, action, pending] = useActionState(saveWorkflowStep, initial);
  const [deps, setDeps] = React.useState<Set<string>>(new Set(selectedDeps));

  React.useEffect(() => {
    if (open) setDeps(new Set(selectedDeps));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  React.useEffect(() => {
    if (state.ok && open) {
      toast.success("Schritt gespeichert");
      setOpen(false);
      router.refresh();
      state.ok = false;
    } else if (state.error) {
      toast.error(state.error);
    }
  }, [state, open, router]);

  function toggleDep(id: string) {
    setDeps((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const others = siblings.filter((s) => s.id !== step?.id);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{step ? "Schritt bearbeiten" : "Neuer Schritt"}</DialogTitle>
          <DialogDescription>Schritt im Ablauf.</DialogDescription>
        </DialogHeader>
        <form action={action} className="grid gap-4">
          <input type="hidden" name="template_id" value={templateId} />
          {step ? <input type="hidden" name="id" value={step.id} /> : null}
          <input type="hidden" name="depends_on" value={[...deps].join(",")} />
          <div className="grid gap-2">
            <Label htmlFor="title">Titel</Label>
            <Input id="title" name="title" defaultValue={step?.title ?? ""} required />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="description">Beschreibung</Label>
            <Textarea
              id="description"
              name="description"
              defaultValue={step?.description ?? ""}
              rows={3}
            />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="grid gap-2">
              <Label htmlFor="offset_days">Fälligkeit (+Tage)</Label>
              <Input
                id="offset_days"
                name="offset_days"
                type="number"
                defaultValue={step?.offset_days ?? 0}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="group_label">Phase</Label>
              <Input
                id="group_label"
                name="group_label"
                defaultValue={step?.group_label ?? ""}
                placeholder="z. B. Planung"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="sort">Sortierung</Label>
              <Input
                id="sort"
                name="sort"
                type="number"
                defaultValue={step?.sort ?? nextSort}
              />
            </div>
          </div>

          {others.length > 0 ? (
            <div className="grid gap-2">
              <Label>Vorgänger (müssen vorher erledigt sein)</Label>
              <div className="max-h-40 space-y-1 overflow-y-auto rounded-md border p-2">
                {others.map((o) => (
                  <label
                    key={o.id}
                    className="hover:bg-muted flex items-center gap-2 rounded px-1.5 py-1 text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={deps.has(o.id)}
                      onChange={() => toggleDep(o.id)}
                      className="size-4"
                    />
                    {o.title}
                  </label>
                ))}
              </div>
            </div>
          ) : null}

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
