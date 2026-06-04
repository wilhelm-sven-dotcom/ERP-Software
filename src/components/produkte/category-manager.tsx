"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, ChevronUp, Pencil, Trash2, X } from "lucide-react";
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
  addListValue,
  deleteCategory,
  renameCategory,
  reorderCategories,
} from "@/app/(app)/produkte/actions";

/**
 * Kategorien verwalten: anlegen, umbenennen, löschen und sortieren. Die
 * Reihenfolge steuert, wie Produkte innerhalb jeder Gruppe gegliedert werden.
 */
export function CategoryManager({
  categories,
  trigger,
}: {
  categories: string[];
  trigger: React.ReactNode;
}) {
  const router = useRouter();
  const [list, setList] = React.useState<string[]>(categories);
  const [newName, setNewName] = React.useState("");
  const [editIndex, setEditIndex] = React.useState<number | null>(null);
  const [editValue, setEditValue] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setList(categories);
  }, [categories]);

  async function move(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= list.length) return;
    const next = [...list];
    [next[index], next[target]] = [next[target], next[index]];
    setList(next);
    const res = await reorderCategories(next);
    if (!res.ok) {
      toast.error(res.error ?? "Reihenfolge nicht gespeichert");
      router.refresh();
    }
  }

  async function add() {
    const v = newName.trim();
    if (!v) return;
    setBusy(true);
    const res = await addListValue("categories", v);
    setBusy(false);
    if (res.ok) {
      if (res.list) setList(res.list);
      setNewName("");
      router.refresh();
    } else {
      toast.error(res.error ?? "Konnte nicht anlegen");
    }
  }

  async function saveRename(index: number) {
    const to = editValue.trim();
    const from = list[index];
    setEditIndex(null);
    if (!to || to === from) return;
    setBusy(true);
    const res = await renameCategory(from, to);
    setBusy(false);
    if (res.ok) {
      if (res.list) setList(res.list);
      toast.success("Kategorie umbenannt");
      router.refresh();
    } else {
      toast.error(res.error ?? "Umbenennen fehlgeschlagen");
    }
  }

  async function remove(name: string) {
    setBusy(true);
    const res = await deleteCategory(name);
    setBusy(false);
    if (res.ok) {
      if (res.list) setList(res.list);
      router.refresh();
    } else {
      toast.error(res.error ?? "Löschen fehlgeschlagen");
    }
  }

  return (
    <Dialog>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Kategorien</DialogTitle>
          <DialogDescription>
            Umbenennen, löschen und sortieren. Die Reihenfolge bestimmt die
            Gliederung innerhalb jeder Produktgruppe.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          {list.length === 0 ? (
            <p className="text-muted-foreground text-sm">Noch keine Kategorien.</p>
          ) : (
            list.map((c, i) => (
              <div
                key={c}
                className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm"
              >
                {editIndex === i ? (
                  <Input
                    autoFocus
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") saveRename(i);
                      if (e.key === "Escape") setEditIndex(null);
                    }}
                    className="h-8"
                  />
                ) : (
                  <span className="truncate">{c}</span>
                )}
                <div className="flex shrink-0 items-center gap-0.5">
                  {editIndex === i ? (
                    <>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        title="Speichern"
                        onClick={() => saveRename(i)}
                      >
                        <Check className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        title="Abbrechen"
                        onClick={() => setEditIndex(null)}
                      >
                        <X className="size-4" />
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        title="Nach oben"
                        disabled={i === 0 || busy}
                        onClick={() => move(i, -1)}
                      >
                        <ChevronUp className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        title="Nach unten"
                        disabled={i === list.length - 1 || busy}
                        onClick={() => move(i, 1)}
                      >
                        <ChevronDown className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        title="Umbenennen"
                        onClick={() => {
                          setEditIndex(i);
                          setEditValue(c);
                        }}
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        title="Kategorie löschen"
                        disabled={busy}
                        onClick={() => remove(c)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        <div className="flex gap-2 pt-2">
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") add();
            }}
            placeholder="Neue Kategorie"
          />
          <Button onClick={add} disabled={busy}>
            Hinzufügen
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
