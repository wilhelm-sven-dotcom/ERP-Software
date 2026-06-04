"use client";

import * as React from "react";
import { FileDown } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatCurrency } from "@/lib/format";
import type { CalcPosition } from "@/lib/calc/types";
import type { CalcTemplate } from "@/lib/types";

/**
 * Vorlage übernehmen mit Häkchen-Auswahl: Nutzer wählt eine Vorlage und hakt die
 * gewünschten Positionen an. Nur die ausgewählten werden in die Kalkulation
 * geladen — so kann man Überflüssiges direkt aussortieren.
 */
export function TemplateLoadDialog({
  templates,
  onApply,
}: {
  templates: CalcTemplate[];
  onApply: (
    positions: CalcPosition[],
    defaults: Record<string, unknown>,
    templateName: string,
  ) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [templateId, setTemplateId] = React.useState<string>("");
  const [checked, setChecked] = React.useState<Set<number>>(new Set());

  const tpl = templates.find((t) => t.id === templateId) ?? null;
  const positions = React.useMemo(
    () =>
      (tpl && Array.isArray(tpl.positions)
        ? (tpl.positions as CalcPosition[])
        : []),
    [tpl],
  );

  function choose(id: string) {
    setTemplateId(id);
    const t = templates.find((x) => x.id === id);
    const count = Array.isArray(t?.positions) ? t!.positions.length : 0;
    setChecked(new Set(Array.from({ length: count }, (_, i) => i)));
  }

  function toggle(i: number) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }

  function apply() {
    if (!tpl) return;
    const selected = positions.filter((_, i) => checked.has(i));
    if (selected.length === 0) {
      toast.error("Bitte mindestens eine Position auswählen.");
      return;
    }
    onApply(
      selected,
      (tpl.defaults ?? {}) as Record<string, unknown>,
      tpl.name,
    );
    setOpen(false);
    setTemplateId("");
    setChecked(new Set());
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) {
          setTemplateId("");
          setChecked(new Set());
        }
      }}
    >
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <FileDown className="size-4" /> Vorlage übernehmen …
      </Button>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Vorlage übernehmen</DialogTitle>
          <DialogDescription>
            Vorlage wählen und die zu übernehmenden Positionen anhaken.
          </DialogDescription>
        </DialogHeader>

        <Select value={templateId} onValueChange={choose}>
          <SelectTrigger>
            <SelectValue placeholder="Vorlage wählen …" />
          </SelectTrigger>
          <SelectContent>
            {templates.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {tpl ? (
          positions.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              Diese Vorlage enthält keine Positionen.
            </p>
          ) : (
            <ul className="divide-y rounded-md border">
              {positions.map((p, i) => (
                <li key={i}>
                  <label className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm">
                    <input
                      type="checkbox"
                      checked={checked.has(i)}
                      onChange={() => toggle(i)}
                      className="size-4"
                    />
                    <span className="flex-1">
                      {p.bezeichnung || "—"}
                      <span className="text-muted-foreground">
                        {p.group ? ` · ${p.group}` : ""}
                      </span>
                    </span>
                    <span className="text-muted-foreground">
                      {formatCurrency(p.einzelpreis)}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          )
        ) : null}

        <DialogFooter>
          <Button onClick={apply} disabled={!tpl || checked.size === 0}>
            {checked.size > 0
              ? `${checked.size} Positionen übernehmen`
              : "Übernehmen"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
