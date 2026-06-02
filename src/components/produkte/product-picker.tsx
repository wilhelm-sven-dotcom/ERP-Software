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
import type { Product, ProductGroup } from "@/lib/types";

/**
 * Produkt-Auswahl als Dialog mit Suche + Gruppen-Gliederung.
 * Ersetzt das unbedienbare flache Select mit hunderten Einträgen.
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

  const groupName = React.useCallback(
    (id: string | null) =>
      groups.find((g) => g.id === id)?.name ?? "Ohne Gruppe",
    [groups],
  );

  // Nach Suche filtern und nach Gruppe gliedern.
  const grouped = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? products.filter((p) =>
          [p.name, p.manufacturer, p.sku, p.category]
            .filter(Boolean)
            .some((v) => String(v).toLowerCase().includes(q)),
        )
      : products;

    const map = new Map<string, Product[]>();
    for (const p of filtered) {
      const key = groupName(p.group_id);
      (map.get(key) ?? map.set(key, []).get(key)!).push(p);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [products, query, groupName]);

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
      </DialogContent>
    </Dialog>
  );
}
