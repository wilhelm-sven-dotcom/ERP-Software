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
import { calculate, round2 } from "@/lib/calc/engine";
import { POSITION_GROUPS, type CalcPosition, type PositionGroup } from "@/lib/calc/types";
import { saveCalculation } from "@/app/(app)/kalkulation/actions";
import { ProductPicker } from "@/components/produkte/product-picker";
import { TemplateLoadDialog } from "@/components/kalkulation/template-load-dialog";
import { formatCurrency, formatNumber } from "@/lib/format";
import type { CalcTemplate, Product, ProductGroup } from "@/lib/types";

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
    group: "PV-Anlage",
  };
}

export function CalcEditor({
  projectId,
  calcId,
  calcName = "Standard",
  initialPositions,
  initialPauschalRabatt,
  initialNachlass,
  initialSkonto,
  vatPerGroup,
  systemSizeKwp,
  storageKwh,
  products,
  productGroups = [],
  templates = [],
}: {
  projectId: string;
  calcId: string | null;
  calcName?: string;
  initialPositions: CalcPosition[];
  initialPauschalRabatt: number;
  initialNachlass: number;
  initialSkonto: number;
  /** MwSt-Satz je Gruppe (Start: gespeicherte Werte bzw. Default aus settings). */
  vatPerGroup: Record<string, number>;
  systemSizeKwp?: number | null;
  storageKwh?: number | null;
  products: Product[];
  productGroups?: ProductGroup[];
  templates?: CalcTemplate[];
}) {
  const router = useRouter();
  const [name, setName] = React.useState(calcName);
  const [positions, setPositions] = React.useState<CalcPosition[]>(() => {
    if (!initialPositions.length) return [newRow()];
    // Eindeutige IDs sicherstellen: doppelte IDs würden dazu führen, dass eine
    // Änderung (z. B. Hybrid-Aufteilung) scheinbar mehrere Zeilen trifft.
    const seen = new Set<string>();
    return initialPositions.map((p) => {
      if (!p.id || seen.has(p.id)) {
        rowSeq += 1;
        return { ...p, id: `pos-${Date.now()}-${rowSeq}` };
      }
      seen.add(p.id);
      return p;
    });
  });
  const [pauschal, setPauschal] = React.useState(String(initialPauschalRabatt));
  const [nachlass, setNachlass] = React.useState(String(initialNachlass));
  const [vat, setVat] = React.useState<Record<string, number>>(() => ({
    "PV-Anlage": vatPerGroup["PV-Anlage"] ?? 0,
    Speicher: vatPerGroup["Speicher"] ?? 0,
    Wallbox: vatPerGroup["Wallbox"] ?? 19,
    Sonstiges: vatPerGroup["Sonstiges"] ?? 19,
  }));
  const [skonto, setSkonto] = React.useState(String(initialSkonto));
  const [saving, setSaving] = React.useState(false);

  // Anlagengröße (kWp) und Speicher (kWh) live aus den Positionen berechnen:
  // Σ(Menge·Wp)/1000 bzw. Σ(Menge·kWh je Einheit). Übersteuert die Projektfelder.
  const computedKwp = React.useMemo(
    () =>
      Math.round(
        positions.reduce(
          (s, p) => s + (Number(p.menge) || 0) * (Number(p.moduleWp) || 0),
          0,
        ) / 10,
      ) / 100,
    [positions],
  );
  const computedKwh = React.useMemo(
    () =>
      Math.round(
        positions.reduce(
          (s, p) => s + (Number(p.menge) || 0) * (Number(p.kwhPerUnit) || 0),
          0,
        ) * 100,
      ) / 100,
    [positions],
  );
  // Fallback auf die manuellen Projektfelder, solange keine Wp/kWh hinterlegt sind.
  const effKwp = computedKwp > 0 ? computedKwp : (systemSizeKwp ?? null);
  const effKwh = computedKwh > 0 ? computedKwh : (storageKwh ?? null);

  const result = React.useMemo(
    () =>
      calculate({
        positions,
        pauschalRabattPercent: Number(pauschal) || 0,
        nachlass: Number(nachlass) || 0,
        mwstPercent: vat["Sonstiges"] ?? 19,
        mwstPerGroup: vat,
        skontoPercent: Number(skonto) || 0,
        systemSizeKwp: effKwp,
        storageKwh: effKwh,
      }),
    [positions, pauschal, nachlass, vat, skonto, effKwp, effKwh],
  );

  function update(id: string, patch: Partial<CalcPosition>) {
    setPositions((rows) => rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }
  function remove(id: string) {
    setPositions((rows) => rows.filter((r) => r.id !== id));
  }
  function addRow() {
    setPositions((rows) => [...rows, newRow()]);
  }
  function applyProduct(id: string, p: Product) {
    // Hybrid-Aufteilung sowie Wp/kWh aus den Produkt-Specs übernehmen.
    const specs = (p.specs as Record<string, unknown> | null) ?? {};
    const numOrNull = (v: unknown) =>
      typeof v === "number" && Number.isFinite(v) ? v : null;
    update(id, {
      product_id: p.id,
      bezeichnung: p.name,
      einheit: p.unit ?? "Stk",
      ek: p.price_purchase ?? 0,
      einzelpreis: p.price_sell ?? 0,
      splitPvPct: numOrNull(specs.split_pv_pct),
      moduleWp: numOrNull(specs.module_wp),
      kwhPerUnit: numOrNull(specs.storage_kwh),
    });
  }

  /** Eine Kalkulationsvorlage laden: Positionen + Default-Rabatte/MwSt. */
  /** Ausgewählte Vorlagen-Positionen übernehmen (aus dem Auswahl-Dialog). */
  function applyTemplate(
    selected: CalcPosition[],
    d: Record<string, unknown>,
    templateName: string,
  ) {
    // Frische, eindeutige IDs vergeben; Menge als Vorschlag übernehmen.
    const loaded: CalcPosition[] = selected.map((p) => {
      rowSeq += 1;
      return {
        ...p,
        id: `tpl-${Date.now()}-${rowSeq}`,
        menge: typeof p.menge === "number" ? p.menge : 0,
      };
    });
    setPositions(loaded);

    // Vorlagen-Default-MwSt (Einzelsatz) auf Wallbox/Sonstiges anwenden,
    // PV/Speicher bleiben beim Nullsteuersatz (§ 12 Abs. 3 UStG).
    if (typeof d.mwstPercent === "number")
      setVat((v) => ({ ...v, Wallbox: d.mwstPercent as number, Sonstiges: d.mwstPercent as number }));
    if (typeof d.skontoPercent === "number") setSkonto(String(d.skontoPercent));
    if (typeof d.pauschalRabattPercent === "number")
      setPauschal(String(d.pauschalRabattPercent));
    if (typeof d.nachlass === "number") setNachlass(String(d.nachlass));

    toast.success(
      `Vorlage „${templateName}" geladen (${loaded.length} Positionen). Bitte Mengen prüfen.`,
    );
  }

  async function onSave() {
    setSaving(true);
    // Vorlagen-Zeilen ohne Menge (0) werden beim Speichern verworfen, damit nur
    // die tatsächlich gewählten Positionen im Angebot landen.
    const toSave = positions
      .filter((p) => (Number(p.menge) || 0) > 0 && p.bezeichnung.trim() !== "")
      // Preise auf 2 Nachkommastellen normalisieren.
      .map((p) => ({
        ...p,
        ek: p.ek === null || p.ek === undefined ? p.ek : round2(Number(p.ek)),
        einzelpreis: round2(Number(p.einzelpreis)),
      }));
    const fd = new FormData();
    fd.set("project_id", projectId);
    if (calcId) fd.set("calc_id", calcId);
    fd.set("name", name.trim() || "Standard");
    fd.set(
      "payload",
      JSON.stringify({
        positions: toSave,
        pauschalRabattPercent: Number(pauschal) || 0,
        nachlass: Number(nachlass) || 0,
        mwstPercent: vat["Sonstiges"] ?? 19,
        mwstPerGroup: vat,
        skontoPercent: Number(skonto) || 0,
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

  // Positionen nach Gruppe gliedern (Reihenfolge PV→Speicher→Wallbox→Sonstiges);
  // leere Gruppen werden ausgelassen. Hybride erscheinen unter ihrer Gruppe.
  const groupedPositions = POSITION_GROUPS.map((g) => ({
    groupLabel: g,
    rows: result.positions.filter((p) => (p.group ?? "Sonstiges") === g),
  })).filter((s) => s.rows.length > 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Label htmlFor="calc-name" className="text-muted-foreground text-sm">
          Variante
        </Label>
        <Input
          id="calc-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="h-8 max-w-xs"
          placeholder="Name der Variante"
        />
      </div>

      <div className="bg-card overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-44">Bezeichnung</TableHead>
              <TableHead className="w-36">Produkt</TableHead>
              <TableHead className="w-44">Gruppe</TableHead>
              <TableHead className="w-32 text-right">Menge</TableHead>
              <TableHead className="w-24 text-right">EK €</TableHead>
              <TableHead className="w-24 text-right">VK €</TableHead>
              <TableHead className="w-20 text-right">Rabatt %</TableHead>
              <TableHead className="w-28 text-right">Netto €</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {groupedPositions.map(({ groupLabel, rows }) => (
              <React.Fragment key={groupLabel}>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableCell
                    colSpan={9}
                    className="text-muted-foreground py-1.5 text-xs font-semibold"
                  >
                    {groupLabel}
                  </TableCell>
                </TableRow>
                {rows.map((p) => (
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
                        title="Katalog-Produkt zuordnen / tauschen"
                      >
                        {p.product_id ? "Produkt ändern" : "Produkt wählen …"}
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
                      title="Menge −1"
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
                      title="Menge +1"
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
                  <Input
                    type="number"
                    step="1"
                    value={p.rabatt ?? 0}
                    onChange={(e) => update(p.id, { rabatt: Number(e.target.value) })}
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
              </React.Fragment>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" onClick={addRow}>
          <Plus className="size-4" /> Position
        </Button>
        {templates.length > 0 ? (
          <TemplateLoadDialog templates={templates} onApply={applyTemplate} />
        ) : null}
        {positions.length > 0 ? (
          <span className="text-muted-foreground text-xs">
            {positions.length} Positionen
          </span>
        ) : null}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <div className="h-fit space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="pauschal">Pauschalrabatt %</Label>
              <Input
                id="pauschal"
                type="number"
                step="1"
                value={pauschal}
                onChange={(e) => setPauschal(e.target.value)}
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
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="skonto">Skonto %</Label>
              <Input
                id="skonto"
                type="number"
                step="0.1"
                value={skonto}
                onChange={(e) => setSkonto(e.target.value)}
              />
            </div>
          </div>
          <div>
            <Label className="text-muted-foreground mb-1.5 block text-xs">
              MwSt je Gruppe % (§ 12 Abs. 3 UStG: PV + Speicher 0 %)
            </Label>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {POSITION_GROUPS.map((g) => (
                <div key={g} className="grid gap-1">
                  <Label htmlFor={`vat-${g}`} className="text-xs">
                    {g}
                  </Label>
                  <Input
                    id={`vat-${g}`}
                    type="number"
                    step="1"
                    min={0}
                    value={vat[g] ?? 0}
                    onChange={(e) =>
                      setVat((v) => ({ ...v, [g]: Number(e.target.value) || 0 }))
                    }
                    className="h-8"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-4">
        <div className="bg-primary/5 border-primary/20 grid grid-cols-2 gap-3 rounded-lg border p-4">
          <div>
            <p className="text-muted-foreground text-xs">Anlagengröße</p>
            <p className="text-lg font-semibold">
              {formatNumber(effKwp ?? 0)} kWp
            </p>
            {t.spezifischPvProKwp !== null ? (
              <p className="text-muted-foreground text-xs">
                {formatCurrency(t.spezifischPvProKwp)} / kWp
              </p>
            ) : null}
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Speicher</p>
            <p className="text-lg font-semibold">
              {formatNumber(effKwh ?? 0)} kWh
            </p>
            {t.spezifischSpeicherProKwh !== null ? (
              <p className="text-muted-foreground text-xs">
                {formatCurrency(t.spezifischSpeicherProKwh)} / kWh
              </p>
            ) : null}
          </div>
        </div>

        <div className="bg-card space-y-1.5 rounded-lg border p-4 text-sm">
          <Row label="Zwischensumme" value={formatCurrency(t.nettoVorPauschal)} />
          {Number(pauschal) > 0 ? (
            <Row label={`Pauschalrabatt ${pauschal} %`} value={`- ${formatCurrency(t.nettoVorPauschal - t.nettoVorPauschal * (1 - (Number(pauschal) || 0) / 100))}`} />
          ) : null}
          {Number(nachlass) > 0 ? (
            <Row label="Nachlass" value={`- ${formatCurrency(Number(nachlass))}`} />
          ) : null}
          <Row label="Summe netto" value={formatCurrency(t.netto)} strong />
          {(t.mwstSaetze ?? []).map((m) => (
            <Row
              key={m.rate}
              label={`MwSt ${m.rate} % (auf ${formatCurrency(m.netto)})`}
              value={formatCurrency(m.betrag)}
            />
          ))}
          <Row label="Endpreis brutto" value={formatCurrency(t.brutto)} strong />
          {t.skontoBetrag > 0 ? (
            <>
              <Row label={`Skonto ${skonto} %`} value={`- ${formatCurrency(t.skontoBetrag)}`} />
              <Row label="Brutto nach Skonto" value={formatCurrency(t.bruttoNachSkonto)} />
            </>
          ) : null}
          {t.spezifischPvProKwp !== null ||
          t.spezifischSpeicherProKwh !== null ? (
            <div className="border-t pt-1.5 text-xs">
              {t.spezifischPvProKwp !== null ? (
                <Row
                  label="Spez. Preis PV (netto)"
                  value={`${formatCurrency(t.spezifischPvProKwp)} / kWp`}
                />
              ) : null}
              {t.spezifischSpeicherProKwh !== null ? (
                <Row
                  label="Spez. Preis Speicher (netto)"
                  value={`${formatCurrency(t.spezifischSpeicherProKwh)} / kWh`}
                />
              ) : null}
            </div>
          ) : null}
          <div className="text-muted-foreground border-t pt-1.5 text-xs">
            <Row
              label="Marge (DB)"
              value={`${formatCurrency(t.marge)} (${formatNumber(t.margeProzent, 1)} %)`}
            />
          </div>
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
