"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { GripVertical, Plus, Trash2, Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

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
import { ProductPicker } from "@/components/produkte/product-picker";
import { updateOffer } from "@/app/(app)/angebot/actions";
import { calculate } from "@/lib/calc/engine";
import { POSITION_GROUPS, type CalcPosition, type PositionGroup } from "@/lib/calc/types";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Product, ProductGroup } from "@/lib/types";

export type OfferBlock = { kind: string; title: string | null; body: string | null };

const BLOCK_KINDS = [
  "intro",
  "art_der_anlage",
  "leistung",
  "nicht_enthalten",
  "optionale_leistungen",
  "zahlungsbedingungen",
  "gewaehrleistung",
  "gueltigkeit",
  "liefertermin",
  "schluss",
];

let seq = 0;
const uid = (p: string) => `${p}-${Date.now()}-${++seq}`;

function SortableRow({
  id,
  children,
}: {
  id: string;
  children: (handle: React.ReactNode) => React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  const handle = (
    <button
      type="button"
      className="text-muted-foreground hover:text-foreground mt-1 cursor-grab touch-none"
      {...attributes}
      {...listeners}
      title="Ziehen zum Verschieben"
    >
      <GripVertical className="size-4" />
    </button>
  );
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn("bg-card flex gap-2 rounded-lg border p-2", isDragging && "opacity-60 shadow-lg")}
    >
      {children(handle)}
    </div>
  );
}

