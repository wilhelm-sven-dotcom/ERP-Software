"use client";

import * as React from "react";
import { ScanText } from "lucide-react";
import { useRouter } from "next/navigation";
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
import { updateProductSpecs } from "@/app/(app)/produkte/actions";
import { labelForSpec } from "@/lib/products/spec-labels";

interface Resp {
  enabled?: boolean;
  reason?: string;
  result?: { specs: Record<string, string | number>; reason: string } | null;
}

/**
 * „Datenblatt auslesen (KI)": liest das am Produkt hinterlegte Datenblatt mit
 * dem stärkeren Modell (gpt-4o) VOLLSTÄNDIG aus und übernimmt die geprüften
 * Kenndaten. Ergänzt die schwächere Auto-Auslese beim Upload.
 */
export function ProductDatasheetExtractButton({ productId }: { productId: string | null }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [applying, setApplying] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [specs, setSpecs] = React.useState<Record<string, string | number>>({});
  const [checked, setChecked] = React.useState<Set<string>>(new Set());

  async function run() {
    if (!productId) {
      toast.error("Bitte das Produkt zuerst speichern.");
      return;
    }
    setOpen(true);
    setBusy(true);
    setError(null);
    setSpecs({});
    try {
      const res = await fetch("/api/products/extract-specs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId }),
      });
      const data = (await res.json()) as Resp;
      if (data.enabled === false) {
        setError(data.reason ?? "KI ist nicht konfiguriert.");
        return;
      }
      if (!data.result || Object.keys(data.result.specs).length === 0) {
        setError(data.result?.reason || data.reason || "Keine Kenndaten gefunden.");
        return;
      }
      setSpecs(data.result.specs);
      setChecked(new Set(Object.keys(data.result.specs)));
    } catch {
      setError("Anfrage fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  }

  function toggle(key: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function apply() {
    if (!productId) return;
    const selected: Record<string, string | number> = {};
    for (const k of checked) if (k in specs) selected[k] = specs[k];
    if (Object.keys(selected).length === 0) {
      toast.error("Bitte mindestens ein Feld auswählen.");
      return;
    }
    setApplying(true);
    const res = await updateProductSpecs(productId, selected);
    setApplying(false);
    if (res.ok) {
      toast.success("Kenndaten übernommen. Dialog neu öffnen zum Prüfen.");
      setOpen(false);
      router.refresh();
    } else {
      toast.error(res.error ?? "Übernehmen fehlgeschlagen.");
    }
  }

  const entries = Object.entries(specs);

  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={run} disabled={!productId}>
        <ScanText className="size-4" /> Datenblatt auslesen (KI)
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex max-h-[85vh] flex-col sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Datenblatt vollständig auslesen</DialogTitle>
            <DialogDescription>
              Liest das hinterlegte Datenblatt mit dem stärkeren KI-Modell aus. Werte vor dem
              Übernehmen prüfen.
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {busy ? (
              <p className="text-muted-foreground py-8 text-center text-sm">Lese Datenblatt …</p>
            ) : error ? (
              <p className="text-muted-foreground py-6 text-center text-sm">{error}</p>
            ) : entries.length === 0 ? (
              <p className="text-muted-foreground py-6 text-center text-sm">Keine Daten.</p>
            ) : (
              <ul className="divide-y rounded-md border">
                {entries.map(([k, v]) => (
                  <li key={k}>
                    <label className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm">
                      <input
                        type="checkbox"
                        checked={checked.has(k)}
                        onChange={() => toggle(k)}
                        className="size-4"
                      />
                      <span className="text-muted-foreground w-48 shrink-0">{labelForSpec(k)}</span>
                      <span className="flex-1 font-medium">{String(v)}</span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {entries.length > 0 ? (
            <DialogFooter>
              <Button onClick={apply} disabled={applying || checked.size === 0}>
                {applying ? "Übernehmen …" : `${checked.size} Felder übernehmen`}
              </Button>
            </DialogFooter>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
