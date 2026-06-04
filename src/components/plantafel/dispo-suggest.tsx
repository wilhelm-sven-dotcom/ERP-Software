"use client";

import * as React from "react";
import { Sparkles, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Suggestion {
  id: string;
  name: string;
  available: boolean;
  load: number;
  skillMatch: boolean;
  reason: string;
}

/** KI-Vorschlag „wer ist frei?" für einen Tag (Urlaub/Auslastung/Skills). */
export function DispoSuggest({ defaultDate }: { defaultDate: string }) {
  const [open, setOpen] = React.useState(false);
  const [date, setDate] = React.useState(defaultDate);
  const [skill, setSkill] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [list, setList] = React.useState<Suggestion[] | null>(null);

  async function run() {
    setLoading(true);
    try {
      const res = await fetch("/api/dispo/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, skill }),
      });
      const data = (await res.json()) as { suggestions?: Suggestion[] };
      setList(data.suggestions ?? []);
    } catch {
      setList([]);
    } finally {
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Sparkles className="size-4" /> Wer ist frei?
      </Button>
    );
  }

  return (
    <div className="bg-card rounded-lg border p-3">
      <div className="flex flex-wrap items-end gap-2">
        <div className="grid gap-1">
          <label className="text-muted-foreground text-xs">Tag</label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-9 w-40" />
        </div>
        <div className="grid gap-1">
          <label className="text-muted-foreground text-xs">Skill (optional)</label>
          <Input value={skill} onChange={(e) => setSkill(e.target.value)} placeholder="z. B. Elektrik" className="h-9 w-44" />
        </div>
        <Button size="sm" onClick={() => void run()} disabled={loading}>
          {loading ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
          Vorschlagen
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Schließen</Button>
      </div>
      {list ? (
        list.length === 0 ? (
          <p className="text-muted-foreground mt-3 text-sm">Keine Mitarbeiter gefunden.</p>
        ) : (
          <ul className="mt-3 divide-y">
            {list.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-2 py-1.5 text-sm">
                <span className="font-medium">{s.name}</span>
                <span className={s.available ? "text-muted-foreground text-xs" : "text-destructive text-xs"}>
                  {s.reason}
                </span>
              </li>
            ))}
          </ul>
        )
      ) : null}
    </div>
  );
}
