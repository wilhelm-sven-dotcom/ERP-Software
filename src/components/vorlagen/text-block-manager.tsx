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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { saveTextBlock, deleteTextBlock } from "@/app/(app)/vorlagen/actions";
import { type ActionResult } from "@/lib/actions";
import { PROJECT_TYPES } from "@/lib/constants";
import type { OfferTextBlock, TextBlockKind } from "@/lib/types";

const initial: ActionResult = { ok: false };

export const BLOCK_KINDS: { value: TextBlockKind; label: string }[] = [
  { value: "intro", label: "Einleitung" },
  { value: "art_der_anlage", label: "Art der Anlage" },
  { value: "leistung", label: "Leistung je Kategorie" },
  { value: "nicht_enthalten", label: "Explizit nicht enthalten" },
  { value: "zahlungsbedingungen", label: "Zahlungsbedingungen" },
  { value: "gewaehrleistung", label: "Gewährleistung" },
  { value: "gueltigkeit", label: "Gültigkeit" },
  { value: "liefertermin", label: "Liefertermin" },
  { value: "optionale_leistungen", label: "Optionale Leistungen" },
  { value: "schluss", label: "Schlusswort" },
];
const kindLabel = (k: string) =>
  BLOCK_KINDS.find((b) => b.value === k)?.label ?? k;

const STANDARD = "__standard__";

export function TextBlockManager({ blocks }: { blocks: OfferTextBlock[] }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-sm">
          Bausteine je Anlagentyp; „Standard" gilt für alle Typen, sofern kein
          typ-spezifischer Baustein existiert.
        </p>
        <BlockDialog
          trigger={
            <Button size="sm" variant="outline">
              <Plus className="size-4" /> Baustein
            </Button>
          }
        />
      </div>
      {blocks.length === 0 ? (
        <p className="text-muted-foreground text-sm">Noch keine Bausteine.</p>
      ) : (
        <div className="divide-y rounded-lg border">
          {blocks.map((b) => (
            <div key={b.id} className="flex items-start gap-3 px-3 py-2 text-sm">
              <div className="min-w-0 flex-1">
                <p className="font-medium">
                  {kindLabel(b.kind)}
                  {b.title && b.title !== kindLabel(b.kind) ? ` · ${b.title}` : ""}
                  <span className="text-muted-foreground font-normal">
                    {" "}
                    — {b.project_type ?? "Standard"}
                  </span>
                </p>
                <p className="text-muted-foreground line-clamp-2 whitespace-pre-wrap">
                  {b.body}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-0.5">
                <BlockDialog
                  block={b}
                  trigger={
                    <Button variant="ghost" size="icon" className="size-8" title="Bearbeiten">
                      <Pencil className="size-4" />
                    </Button>
                  }
                />
                <form action={deleteTextBlock}>
                  <input type="hidden" name="id" value={b.id} />
                  <Button variant="ghost" size="icon" className="size-8" type="submit" title="Löschen">
                    <Trash2 className="size-4" />
                  </Button>
                </form>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function BlockDialog({
  block,
  trigger,
}: {
  block?: OfferTextBlock;
  trigger: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [state, action, pending] = useActionState(saveTextBlock, initial);

  React.useEffect(() => {
    if (state.ok && open) {
      toast.success("Baustein gespeichert");
      setOpen(false);
      router.refresh();
      state.ok = false;
    } else if (state.error) {
      toast.error(state.error);
    }
  }, [state, open, router]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{block ? "Baustein bearbeiten" : "Neuer Baustein"}</DialogTitle>
          <DialogDescription>Text für das Angebot.</DialogDescription>
        </DialogHeader>
        <form action={action} className="grid gap-4">
          {block ? <input type="hidden" name="id" value={block.id} /> : null}
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="kind">Art</Label>
              <Select name="kind" defaultValue={block?.kind ?? "intro"}>
                <SelectTrigger id="kind" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BLOCK_KINDS.map((k) => (
                    <SelectItem key={k.value} value={k.value}>
                      {k.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="project_type">Anlagentyp</Label>
              <Select
                name="project_type"
                defaultValue={block?.project_type ?? STANDARD}
              >
                <SelectTrigger id="project_type" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={STANDARD}>Standard (alle)</SelectItem>
                  {PROJECT_TYPES.map((pt) => (
                    <SelectItem key={pt} value={pt}>
                      {pt}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="title">Titel (optional, z. B. Kategorie bei „Leistung")</Label>
            <Input id="title" name="title" defaultValue={block?.title ?? ""} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="body">Text</Label>
            <Textarea
              id="body"
              name="body"
              defaultValue={block?.body ?? ""}
              rows={8}
            />
          </div>
          <input type="hidden" name="sort" value={block?.sort ?? 0} />
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
