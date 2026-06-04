"use client";

import * as React from "react";
import { Plus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface SpecRow {
  /** Stabiler Schlüssel (bestehend) bzw. leer für neue Zeilen. */
  key: string;
  label: string;
  value: string;
  isNew: boolean;
}

function slug(label: string): string {
  return label
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function coerce(value: string): string | number {
  const t = value.trim();
  if (/^-?\d+([.,]\d+)?$/.test(t)) {
    const num = Number(t.replace(",", "."));
    if (Number.isFinite(num)) return num;
  }
  return value;
}

/**
 * Generische „Technische Daten" als freie Bezeichnung/Wert-Liste. Bestehende
 * Felder (aus Datenblatt-Import/Web-Anreicherung) werden mit deutschem Label
 * angezeigt; neue Felder kann der Nutzer frei ergänzen. Serialisiert nach einem
 * versteckten `extra_specs`-JSON, das `saveProduct` in `specs` merged (ohne die
 * getippten Kernfelder zu berühren).
 */
export function ProductSpecEditor({
  initial,
}: {
  initial: { key: string; label: string; value: string | number }[];
}) {
  const [rows, setRows] = React.useState<SpecRow[]>(
    initial.map((e) => ({ key: e.key, label: e.label, value: String(e.value), isNew: false })),
  );

  const serialized = React.useMemo(() => {
    const obj: Record<string, string | number> = {};
    for (const r of rows) {
      const key = r.isNew ? slug(r.label) : r.key;
      if (!key) continue;
      if (r.value.trim() === "") continue;
      obj[key] = coerce(r.value);
    }
    return JSON.stringify(obj);
  }, [rows]);

  function update(i: number, patch: Partial<SpecRow>) {
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }
  function remove(i: number) {
    setRows((rs) => rs.filter((_, idx) => idx !== i));
  }
  function add() {
    setRows((rs) => [...rs, { key: "", label: "", value: "", isNew: true }]);
  }

  return (
    <div className="grid gap-2">
      <Label className="text-muted-foreground text-xs">
        Technische Daten (Hersteller, Gewicht, Maße, Wirkungsgrad …)
      </Label>
      {/* Wert wird als verstecktes JSON an saveProduct übergeben. */}
      <input type="hidden" name="extra_specs" value={serialized} />

      {rows.length === 0 ? (
        <p className="text-muted-foreground text-xs">
          Noch keine technischen Daten. Per Datenblatt-Upload, „Daten aus dem Netz ziehen" oder
          manuell ergänzen.
        </p>
      ) : (
        <div className="grid gap-1.5">
          {rows.map((r, i) => (
            <div key={r.isNew ? `new-${i}` : r.key} className="flex items-center gap-2">
              {r.isNew ? (
                <Input
                  value={r.label}
                  onChange={(e) => update(i, { label: e.target.value })}
                  placeholder="Bezeichnung"
                  className="h-8 flex-1"
                />
              ) : (
                <span className="text-muted-foreground w-1/2 shrink-0 truncate text-sm" title={r.label}>
                  {r.label}
                </span>
              )}
              <Input
                value={r.value}
                onChange={(e) => update(i, { value: e.target.value })}
                placeholder="Wert"
                className="h-8 flex-1"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8 shrink-0"
                onClick={() => remove(i)}
                aria-label="Entfernen"
              >
                <X className="size-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <div>
        <Button type="button" variant="outline" size="sm" onClick={add}>
          <Plus className="size-4" /> Feld hinzufügen
        </Button>
      </div>
    </div>
  );
}
