"use client";

import * as React from "react";
import { Minus, Plus, Split, Trash2 } from "lucide-react";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ProductPicker } from "@/components/produkte/product-picker";
import { round2 } from "@/lib/calc/engine";
import { POSITION_GROUPS, type CalcPosition, type PositionGroup } from "@/lib/calc/types";
import {
  deleteCalcTemplate,
  saveCalcTemplate,
} from "@/app/(app)/vorlagen/actions";
import type { CalcTemplate, Product, ProductGroup } from "@/lib/types";

let seq = 0;
function newRow(): CalcPosition {
  seq += 1;
  return {
    id: `tmp-${Date.now()}-${seq}`,
    bezeichnung: "",
    menge: 1,
    einheit: "Stk",
    ek: 0,
    einzelpreis: 0,
    group: "PV-Anlage",
  };
}

export function TemplateEditor({
  template,
  products,
  productGroups,
}: {
  template: CalcTemplate;
  products: Product[];
  productGroups: ProductGroup[];
}) {
  const router = useRouter();
  const d = (template.defaults ?? {}) as Record<string, unknown>;
  const [name, setName] = React.useState(template.name);
  const [positions, setPositions] = React.useState<CalcPosition[]>(
    Array.isArray(template.positions)
      ? (template.positions as CalcPosition[])
      : [],
  );
  const [mwst, setMwst] = React.useState(
    String(typeof d.mwstPercent === "number" ? d.mwstPercent : 0),
  );
  const [skonto, setSkonto] = React.useState(
    String(typeof d.skontoPercent === "number" ? d.skontoPercent : 0),
  );
  const [pauschal, setPauschal] = React.useState(
    String(typeof d.pauschalRabattPercent === "number" ? d.pauschalRabattPercent : 0),
  );
  const [nachlass, setNachlass] = React.useState(
    String(typeof d.nachlass === "number" ? d.nachlass : 0),
  );
  const [saving, setSaving] = React.useState(false);

  function update(id: string, patch: Partial<CalcPosition>) {
    setPositions((rows) => rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }
  function remove(id: string) {
    setPositions((rows) => rows.filter((r) => r.id !== id));
  }
  function applyProduct(id: string, p: Product) {
    const rawSplit = (p.specs as Record<string, unknown> | null)?.split_pv_pct;
    const splitPvPct =
      typeof rawSplit === "number" && Number.isFinite(rawSplit) ? rawSplit : null;
    update(id, {
      product_id: p.id,
      bezeichnung: p.name,
      einheit: p.unit ?? "Stk",
      ek: p.price_purchase ?? 0,
      einzelpreis: p.price_sell ?? 0,
      splitPvPct,
    });
  }

  async function onSave() {
    setSaving(true);
    const clean = positions
      .filter((p) => p.bezeichnung.trim() !== "")
      .map((p) => ({
        ...p,
        ek: p.ek === null || p.ek === undefined ? p.ek : round2(Number(p.ek)),
        einzelpreis: round2(Number(p.einzelpreis)),
      }));
    const fd = new FormData();
    fd.set("id", template.id);
    fd.set("name", name);
    fd.set("positions", JSON.stringify(clean));
    fd.set(
      "defaults",
      JSON.stringify({
        mwstPercent: Number(mwst) || 0,
        skontoPercent: Number(skonto) || 0,
        pauschalRabattPercent: Number(pauschal) || 0,
        nachlass: Number(nachlass) || 0,
      }),
    );
    const res = await saveCalcTemplate({ ok: false }, fd);
    setSaving(false);
    if (res.ok) {
      toast.success("Vorlage gespeichert");
      router.refresh();
    } else {
      toast.error(res.error ?? "Fehler beim Speichern");
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-[1fr_repeat(4,auto)] sm:items-end">
        <div className="grid gap-1.5">
          <Label htmlFor="name">Name</Label>
          <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="mwst">MwSt</Label>
          <Select value={mwst} onValueChange={setMwst}>
            <SelectTrigger id="mwst">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="0">0 % (PV)</SelectItem>
              <SelectItem value="19">19 %</SelectItem>
              <SelectItem value="7">7 %</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="skonto">Skonto %</Label>
          <Input
            id="skonto"
            type="number"
            step="0.1"
            value={skonto}
            onChange={(e) => setSkonto(e.target.value)}
            className="w-24"
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="pauschal">Pauschal %</Label>
          <Input
            id="pauschal"
            type="number"
            step="1"
            value={pauschal}
            onChange={(e) => setPauschal(e.target.value)}
            className="w-24"
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="nachlass">Nachlass €</Label>
          <Input
            id="nachlass"
            type="number"
            step="0.01"
            value={nachlass}
            onChange={(e) => setNachlass(e.target.value)}
            className="w-28"
          />
        </div>
      </div>

      <div className="bg-card overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-44">Bezeichnung</TableHead>
              <TableHead className="w-36">Produkt</TableHead>
              <TableHead className="w-44">Gruppe</TableHead>
              <TableHead className="w-32 text-right">Menge-Vorschlag</TableHead>
              <TableHead className="w-24 text-right">EK €</TableHead>
              <TableHead className="w-24 text-right">VK €</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {positions.map((p) => (
              <TableRow key={p.id}>
                <TableCell>
                  <Input
                    value={p.bezeichnung}
                    onChange={(e) => update(p.id, { bezeichnung: e.target.value })}
                    className="h-8"
                  />
                </TableCell>
                <TableCell>
                  <ProductPicker
                    products={products}
                    groups={productGroups}
                    onSelect={(prod) => applyProduct(p.id, prod)}
                    trigger={
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 w-full justify-start font-normal"
                      >
                        {p.product_id ? "ändern" : "wählen …"}
                      </Button>
                    }
                  />
                </TableCell>
                <TableCell>
                  {p.splitPvPct === null || p.splitPvPct === undefined ? (
                    <div className="flex items-center gap-1">
                      <Select
                        value={p.group ?? "Sonstiges"}
                        onValueChange={(v) =>
                          update(p.id, { group: v as PositionGroup })
                        }
                      >
                        <SelectTrigger size="sm" className="h-8 w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {POSITION_GROUPS.map((g) => (
                            <SelectItem key={g} value={g}>
                              {g}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-8 shrink-0"
                        title="Als Hybrid aufteilen (PV/Speicher)"
                        onClick={() => update(p.id, { splitPvPct: 50 })}
                      >
                        <Split className="size-4" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1">
                      <div className="flex items-center gap-1 rounded-md border px-1.5">
                        <span className="text-muted-foreground text-xs">PV</span>
                        <Input
                          type="number"
                          step="1"
                          min={0}
                          max={100}
                          value={p.splitPvPct}
                          onChange={(e) =>
                            update(p.id, {
                              splitPvPct: Math.min(
                                Math.max(Number(e.target.value) || 0, 0),
                                100,
                              ),
                            })
                          }
                          className="h-7 w-12 border-0 px-1 text-right shadow-none focus-visible:ring-0"
                        />
                        <span className="text-muted-foreground text-xs">
                          % / Sp {100 - (Number(p.splitPvPct) || 0)} %
                        </span>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-8 shrink-0"
                        title="Aufteilung entfernen"
                        onClick={() => update(p.id, { splitPvPct: null })}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-0.5">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="size-7 shrink-0"
                      onClick={() =>
                        update(p.id, {
                          menge: Math.max((Number(p.menge) || 0) - 1, 0),
                        })
                      }
                    >
                      <Minus className="size-3" />
                    </Button>
                    <Input
                      type="number"
                      step="1"
                      value={p.menge}
                      onChange={(e) =>
                        update(p.id, { menge: Number(e.target.value) })
                      }
                      className="h-8 w-14 text-right"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="size-7 shrink-0"
                      onClick={() =>
                        update(p.id, { menge: (Number(p.menge) || 0) + 1 })
                      }
                    >
                      <Plus className="size-3" />
                    </Button>
                  </div>
                </TableCell>
                <TableCell>
                  <Input
                    type="number"
                    step="0.01"
                    value={p.ek ?? 0}
                    onChange={(e) => update(p.id, { ek: Number(e.target.value) })}
                    className="h-8 text-right"
                  />
                </TableCell>
                <TableCell>
                  <Input
                    type="number"
                    step="0.01"
                    value={p.einzelpreis}
                    onChange={(e) =>
                      update(p.id, { einzelpreis: Number(e.target.value) })
                    }
                    className="h-8 text-right"
                  />
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => remove(p.id)}
                    title="Position entfernen"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setPositions((rows) => [...rows, newRow()])}
        >
          <Plus className="size-4" /> Position
        </Button>
        <span className="text-muted-foreground text-xs">
          {positions.length} Positionen
        </span>
      </div>

      <div className="flex items-center justify-between">
        <Button onClick={onSave} disabled={saving}>
          {saving ? "Speichern …" : "Vorlage speichern"}
        </Button>
        <form action={deleteCalcTemplate}>
          <input type="hidden" name="id" value={template.id} />
          <Button variant="ghost" size="sm" type="submit">
            <Trash2 className="size-4" /> Vorlage löschen
          </Button>
        </form>
      </div>
    </div>
  );
}
