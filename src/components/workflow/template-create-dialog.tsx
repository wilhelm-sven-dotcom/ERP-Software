"use client";

import * as React from "react";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createWorkflowTemplate } from "@/app/(app)/workflow/actions";
import { type ActionResult } from "@/lib/actions";

const initial: ActionResult = { ok: false };

export function TemplateCreateDialog() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [phase, setPhase] = React.useState("projekt");
  const [state, action, pending] = useActionState(createWorkflowTemplate, initial);

  React.useEffect(() => {
    if (state.ok && open) {
      toast.success("Vorlage angelegt");
      setOpen(false);
      router.refresh();
      state.ok = false;
    } else if (state.error) {
      toast.error(state.error);
    }
  }, [state, open, router]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="size-4" /> Neue Vorlage
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Neue Ablaufvorlage</DialogTitle>
          <DialogDescription>
            Vorlage für eine Projektart oder den Vertriebsablauf.
          </DialogDescription>
        </DialogHeader>
        <form action={action} className="grid gap-4">
          <input type="hidden" name="phase" value={phase} />
          <div className="grid gap-2">
            <Label htmlFor="name">Name</Label>
            <Input id="name" name="name" required placeholder="z. B. Wärmepumpe Standard" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="phase">Art</Label>
            <Select value={phase} onValueChange={setPhase}>
              <SelectTrigger id="phase" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="projekt">Projektablauf</SelectItem>
                <SelectItem value="vertrieb">Vertriebsablauf</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {phase === "projekt" ? (
            <div className="grid gap-2">
              <Label htmlFor="project_type">Anlagentyp</Label>
              <Input
                id="project_type"
                name="project_type"
                placeholder="z. B. Wärmepumpe (frei wählbar)"
              />
              <p className="text-muted-foreground text-xs">
                Dieser Typ wird beim Anlegen eines Projekts auswählbar und steuert,
                welche Vorlage beim Start des Ablaufs greift.
              </p>
            </div>
          ) : null}
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Anlegen …" : "Vorlage anlegen"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
