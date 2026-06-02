"use client";

import * as React from "react";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { saveTimeEntry } from "@/app/(app)/zeiterfassung/actions";
import { type ActionResult } from "@/lib/actions";

const initial: ActionResult = { ok: false };

export function TimeEntryForm({
  projects,
  defaultProjectId,
}: {
  projects: { id: string; title: string | null }[];
  defaultProjectId?: string;
}) {
  const router = useRouter();
  const formRef = React.useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState(saveTimeEntry, initial);

  React.useEffect(() => {
    if (state.ok) {
      toast.success("Stunden erfasst");
      formRef.current?.reset();
      router.refresh();
      state.ok = false;
    } else if (state.error) {
      toast.error(state.error);
    }
  }, [state, router]);

  return (
    <form
      ref={formRef}
      action={action}
      className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_2fr_auto]"
    >
      <div className="grid gap-1.5">
        <Label htmlFor="project_id">Projekt</Label>
        <Select name="project_id" defaultValue={defaultProjectId}>
          <SelectTrigger id="project_id" className="w-full">
            <SelectValue placeholder="Projekt wählen" />
          </SelectTrigger>
          <SelectContent>
            {projects.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.title ?? "Projekt"}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="work_date">Datum</Label>
        <Input
          id="work_date"
          name="work_date"
          type="date"
          defaultValue={new Date().toISOString().slice(0, 10)}
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="hours">Stunden</Label>
        <Input id="hours" name="hours" type="number" step="0.25" min="0" required />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="activity">Tätigkeit</Label>
        <Input id="activity" name="activity" placeholder="z. B. Montage" />
      </div>
      <div className="flex items-end">
        <Button type="submit" disabled={pending}>
          {pending ? "Speichern …" : "Erfassen"}
        </Button>
      </div>
    </form>
  );
}