export function OfferEditor({
  offerId,
  initialPositions,
  initialBlocks,
  products,
  productGroups = [],
  meta,
  context = "",
}: {
  offerId: string;
  initialPositions: CalcPosition[];
  initialBlocks: OfferBlock[];
  products: Product[];
  productGroups?: ProductGroup[];
  meta: {
    pauschalRabattPercent: number;
    nachlass: number;
    skontoPercent: number;
    mwstPerGroup?: Record<string, number>;
  };
  /** Projekt-/Kundenkontext für die KI-Textgenerierung. */
  context?: string;
}) {
  const router = useRouter();
  const [positions, setPositions] = React.useState<(CalcPosition & { _uid: string })[]>(
    () => initialPositions.map((p) => ({ ...p, _uid: p.id || uid("p") })),
  );
  const [blocks, setBlocks] = React.useState<(OfferBlock & { _uid: string })[]>(
    () => initialBlocks.map((b) => ({ ...b, _uid: uid("b") })),
  );
  const [genUid, setGenUid] = React.useState<string | null>(null);

  /** Textbaustein per KI erzeugen (nutzt Überschrift/Art + Projektkontext). */
  async function generateBlockText(b: OfferBlock & { _uid: string }) {
    setGenUid(b._uid);
    try {
      const res = await fetch("/api/ai/text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: `Schreibe einen Angebots-Textbaustein „${b.title || b.kind}" (2–4 Sätze, Sie-Form, ohne Anrede/Grußformel).`,
          context,
        }),
      });
      const data = (await res.json()) as { enabled?: boolean; text?: string | null };
      if (data.enabled === false) toast.error("KI ist nicht aktiviert.");
      else if (data.text) setBlocks((r) => r.map((x) => (x._uid === b._uid ? { ...x, body: data.text! } : x)));
      else toast.error("Kein Text erhalten.");
    } catch {
      toast.error("Generierung fehlgeschlagen.");
    } finally {
      setGenUid(null);
    }
  }
  const [saving, setSaving] = React.useState(false);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const totals = React.useMemo(
    () =>
      calculate({
        positions,
        pauschalRabattPercent: meta.pauschalRabattPercent,
        nachlass: meta.nachlass,
        mwstPercent: meta.mwstPerGroup?.["Sonstiges"] ?? 19,
        mwstPerGroup: meta.mwstPerGroup,
        skontoPercent: meta.skontoPercent,
      }).totals,
    [positions, meta],
  );

  function patchPos(u: string, p: Partial<CalcPosition>) {
    setPositions((rows) => rows.map((r) => (r._uid === u ? { ...r, ...p } : r)));
  }
  function onPosDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    setPositions((rows) => {
      const oldI = rows.findIndex((r) => r._uid === active.id);
      const newI = rows.findIndex((r) => r._uid === over.id);
      return arrayMove(rows, oldI, newI);
    });
  }
  function onBlockDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    setBlocks((rows) => {
      const oldI = rows.findIndex((r) => r._uid === active.id);
      const newI = rows.findIndex((r) => r._uid === over.id);
      return arrayMove(rows, oldI, newI);
    });
  }

  async function save() {
    setSaving(true);
    const fd = new FormData();
    fd.set("id", offerId);
    fd.set(
      "payload",
      JSON.stringify({
        positions: positions.map(({ _uid, ...p }) => ({ ...p, id: p.id || _uid })),
        blocks: blocks.map(({ _uid, ...b }) => b),
      }),
    );
    const res = await updateOffer(fd);
    setSaving(false);
    if (res.ok) {
      toast.success("Angebot gespeichert");
      router.refresh();
    } else {
      toast.error(res.error ?? "Speichern fehlgeschlagen");
    }
  }

  return (
    <div className="bg-muted/30 mb-6 rounded-xl border p-4 print:hidden">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-semibold">Angebot bearbeiten</h3>
        <Button size="sm" onClick={save} disabled={saving}>
          {saving ? "Speichern …" : "Speichern"}
        </Button>
      </div>

      {/* Positionen */}
      <p className="text-muted-foreground mb-1 text-xs font-semibold uppercase">Positionen</p>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onPosDragEnd}>
        <SortableContext items={positions.map((p) => p._uid)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {positions.map((p) => (
              <SortableRow key={p._uid} id={p._uid}>
                {(handle) => (
                  <>
                    {handle}
                    <div className="grid flex-1 gap-2 sm:grid-cols-[1fr_70px_70px_90px_70px_130px]">
                      <Input
                        value={p.bezeichnung}
                        onChange={(e) => patchPos(p._uid, { bezeichnung: e.target.value })}
                        placeholder="Bezeichnung"
                        className="h-8"
                      />
                      <Input
                        type="number"
                        value={p.menge}
                        onChange={(e) => patchPos(p._uid, { menge: Number(e.target.value) || 0 })}
                        title="Menge"
                        className="h-8"
                      />
                      <Input
                        value={p.einheit ?? ""}
                        onChange={(e) => patchPos(p._uid, { einheit: e.target.value })}
                        title="Einheit"
                        className="h-8"
                      />
                      <Input
                        type="number"
                        step="0.01"
                        value={p.einzelpreis}
                        onChange={(e) => patchPos(p._uid, { einzelpreis: Number(e.target.value) || 0 })}
                        title="Einzelpreis (netto)"
                        className="h-8"
                      />
                      <Input
                        type="number"
                        value={p.rabatt ?? 0}
                        onChange={(e) => patchPos(p._uid, { rabatt: Number(e.target.value) || 0 })}
                        title="Rabatt %"
                        className="h-8"
                      />
                      <Select
                        value={p.group ?? "Sonstiges"}
                        onValueChange={(v) => patchPos(p._uid, { group: v as PositionGroup })}
                      >
                        <SelectTrigger size="sm" className="h-8">
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
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      title="Löschen"
                      onClick={() => setPositions((r) => r.filter((x) => x._uid !== p._uid))}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </>
                )}
              </SortableRow>
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <div className="mt-2 flex items-center justify-between">
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              setPositions((r) => [
                ...r,
                { _uid: uid("p"), id: uid("p"), bezeichnung: "", menge: 1, einheit: "Stk", ek: 0, einzelpreis: 0, rabatt: 0, group: "PV-Anlage" },
              ])
            }
          >
            <Plus className="size-4" /> Position
          </Button>
          <ProductPicker
            products={products}
            groups={productGroups}
            onSelect={(prod) => {
              const u = uid("p");
              setPositions((r) => [
                ...r,
                { _uid: u, id: u, bezeichnung: prod.name, menge: 1, einheit: prod.unit ?? "Stk", ek: prod.price_purchase ?? 0, einzelpreis: prod.price_sell ?? 0, rabatt: 0, group: "PV-Anlage", product_id: prod.id },
              ]);
            }}
            trigger={
              <Button variant="outline" size="sm">
                <Plus className="size-4" /> Produkt
              </Button>
            }
          />
        </div>
        <div className="text-sm">
          Netto <span className="font-semibold">{formatCurrency(totals.netto)}</span> · Brutto{" "}
          <span className="text-primary font-semibold">{formatCurrency(totals.brutto)}</span>
        </div>
      </div>

      {/* Textbausteine */}
      <p className="text-muted-foreground mt-5 mb-1 text-xs font-semibold uppercase">
        Textbausteine (ziehen zum Umordnen)
      </p>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onBlockDragEnd}>
        <SortableContext items={blocks.map((b) => b._uid)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {blocks.map((b) => (
              <SortableRow key={b._uid} id={b._uid}>
                {(handle) => (
                  <>
                    {handle}
                    <div className="grid flex-1 gap-2">
                      <div className="flex gap-2">
                        <Select value={b.kind} onValueChange={(v) => setBlocks((r) => r.map((x) => (x._uid === b._uid ? { ...x, kind: v } : x)))}>
                          <SelectTrigger size="sm" className="h-8 w-44">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {BLOCK_KINDS.map((k) => (
                              <SelectItem key={k} value={k}>
                                {k}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Input
                          value={b.title ?? ""}
                          onChange={(e) => setBlocks((r) => r.map((x) => (x._uid === b._uid ? { ...x, title: e.target.value } : x)))}
                          placeholder="Überschrift"
                          className="h-8 flex-1"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 shrink-0"
                          title="Text per KI vorschlagen"
                          disabled={genUid === b._uid}
                          onClick={() => void generateBlockText(b)}
                        >
                          {genUid === b._uid ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
                          KI-Text
                        </Button>
                      </div>
                      <Textarea
                        value={b.body ?? ""}
                        onChange={(e) => setBlocks((r) => r.map((x) => (x._uid === b._uid ? { ...x, body: e.target.value } : x)))}
                        rows={2}
                        placeholder="Text"
                      />
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      title="Löschen"
                      onClick={() => setBlocks((r) => r.filter((x) => x._uid !== b._uid))}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </>
                )}
              </SortableRow>
            ))}
          </div>
        </SortableContext>
      </DndContext>
      <Button
        variant="outline"
        size="sm"
        className="mt-2"
        onClick={() => setBlocks((r) => [...r, { _uid: uid("b"), kind: "schluss", title: "", body: "" }])}
      >
        <Plus className="size-4" /> Baustein
      </Button>
    </div>
  );
}
