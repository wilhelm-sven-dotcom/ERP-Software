"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Search, Sparkles } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { searchAll, type SearchHit, type SearchResults } from "@/app/(app)/search/actions";

const EMPTY: SearchResults = {
  customers: [],
  projects: [],
  offers: [],
  products: [],
  employees: [],
  files: [],
};

interface AiState {
  loading: boolean;
  answer: string | null;
  relevantIds: Set<string>;
}

const AI_EMPTY: AiState = { loading: false, answer: null, relevantIds: new Set() };

/**
 * Globale Sofortsuche über alle Module. Öffnet per Klick oder ⌘/Strg+K,
 * sucht mit kurzer Verzögerung serverseitig und zeigt gruppierte Treffer.
 * Mit aktivierter KI (`aiEnabled`) liefert Enter zusätzlich eine
 * interpretierte Antwort + hebt die relevanten Treffer hervor.
 */
export function GlobalSearch({
  variant = "topbar",
  aiEnabled = false,
}: {
  variant?: "topbar" | "dashboard";
  aiEnabled?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<SearchResults>(EMPTY);
  const [loading, setLoading] = React.useState(false);
  const [ai, setAi] = React.useState<AiState>(AI_EMPTY);

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

  // KI-Antwort nur auf Enter (kostenkontrolliert, nicht je Tastendruck).
  async function askAi() {
    const q = query.trim();
    if (!aiEnabled || q.length < 2) return;
    setAi({ loading: true, answer: null, relevantIds: new Set() });
    try {
      const res = await fetch("/api/search/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q }),
      });
      const data = (await res.json()) as {
        enabled?: boolean;
        answer?: string | null;
        relevantIds?: string[];
      };
      setAi({
        loading: false,
        answer: data.answer ?? null,
        relevantIds: new Set(data.relevantIds ?? []),
      });
    } catch {
      setAi(AI_EMPTY);
    }
  }

  const groups: { label: string; hits: SearchHit[] }[] = [
    { label: "Kunden", hits: results.customers },
    { label: "Projekte", hits: results.projects },
    { label: "Angebote", hits: results.offers },
    { label: "Produkte", hits: results.products },
    { label: "Mitarbeiter", hits: results.employees },
    { label: "Dateien", hits: results.files },
  ].filter((g) => g.hits.length > 0);

  const total = groups.reduce((s, g) => s + g.hits.length, 0);
  const hasRelevant = ai.relevantIds.size > 0;

  function go(href: string) {
    setOpen(false);
    setQuery("");
    setAi(AI_EMPTY);
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
        {aiEnabled
          ? "Fragen stellen oder suchen … (⌘K)"
          : "Kunden, Projekte, Angebote, Produkte suchen … (⌘K)"}
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
              onChange={(e) => {
                setQuery(e.target.value);
                setAi(AI_EMPTY); // alte KI-Antwort bei neuer Eingabe verwerfen
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void askAi();
                }
              }}
              placeholder={
                aiEnabled
                  ? "Fragen oder suchen … (Enter für KI-Antwort)"
                  : "Suchen … (Name, Nummer, Ort, Artikel)"
              }
              className="h-10 border-0 shadow-none focus-visible:ring-0"
            />
            {aiEnabled && query.trim().length >= 2 && !ai.answer && !ai.loading ? (
              <p className="text-muted-foreground flex items-center gap-1 px-1 pt-1 text-xs">
                <Sparkles className="size-3" /> Enter für die intelligente Antwort
              </p>
            ) : null}
          </div>
          <div className="max-h-[55vh] overflow-y-auto p-2">
            {(ai.loading || ai.answer) && (
              <div className="border-primary/30 bg-primary/5 mb-3 rounded-lg border p-3">
                <p className="text-primary mb-1 flex items-center gap-1 text-xs font-semibold">
                  <Sparkles className="size-3" /> KI-Antwort
                </p>
                {ai.loading ? (
                  <p className="text-muted-foreground text-sm">Denkt nach …</p>
                ) : (
                  <p className="text-sm whitespace-pre-wrap">{ai.answer}</p>
                )}
              </div>
            )}
            {query.trim().length < 2 ? (
              <p className="text-muted-foreground p-3 text-sm">
                Mindestens 2 Zeichen eingeben.
              </p>
            ) : loading && total === 0 ? (
              <p className="text-muted-foreground p-3 text-sm">Suche …</p>
            ) : total === 0 ? (
              <p className="text-muted-foreground p-3 text-sm">Keine Treffer.</p>
            ) : (
              groups.map((g) => {
                // Relevante Treffer (per KI markiert) innerhalb der Gruppe zuerst.
                const hits = hasRelevant
                  ? [...g.hits].sort(
                      (a, b) =>
                        (ai.relevantIds.has(b.id) ? 1 : 0) -
                        (ai.relevantIds.has(a.id) ? 1 : 0),
                    )
                  : g.hits;
                return (
                  <div key={g.label} className="mb-2">
                    <p className="text-muted-foreground px-2 py-1 text-xs font-semibold">
                      {g.label}
                    </p>
                    {hits.map((h) => {
                      const relevant = ai.relevantIds.has(h.id);
                      return (
                        <button
                          key={`${h.type}-${h.id}`}
                          type="button"
                          onClick={() => go(h.href)}
                          className={cn(
                            "hover:bg-muted flex w-full flex-col rounded-md px-2 py-1.5 text-left",
                            relevant && "bg-primary/10 ring-primary/30 ring-1",
                          )}
                        >
                          <span className="flex items-center gap-1 text-sm font-medium">
                            {relevant ? (
                              <Sparkles className="text-primary size-3 shrink-0" />
                            ) : null}
                            {h.label}
                          </span>
                          {h.sub ? (
                            <span className="text-muted-foreground text-xs">{h.sub}</span>
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                );
              })
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
