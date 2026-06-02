"use client";

import * as React from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { addListValue } from "@/app/(app)/produkte/actions";

const ADD = "__add__";

/**
 * Auswahl aus einer definierten Liste (Einheiten/Kategorien) mit der Möglichkeit,
 * über „➕ Neu…" einen neuen Wert anzulegen (wird zentral in settings gespeichert).
 * Gibt den Wert über ein verstecktes Input mit `name` an das Formular weiter.
 */
export function ListSelect({
  name,
  kind,
  options,
  defaultValue,
  placeholder,
}: {
  name: string;
  kind: "units" | "categories";
  options: string[];
  defaultValue?: string | null;
  placeholder?: string;
}) {
  const [list, setList] = React.useState<string[]>(() => {
    const base = [...options];
    if (defaultValue && !base.includes(defaultValue)) base.push(defaultValue);
    return base;
  });
  const [value, setValue] = React.useState<string>(defaultValue ?? "");
  const [adding, setAdding] = React.useState(false);
  const [draft, setDraft] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  async function confirmAdd() {
    const v = draft.trim();
    if (!v) return;
    setBusy(true);
    const res = await addListValue(kind, v);
    setBusy(false);
    if (res.ok) {
      if (res.list) setList(res.list);
      else if (!list.includes(v)) setList([...list, v]);
      setValue(v);
      setAdding(false);
      setDraft("");
    } else {
      toast.error(res.error ?? "Konnte nicht gespeichert werden");
    }
  }

  return (
    <div className="grid gap-2">
      <input type="hidden" name={name} value={value} />
      {adding ? (
        <div className="flex gap-2">
          <Input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void confirmAdd();
              }
            }}
            placeholder="Neuer Wert"
          />
          <Button type="button" size="sm" onClick={confirmAdd} disabled={busy}>
            OK
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => {
              setAdding(false);
              setDraft("");
            }}
          >
            Abbrechen
          </Button>
        </div>
      ) : (
        <Select
          value={value}
          onValueChange={(v) => {
            if (v === ADD) setAdding(true);
            else setValue(v);
          }}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder={placeholder ?? "Auswählen …"} />
          </SelectTrigger>
          <SelectContent>
            {list.map((o) => (
              <SelectItem key={o} value={o}>
                {o}
              </SelectItem>
            ))}
            <SelectItem value={ADD}>➕ Neu…</SelectItem>
          </SelectContent>
        </Select>
      )}
    </div>
  );
}
