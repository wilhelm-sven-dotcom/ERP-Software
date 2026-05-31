"use client";

import * as React from "react";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
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
import { addProjectActivity } from "@/app/(app)/projekte/actions";
import { type ActionResult } from "@/lib/actions";

const initial: ActionResult = { ok: false };

export function AddProjectActivityForm({
  projectId,
  customerId,
}: {
  projectId: string;
  customerId: string | null;
}) {
  const router = useRouter();
  const formRef = React.useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState(addProjectActivity, initial);

  React.useEffect(() => {
    if (state.ok) {
      toast.success("Aktivität hinzugefügt");
      formRef.current?.reset();
      router.refresh();
      state.ok = false;
    } else if (state.error) {
      toast.error(state.error);
    }
  }, [state, router]);

  return (
    <form ref={formRef} action={action} className="grid gap-3">
      <input type="hidden" name="project_id" value={projectId} />
      {customerId ? (
        <input type="hidden" name="customer_id" value={customerId} />
      ) : null}
      <div className="grid gap-3 sm:grid-cols-[160px_1fr]">
        <Select name="type" defaultValue="notiz">
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="notiz">Notiz</SelectItem>
            <SelectItem value="anruf">Anruf</SelectItem>
            <SelectItem value="email">E-Mail</SelectItem>
            <SelectItem value="termin">Termin</SelectItem>
            <SelectItem value="aufgabe">Aufgabe</SelectItem>
          </SelectContent>
        </Select>
        <Input name="title" placeholder="Titel der Aktivität" required />
      </div>
      <Textarea name="body" placeholder="Details (optional)" />
      <div>
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Speichern …" : "Aktivität hinzufügen"}
        </Button>
      </div>
    </form>
  );
}
