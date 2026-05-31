"use client";

import * as React from "react";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { saveGroup, deleteGroup } from "@/app/(app)/produkte/actions";
import { type ActionResult } from "@/lib/actions";
import type { ProductGroup } from "@/lib/types";

const initial: ActionResult = { ok: false };

export function GroupManager({
  groups,
  trigger,
}: {
  groups: ProductGroup[];
  trigger: React.ReactNode;
}) {
  const router = useRouter();
  const formRef = React.useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState(saveGroup, initial);

  React.useEffect(() => {
    if (state.ok) {
      toast.success("Gruppe angelegt");
      formRef.current?.reset();
      router.refresh();
      state.ok = false;
    } else if (state.error) {
      toast.error(state.error);
    }
  }, [state, router]);

  return (
    <Dialog>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Produktgruppen</DialogTitle>
          <DialogDescription>
            Gruppen zur Kategorisierung des Katalogs verwalten.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          {groups.length === 0 ? (
            <p className="text-muted-foreground text-sm">Noch keine Gruppen.</p>
          ) : (
            groups.map((g) => (
              <div
                key={g.id}
                className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
              >
                <span>{g.name}</span>
                <form action={deleteGroup}>
                  <input type="hidden" name="id" value={g.id} />
                  <Button
                    variant="ghost"
                    size="icon"
                    type="submit"
                    title="Gruppe löschen"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </form>
              </div>
            ))
          )}
        </div>

        <form ref={formRef} action={action} className="flex gap-2 pt-2">
          <Input name="name" placeholder="Neue Gruppe" required />
          <Button type="submit" disabled={pending}>
            Hinzufügen
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
