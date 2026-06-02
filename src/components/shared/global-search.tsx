"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { searchAll, type SearchHit, type SearchResults } from "@/app/(app)/search/actions";

const EMPTY: SearchResults = {
  customers: [],
  projects: [],
  offers: [],
  products: [],
  employees: [],
};

/**
 * Globale Sofortsuche über alle Module. Öffnet per Klick oder ⌘/Strg+K,
 * sucht mit kurzer Verzögerung serverseitig und zeigt gruppierte Treffer.
 */
export function GlobalSearch({ variant = "topbar" }: { variant?: "topbar" | "dashboard" }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<SearchResults>(EMPTY);
  const [loading, setLoading] = React.useState(false);

  // ⌘/Strg+K öffnet die Suche.
  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(true);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Debounced Serversuche.
  React.useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults(EMPTY);
      setLoading(false);
      return;
    }
    setLoading(true);
    const handle = setTimeout(async () => {
      try {
        setResults(await searchAll(q));
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(handle);
  }, [query]);

  const groups: { label: string; hits: SearchHit[] }[] = [
    { label: "Kunden", hits: results.customers },
    { label: "Projekte", hits: results.projects },
    { label: "Angebote", hits: results.offers },
    { label: "Produkte", hits: results.products },
    { label: "Mitarbeiter", hits: results.employees },
  ].filter((g) => g.hits.length > 0);

  const total = groups.reduce((s, g) => s + g.hits.length, 0);

  function go(href: string) {
    setOpen(false);
    setQuery("");
    router.push(href);
  }

  const trigger =
    variant === "dashboard" ? (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="bg-card text-muted-foreground hover:border-primary flex w-full items-center gap-2 rounded-lg border px-4 py-3 text-left text-sm transition-colors"
      >
        <Search className="size-4" />
        Kunden, Projekte, Angebote, Produkte suchen … (⌘K)
      </button>
    ) : (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-muted-foreground hover:bg-muted flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-sm"
        title="Suchen (⌘K)"
      >
        <Search className="size-4" />
        <span className="hidden md:inline">Suchen …</span>
      </button>
    );

  return (
    <>
      {trigger}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="top-24 max-h-[70vh] translate-y-0 overflow-hidden p-0 sm:max-w-xl">
          <DialogTitle className="sr-only">Globale Suche</DialogTitle>
          <div className="border-b p-2">
            <Input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Suchen … (Name, Nummer, Ort, Artikel)"
              className="h-10 border-0 shadow-none focus-visible:ring-0"
            />
          </div>
          <div className="max-h-[55vh] overflow-y-auto p-2">
            {query.trim().length < 2 ? (
              <p className="text-muted-foreground p-3 text-sm">
                Mindestens 2 Zeichen eingeben.
              </p>
            ) : loading && total === 0 ? (
              <p className="text-muted-foreground p-3 text-sm">Suche …</p>
            ) : total === 0 ? (
              <p className="text-muted-foreground p-3 text-sm">Keine Treffer.</p>
            ) : (
              groups.map((g) => (
                <div key={g.label} className="mb-2">
                  <p className="text-muted-foreground px-2 py-1 text-xs font-semibold">
                    {g.label}
                  </p>
                  {g.hits.map((h) => (
                    <button
                      key={`${h.type}-${h.id}`}
                      type="button"
                      onClick={() => go(h.href)}
                      className="hover:bg-muted flex w-full flex-col rounded-md px-2 py-1.5 text-left"
                    >
                      <span className="text-sm font-medium">{h.label}</span>
                      {h.sub ? (
                        <span className="text-muted-foreground text-xs">{h.sub}</span>
                      ) : null}
                    </button>
                  ))}
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
