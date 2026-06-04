"use client";

import * as React from "react";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Calculator } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  saveMeasurement,
  deleteMeasurement,
  pushMeasurementsToCalculation,
} from "@/app/(app)/aufmass/actions";
import { type ActionResult } from "@/lib/actions";
import { formatNumber } from "@/lib/format";
import type { Measurement } from "@/lib/types";

const initial: ActionResult = { ok: false };

export function AufmassCard({
  projectId,
  measurements,
}: {
  projectId: string;
  measurements: Measurement[];
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState(saveMeasurement, initial);
  const formRef = React.useRef<HTMLFormElement>(null);

  React.useEffect(() => {
    if (state.ok) {
      formRef.current?.reset();
      router.refresh();
      state.ok = false;
    } else if (state.error) {
      toast.error(state.error);
    }
  }, [state, router]);

  return (
    <div className="space-y-4">
      {measurements.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          Noch kein Aufmaß. Erfasse Flächen, Stückzahlen oder Längen.
        </p>
      ) : (
        <ul className="divide-y text-sm">
          {measurements.map((m) => (
            <li key={m.id} className="flex items-center gap-2 py-2">
              <span className="flex-1">
                {m.label}
                {m.note ? (
                  <span className="text-muted-foreground block text-xs">{m.note}</span>
                ) : null}
              </span>
              <span className="text-muted-foreground w-32 text-right">
                {m.quantity != null ? `${formatNumber(m.quantity)} ${m.unit ?? ""}` : ""}
                {m.area != null ? ` · ${formatNumber(m.area)} m²` : ""}
              </span>
              <form action={deleteMeasurement}>
                <input type="hidden" name="id" value={m.id} />
                <input type="hidden" name="project_id" value={projectId} />
                <Button variant="ghost" size="icon" className="size-8" type="submit" title="Löschen">
                  <Trash2 className="size-4" />
                </Button>
              </form>
            </li>
          ))}
        </ul>
      )}

      <form ref={formRef} action={action} className="flex flex-wrap items-end gap-2">
        <input type="hidden" name="project_id" value={projectId} />
        <Input name="label" placeholder="Bezeichnung (z. B. Dachfläche Süd)" className="h-9 min-w-48 flex-1" required />
        <Input name="quantity" type="number" step="0.01" placeholder="Menge" className="h-9 w-24" />
        <Input name="unit" placeholder="Einheit" className="h-9 w-24" />
        <Input name="area" type="number" step="0.01" placeholder="m²" className="h-9 w-24" />
        <Button type="submit" size="sm" disabled={pending}>
          <Plus className="size-4" /> Hinzufügen
        </Button>
      </form>

      {measurements.length > 0 ? (
        <form action={pushMeasurementsToCalculation}>
          <input type="hidden" name="project_id" value={projectId} />
          <Button type="submit" variant="outline" size="sm">
            <Calculator className="size-4" /> In Kalkulation übernehmen
          </Button>
        </form>
      ) : null}
    </div>
  );
}
