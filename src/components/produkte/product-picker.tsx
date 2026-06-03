"use client";

import * as React from "react";
import { Search } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/format";
import { productMatches } from "@/lib/search";
import { cn } from "@/lib/utils";
import type { Product, ProductGroup } from "@/lib/types";

const ALL = "__alle__";
const NONE = "";

/**
 * Produkt-Auswahl als Dialog. Zeigt zuerst die vorhandenen HERSTELLER zur Wahl
 * (man bietet meist eine Marke an) — erst nach Auswahl oder bei aktiver Suche
 * erscheinen die Produkte. „Alle Hersteller einblenden" zeigt den ganzen Katalog.
 */
export function ProductPicker({
  products,
  groups,
  onSelect,
  trigger,
}: {
  products: Product[];
  groups: ProductGroup[];
  onSelect: (product: Product) => void;
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [maker, setMaker] = React.useState<string>(NONE);

  // Beim Öffnen zurück zur Hersteller-Wahl.
  React.useEffect(() => {
    if (open) {
      setMaker(NONE);
      setQuery("");
    }
  }, [open]);

  const groupName = React.useCallback(
    (id: string | null) =>
      groups.find((g) => g.id === id)?.name ?? "Ohne Gruppe",
    [groups],
  );

  // Vorhandene Hersteller (alphabetisch) mit Produktanzahl.
  const makers = React.useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of products) {
      const m = p.manufacturer?.trim();
      if (m) counts.set(m, (counts.get(m) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [products]);

  const q = query.trim();
  const choosing = !q && maker === NONE;

  // Nach Hersteller + Suche filtern und nach Gruppe gliedern.
  const grouped = React.useMemo(() => {
    if (choosing) return [];
    const filtered = products.filter((p) =>
      q
        ? productMatches(p, q)
        : maker === ALL || p.manufacturer?.trim() === maker,
    );
    const map = new Map<string, Product[]>();
    for (const p of filtered) {
      const key = groupName(p.group_id);
      (map.get(key) ?? map.set(key, []).get(key)!).push(p);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [products, q, maker, choosing, groupName]);

  function pick(p: Product) {
    onSelect(p);
    setOpen(false);
    setQuery("");
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="flex max-h-[80vh] flex-col sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Produkt wählen</DialogTitle>
        </DialogHeader>

        <div className="relative">
          <Search className="text-muted-foreground absolute top-2.5 left-2.5 size-4" />
          <Input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Suchen (Name, Hersteller, Artikelnr.) …"
            className="pl-8"
          />
        </div>

        {/* Aktiver Hersteller-Filter (wenn nicht in der Wahl-Ansicht) */}
        {!choosing && makers.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {!q ? (
              [{ name: ALL, count: products.length }, ...makers].map((m) => {
                const active = maker === m.name;
                return (
                  <button
                    key={m.name}
                    type="button"
                    onClick={() => setMaker(m.name)}
                    className={cn(
                      "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                      active
                        ? "border-primary bg-primary/10 text-primary"
                        : "hover:bg-muted text-foreground/70",
                    )}
                  >
                    {m.name === ALL ? "Alle Hersteller" : m.name}
                  </button>
                );
              })
            ) : (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="hover:bg-muted text-muted-foreground rounded-full border px-3 py-1 text-xs"
              >
                ← Hersteller wählen
              </button>
            )}
          </div>
        ) : null}

        {/* Hersteller-Wahl als Einstieg */}
        {choosing ? (
          <div className="-mx-1 flex-1 overflow-y-auto px-1">
            <p className="text-muted-foreground mb-2 text-sm">
              Welcher Hersteller? (oder oben suchen)
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {makers.map((m) => (
                <button
                  key={m.name}
                  type="button"
                  onClick={() => setMaker(m.name)}
                  className="hover:border-primary hover:bg-primary/5 rounded-lg border px-3 py-2 text-left text-sm font-medium"
                >
                  {m.name}
                  <span className="text-muted-foreground block text-xs">{m.count} Produkte</span>
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setMaker(ALL)}
              className="text-primary mt-3 text-sm hover:underline"
            >
              Alle Hersteller einblenden
            </button>
          </div>
        ) : (
        <div className="-mx-1 flex-1 overflow-y-auto px-1">
          {grouped.length === 0 ? (
            <p className="text-muted-foreground py-8 text-center text-sm">
              Keine Treffer.
            </p>
          ) : (
            grouped.map(([group, list]) => (
              <div key={group} className="mb-3">
                <p className="bg-background text-muted-foreground sticky top-0 py-1 text-xs font-semibold">
                  {group}
                </p>
                <ul className="space-y-0.5">
                  {list.map((p) => (
                    <li key={p.id}>
                      <button
                        type="button"
                        onClick={() => pick(p)}
                        className="hover:bg-accent flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm"
                      >
                        <span className="min-w-0 flex-1 truncate">
                          {p.name}
                          {p.manufacturer ? (
                            <span className="text-muted-foreground">
                              {" "}
                              · {p.manufacturer}
                            </span>
                          ) : null}
                        </span>
                        <span className="text-muted-foreground shrink-0 tabular-nums">
                          {formatCurrency(p.price_sell)}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))
          )}
        </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
