"use client";

import * as React from "react";
import { Plus, Trash2 } from "lucide-react";
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
import { calculate } from "@/lib/calc/engine";
import type { CalcPosition } from "@/lib/calc/types";
import { saveCalculation } from "@/app/(app)/kalkulation/actions";
import { formatCurrency, formatNumber } from "@/lib/format";
import type { Product } from "@/lib/types";

let rowSeq = 0;
function newRow(): CalcPosition {
  rowSeq += 1;
  return {
    id: `tmp-${Date.now()}-${rowSeq}`,
    bezeichnung: "",
    menge: 1,
    einheit: "Stk",
    ek: 0,
    einzelpreis: 0,
    rabatt: 0,
  };
}

export function CalcEditor({
  projectId,
  calcId,
  initialPositions,
  initialMwst,
  initialGesamtRabatt,
  products,
}: {
  projectId: string;
  calcId: string | null;
  initialPositions: CalcPosition[];
  initialMwst: number;
  initialGesamtRabatt: number;
  products: Product[];
}) {
  const router = useRouter();
  const [positions, setPositions] = React.useState<CalcPosition[]>(
    initialPositions.length ? initialPositions : [newRow()],
  );
  const [mwst, setMwst] = React.useState(String(initialMwst));
  const [gesamtRabatt, setGesamtRabatt] = React.useState(
    String(initialGesamtRabatt),
  );
  const [saving, setSaving] = React.useState(false);

  const result = React.useMemo(
    () =>
      calculate({
        positions,
        mwstPercent: Number(mwst) || 0,
        gesamtRabattPercent: Number(gesamtRabatt) || 0,
      }),
    [positions, mwst, gesamtRabatt],
  );

  function update(id: string, patch: Partial<CalcPosition>) {
    setPositions((rows) =>
      rows.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    );
  }
  function remove(id: string) {
    setPositions((rows) => rows.filter((r) => r.id !== id));
  }
  function addRow() {
    setPositions((rows) => [...rows, newRow()]);
  }
  function applyProduct(id: string, productId: string) {
    const p = products.find((x) => x.id === productId);
    if (!p) return;
    update(id, {
      product_id: p.id,
      bezeichnung: p.name,
      einheit: p.unit ?? "Stk",
      ek: p.price_purchase ?? 0,
      einzelpreis: p.price_sell ?? 0,
    });
  }

  async function onSave() {
    setSaving(true);
    const fd = new FormData();
    fd.set("project_id", projectId);
    if (calcId) fd.set("calc_id", calcId);
    fd.set(
      "payload",
      JSON.stringify({
        positions,
        mwstPercent: Number(mwst) || 0,
        gesamtRabattPercent: Number(gesamtRabatt) || 0,
      }),
    );
    const res = await saveCalculation({ ok: false }, fd);
    setSaving(false);
    if (res.ok) {
      toast.success("Kalkulation gespeichert");
      router.refresh();
    } else {
      toast.error(res.error ?? "Fehler beim Speichern");
    }
  }

  const t = result.totals;

  return (
    <div className="space-y-4">
      <div className="bg-card overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-48">Bezeichnung</TableHead>
              <TableHead className="w-44">Produkt</TableHead>
              <TableHead className="w-20 text-right">Menge</TableHead>
              <TableHead className="w-20">Einheit</TableHead>
              <TableHead className="w-24 text-right">EK €</TableHead>
              <TableHead className="w-24 text-right">VK €</TableHead>
              <TableHead className="w-20 text-right">Rabatt %</TableHead>
              <TableHead className="w-28 text-right">Netto €</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {result.positions.map((p) => (
              <TableRow key={p.id}>
                <TableCell>
                  <Input
                    value={p.bezeichnung}
                    onChange={(e) =>
                      update(p.id, { bezeichnung: e.target.value })
                    }
                    className="h-8"
                  />
                </TableCell>
                <TableCell>
                  <Select onValueChange={(v) => applyProduct(p.id, v)}>
                    <SelectTrigger size="sm" className="h-8 w-full">
                      <SelectValue placeholder="übernehmen" />
                    </SelectTrigger>
                    <SelectContent>
                      {products.map((prod) => (
                        <SelectItem key={prod.id} value={prod.id}>
                          {prod.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <Input
                    type="number"
                    step="0.01"
                    value={p.menge}
                    onChange={(e) =>
                      update(p.id, { menge: Number(e.target.value) })
                    }
                    className="h-8 text-right"
                  />
                </TableCell>
                <TableCell>
                  <Input
                    value={p.einheit ?? ""}
                    onChange={(e) => update(p.id, { einheit: e.target.value })}
                    className="h-8"
                  />
                </TableCell>
                <TableCell>
                  <Input
                    type="number"
                    step="0.01"
                    value={p.ek ?? 0}
                    onChange={(e) =>
                      update(p.id, { ek: Number(e.target.value) })
                    }
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
                  <Input
                    type="number"
                    step="1"
                    value={p.rabatt ?? 0}
                    onChange={(e) =>
                      update(p.id, { rabatt: Number(e.target.value) })
                    }
                    className="h-8 text-right"
                  />
                </TableCell>
                <TableCell className="text-right font-medium">
                  {formatCurrency(p.positionNetto)}
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

      <Button variant="outline" size="sm" onClick={addRow}>
        <Plus className="size-4" /> Position
      </Button>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="flex flex-wrap items-end gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="mwst">MwSt</Label>
            <Select value={mwst} onValueChange={setMwst}>
              <SelectTrigger id="mwst" className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">0 % (PV-Nullsteuersatz)</SelectItem>
                <SelectItem value="19">19 %</SelectItem>
                <SelectItem value="7">7 %</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="grabatt">Gesamtrabatt %</Label>
            <Input
              id="grabatt"
              type="number"
              step="1"
              value={gesamtRabatt}
              onChange={(e) => setGesamtRabatt(e.target.value)}
              className="w-32"
            />
          </div>
        </div>

        <div className="bg-card space-y-1.5 rounded-lg border p-4 text-sm">
          <Row label="Zwischensumme" value={formatCurrency(t.zwischensumme)} />
          {t.sumRabatt > 0 ? (
            <Row label="Rabatt" value={`- ${formatCurrency(t.sumRabatt)}`} />
          ) : null}
          <Row label="Summe netto" value={formatCurrency(t.sumNetto)} strong />
          <Row
            label={`MwSt (${Number(mwst) || 0} %)`}
            value={formatCurrency(t.mwstBetrag)}
          />
          <Row
            label="Summe brutto"
            value={formatCurrency(t.sumBrutto)}
            strong
          />
          <div className="text-muted-foreground border-t pt-1.5 text-xs">
            <Row
              label="Deckungsbeitrag"
              value={`${formatCurrency(t.deckungsbeitrag)} (${formatNumber(
                t.margePercent,
                1,
              )} %)`}
            />
          </div>
        </div>
      </div>

      <div>
        <Button onClick={onSave} disabled={saving}>
          {saving ? "Speichern …" : "Kalkulation speichern"}
        </Button>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className={strong ? "font-semibold" : ""}>{label}</span>
      <span className={strong ? "font-semibold" : ""}>{value}</span>
    </div>
  );
}
