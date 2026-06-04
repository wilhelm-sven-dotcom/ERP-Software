"use client";

import * as React from "react";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveWirtschaftDefaults } from "@/app/(app)/einstellungen/actions";
import { type ActionResult } from "@/lib/actions";
import type { WirtschaftParams } from "@/lib/calc/wirtschaft";

const initial: ActionResult = { ok: false };

const FIELDS: { name: keyof WirtschaftParams; label: string; step: string }[] = [
  { name: "ertragKwhProKwp", label: "Spez. Ertrag (kWh/kWp/a)", step: "1" },
  { name: "eigenverbrauchsAnteil", label: "Eigenverbrauch (%)", step: "1" },
  { name: "strompreis", label: "Strompreis (€/kWh)", step: "0.01" },
  { name: "einspeiseverguetung", label: "Einspeisevergütung (€/kWh)", step: "0.0001" },
  { name: "strompreissteigerung", label: "Strompreissteigerung (%/a)", step: "0.1" },
  { name: "degradation", label: "Degradation (%/a)", step: "0.1" },
  { name: "laufzeit", label: "Laufzeit (Jahre)", step: "1" },
];

/** Firmenweite Wirtschaftlichkeits-Defaults (Strompreis, Ertrag, …). */
export function WirtschaftDefaultsForm({
  defaults,
  disabled,
}: {
  defaults: WirtschaftParams;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState(saveWirtschaftDefaults, initial);
  const seen = React.useRef<ActionResult | null>(null);
  React.useEffect(() => {
    if (seen.current === state) return;
    seen.current = state;
    if (state.ok) {
      toast.success("Gespeichert");
      router.refresh();
    } else if (state.error) {
      toast.error(state.error);
    }
  }, [state, router]);

  return (
    <form action={action} className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-3">
        {FIELDS.map((f) => (
          <div key={f.name} className="grid gap-1.5">
            <Label htmlFor={f.name}>{f.label}</Label>
            <Input
              id={f.name}
              name={f.name}
              type="number"
              step={f.step}
              defaultValue={String(defaults[f.name])}
              disabled={disabled}
            />
          </div>
        ))}
      </div>
      {!disabled ? (
        <div>
          <Button type="submit" disabled={pending}>
            {pending ? "Speichern …" : "Speichern"}
          </Button>
        </div>
      ) : null}
    </form>
  );
}
