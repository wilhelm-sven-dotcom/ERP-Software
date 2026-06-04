"use client";

import * as React from "react";
import { Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { HELP_ENTRIES, type HelpEntry } from "@/lib/help/help-content";

const CATEGORIES: HelpEntry["category"][] = [
  "Grundlagen",
  "Kalkulation",
  "Angebot & Belege",
  "Vertrieb",
  "KI & Dokumente",
  "Team & Rollen",
];

/** Durchsuchbares Glossar/Hilfe — speist sich aus der zentralen Help-Registry. */
export function HelpGlossary() {
  const [q, setQ] = React.useState("");
  const query = q.trim().toLowerCase();

  const filtered = React.useMemo(() => {
    if (!query) return HELP_ENTRIES;
    return HELP_ENTRIES.filter((e) =>
      `${e.term} ${e.short} ${e.long ?? ""}`.toLowerCase().includes(query),
    );
  }, [query]);

  return (
    <div className="space-y-6">
      <div className="relative max-w-md">
        <Search className="text-muted-foreground absolute top-2.5 left-2.5 size-4" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Hilfe durchsuchen (z. B. Marge, Angebot, MwSt) …"
          className="pl-8"
        />
      </div>

      {CATEGORIES.map((cat) => {
        const items = filtered.filter((e) => e.category === cat);
        if (items.length === 0) return null;
        return (
          <section key={cat} className="space-y-3">
            <h2 className="text-lg font-semibold tracking-tight">{cat}</h2>
            <div className="grid gap-4 md:grid-cols-2">
              {items.map((e) => (
                <Card key={e.id}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">{e.term}</CardTitle>
                  </CardHeader>
                  <CardContent className="text-muted-foreground space-y-2 text-sm">
                    <p>{e.short}</p>
                    {e.long ? <p className="text-foreground/80">{e.long}</p> : null}
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        );
      })}

      {filtered.length === 0 ? (
        <p className="text-muted-foreground text-sm">Keine Treffer für »{q}«.</p>
      ) : null}
    </div>
  );
}
