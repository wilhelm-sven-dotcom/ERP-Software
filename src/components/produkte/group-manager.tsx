"use client";

import * as React from "react";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronUp, Trash2 } from "lucide-react";
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
import {
  saveGroup,
  deleteGroup,
  reorderGroups,
} from "@/app/(app)/produkte/actions";
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
  // Lokale Reihenfolge (nach sort, dann Name) für sofortiges Umsortieren.
  const [order, setOrder] = React.useState<ProductGroup[]>(() =>
    [...groups].sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name)),
  );

  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOrder(
      [...groups].sort(
        (a, b) => a.sort - b.sort || a.name.localeCompare(b.name),
      ),
    );
  }, [groups]);

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

  async function move(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= order.length) return;
    const next = [...order];
    [next[index], next[target]] = [next[target], next[index]];
    setOrder(next);
    const res = await reorderGroups(next.map((g, i) => ({ id: g.id, sort: i })));
    if (!res.ok) {
      toast.error(res.error ?? "Reihenfolge konnte nicht gespeichert werden");
      router.refresh();
    }
  }

  return (
    <Dialog>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Produktgruppen</DialogTitle>
          <DialogDescription>
            Gruppen verwalten und mit den Pfeilen sortieren.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          {order.length === 0 ? (
            <p className="text-muted-foreground text-sm">Noch keine Gruppen.</p>
          ) : (
            order.map((g, i) => (
              <div
                key={g.id}
                className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
              >
                <span>{g.name}</span>
                <div className="flex items-center gap-0.5">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    title="Nach oben"
                    disabled={i === 0}
                    onClick={() => move(i, -1)}
                  >
                    <ChevronUp className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    title="Nach unten"
                    disabled={i === order.length - 1}
                    onClick={() => move(i, 1)}
                  >
                    <ChevronDown className="size-4" />
                  </Button>
                  <form action={deleteGroup}>
                    <input type="hidden" name="id" value={g.id} />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      type="submit"
                      title="Gruppe löschen"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </form>
                </div>
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
