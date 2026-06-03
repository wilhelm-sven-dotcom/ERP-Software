"use client";

import * as React from "react";
import { Zap } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { generatePositions } from "@/lib/calc/configurator";
import type { CalcPosition } from "@/lib/calc/types";
import type { Product } from "@/lib/types";

/** Hersteller-Auswahlfeld (außerhalb des Renders, damit kein State-Reset). */
function MakerSelect({
  label,
  value,
  set,
  list,
}: {
  label: string;
  value: string;
  set: (v: string) => void;
  list: string[];
}) {
  return (
    <div className="grid gap-1.5">
      <Label>{label}</Label>
      <select
        value={value}
        onChange={(e) => set(e.target.value)}
        className="border-input h-9 rounded-md border bg-transparent px-3 text-sm"
      >
        <option value="">beliebig</option>
        {list.map((m) => (
          <option key={m} value={m}>{m}</option>
        ))}
      </select>
    </div>
  );
}

/** Hersteller je „Kategorie-Schlagwort" aus dem Katalog ableiten. */
function makersFor(products: Product[], words: string[]): string[] {
  const set = new Set<string>();
  for (const p of products) {
    const hay = `${p.category ?? ""} ${p.name}`.toLowerCase();
    if (words.some((w) => hay.includes(w)) && p.manufacturer) set.add(p.manufacturer);
  }
  return Array.from(set).sort();
}

/**
 * Schnell-Konfigurator: aus kWp + Speicher-kWh + Hersteller eine komplette
 * Kalkulation erzeugen (Module/Wechselrichter/Speicher/Dienstleistungen).
 */
export function ConfigWizard({
  products,
  defaultKwp,
  defaultKwh,
  onApply,
}: {
  products: Product[];
  defaultKwp?: number | null;
  defaultKwh?: number | null;
  onApply: (positions: CalcPosition[]) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [kwp, setKwp] = React.useState(defaultKwp ? String(defaultKwp) : "");
  const [kwh, setKwh] = React.useState(defaultKwh ? String(defaultKwh) : "");
  const [modMaker, setModMaker] = React.useState("");
  const [invMaker, setInvMaker] = React.useState("");
  const [stoMaker, setStoMaker] = React.useState("");

  const moduleMakers = React.useMemo(() => makersFor(products, ["modul", "panel"]), [products]);
  const inverterMakers = React.useMemo(
    () => makersFor(products, ["wechselrichter", "inverter", "controller"]),
    [products],
  );
  const storageMakers = React.useMemo(
    () => makersFor(products, ["speicher", "batterie", "storage"]),
    [products],
  );

  const preview = React.useMemo(() => {
    const n = Number(kwp.replace(",", "."));
    const s = Number(kwh.replace(",", "."));
    if (!Number.isFinite(n) || n <= 0) return [];
    return generatePositions({
      kwp: n,
      kwh: Number.isFinite(s) ? s : 0,
      products,
      prefs: { moduleManufacturer: modMaker, inverterManufacturer: invMaker, storageManufacturer: stoMaker },
    });
  }, [kwp, kwh, products, modMaker, invMaker, stoMaker]);

  function apply() {
    if (preview.length === 0) return;
    onApply(preview);
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Zap className="size-4" /> Schnell-Konfiguration
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Schnell-Konfiguration</DialogTitle>
          <DialogDescription>
            Größe + Hersteller angeben — die Kalkulation wird automatisch zusammengestellt und
            ist danach normal anpassbar.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label>Anlagengröße (kWp)</Label>
              <Input value={kwp} onChange={(e) => setKwp(e.target.value)} type="number" step="0.1" placeholder="z. B. 10" />
            </div>
            <div className="grid gap-1.5">
              <Label>Speicher (kWh)</Label>
              <Input value={kwh} onChange={(e) => setKwh(e.target.value)} type="number" step="0.1" placeholder="z. B. 10" />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <MakerSelect label="Modul" value={modMaker} set={setModMaker} list={moduleMakers} />
            <MakerSelect label="Wechselrichter" value={invMaker} set={setInvMaker} list={inverterMakers} />
            <MakerSelect label="Speicher" value={stoMaker} set={setStoMaker} list={storageMakers} />
          </div>

          {preview.length > 0 ? (
            <div className="rounded-md border p-2 text-sm">
              <p className="text-muted-foreground mb-1 text-xs">Vorschau:</p>
              <ul className="divide-y">
                {preview.map((p) => (
                  <li key={p.id} className="flex justify-between py-1">
                    <span className="truncate">{p.bezeichnung}</span>
                    <span className="text-muted-foreground ml-2 shrink-0">{p.menge} {p.einheit}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">
              Gib eine Anlagengröße ein. Hinweis: Module/Wechselrichter/Speicher werden anhand der
              Produkt-Stammdaten (Modul-Wp, Speicher-kWh, Kategorie) gewählt.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button onClick={apply} disabled={preview.length === 0}>
            {preview.length} Positionen übernehmen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
