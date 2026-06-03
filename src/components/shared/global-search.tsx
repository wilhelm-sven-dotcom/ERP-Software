"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Search, Sparkles, Send, Check, X, Loader2 } from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { searchAll, type SearchHit, type SearchResults } from "@/app/(app)/search/actions";

const EMPTY: SearchResults = {
  customers: [],
  projects: [],
  offers: [],
  products: [],
  employees: [],
  files: [],
};

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface TaskAction {
  title: string;
  body: string;
  employeeIds: string[];
  employeeNames: string[];
  projectId: string | null;
  projectTitle: string | null;
  unmatched: string[];
}
interface ProposedAction {
  type: "create_task";
  task: TaskAction;
}

/**
 * Globale Suche + KI-Assistent. Öffnet per Klick oder ⌘/Strg+K.
 * - Tippen zeigt sofortige Stichworttreffer (wie bisher).
 * - Mit aktivierter KI (`aiEnabled`) beantwortet Enter Fragen, erstellt
 *   Auswertungen und kann Aufgaben vorschlagen, die der Nutzer bestätigt.
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

  // Assistent
  const [chat, setChat] = React.useState<ChatMessage[]>([]);
  const [thinking, setThinking] = React.useState(false);
  const [proposed, setProposed] = React.useState<ProposedAction | null>(null);
  const [executing, setExecuting] = React.useState(false);
  const threadEndRef = React.useRef<HTMLDivElement>(null);

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

  // Debounced Serversuche (Sofort-Treffer beim Tippen).
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

  React.useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat, thinking, proposed]);

  // KI-Assistent fragen (Enter).
  async function ask() {
    const q = query.trim();
    if (!aiEnabled || q.length < 2 || thinking) return;
    const next: ChatMessage[] = [...chat, { role: "user", content: q }];
    setChat(next);
    setQuery("");
    setResults(EMPTY);
    setProposed(null);
    setThinking(true);
    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next }),
      });
      const data = (await res.json()) as {
        enabled?: boolean;
        answer?: string | null;
        proposedAction?: ProposedAction | null;
      };
      setChat((c) => [
        ...c,
        { role: "assistant", content: data.answer ?? "Dazu habe ich gerade keine Antwort." },
      ]);
      if (data.proposedAction) setProposed(data.proposedAction);
    } catch {
      setChat((c) => [
        ...c,
        { role: "assistant", content: "Es gab ein Problem bei der Anfrage." },
      ]);
    } finally {
      setThinking(false);
    }
  }

  async function runProposed() {
    if (!proposed) return;
    setExecuting(true);
    try {
      const res = await fetch("/api/assistant/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: proposed.type,
          task: {
            title: proposed.task.title,
            body: proposed.task.body,
            employeeIds: proposed.task.employeeIds,
            projectId: proposed.task.projectId,
          },
        }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string | null };
      if (data.ok) {
        toast.success("Aufgabe angelegt");
        setChat((c) => [...c, { role: "assistant", content: "✅ Erledigt — die Aufgabe wurde angelegt." }]);
        setProposed(null);
        router.refresh();
      } else {
        toast.error(data.error ?? "Konnte die Aktion nicht ausführen.");
      }
    } catch {
      toast.error("Konnte die Aktion nicht ausführen.");
    } finally {
      setExecuting(false);
    }
  }

  function resetAll() {
    setChat([]);
    setProposed(null);
    setQuery("");
    setResults(EMPTY);
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
  const hasChat = chat.length > 0 || thinking;

  function go(href: string) {
    setOpen(false);
    resetAll();
    router.push(href);
  }

  const trigger =
    variant === "dashboard" ? (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="bg-card text-muted-foreground hover:border-primary flex w-full items-center gap-2 rounded-lg border px-4 py-3 text-left text-sm transition-colors"
      >
        {aiEnabled ? <Sparkles className="size-4" /> : <Search className="size-4" />}
        {aiEnabled
          ? "Fragen, Auswertungen, Aufgaben oder suchen … (⌘K)"
          : "Kunden, Projekte, Angebote, Produkte suchen … (⌘K)"}
      </button>
    ) : (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-muted-foreground hover:bg-muted flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-sm"
        title="Suchen / KI-Assistent (⌘K)"
      >
        {aiEnabled ? <Sparkles className="size-4" /> : <Search className="size-4" />}
        <span className="hidden md:inline">{aiEnabled ? "Assistent …" : "Suchen …"}</span>
      </button>
    );

  return (
    <>
      {trigger}
      <Dialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) resetAll();
        }}
      >
        <DialogContent className="top-24 max-h-[75vh] translate-y-0 overflow-hidden p-0 sm:max-w-xl">
          <DialogTitle className="sr-only">Suche und KI-Assistent</DialogTitle>
          <div className="flex items-center gap-1 border-b p-2">
            <Input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && aiEnabled) {
                  e.preventDefault();
                  void ask();
                }
              }}
              placeholder={
                aiEnabled
                  ? hasChat
                    ? "Nachfragen … (Enter)"
                    : "Frage stellen, Auswertung oder Aufgabe … (Enter)"
                  : "Suchen … (Name, Nummer, Ort, Artikel)"
              }
              className="h-10 border-0 shadow-none focus-visible:ring-0"
            />
            {aiEnabled ? (
              <Button
                size="icon"
                variant="ghost"
                className="size-9 shrink-0"
                title="An den Assistenten senden"
                disabled={thinking || query.trim().length < 2}
                onClick={() => void ask()}
              >
                <Send className="size-4" />
              </Button>
            ) : null}
          </div>

          <div className="max-h-[60vh] overflow-y-auto p-2">
            {/* Assistenten-Verlauf */}
            {hasChat ? (
              <div className="mb-3 space-y-2">
                {chat.map((m, i) => (
                  <div
                    key={i}
                    className={
                      m.role === "user"
                        ? "bg-primary text-primary-foreground ml-auto max-w-[85%] rounded-lg px-3 py-2 text-sm"
                        : "bg-muted mr-auto max-w-[90%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap"
                    }
                  >
                    {m.content}
                  </div>
                ))}
                {thinking ? (
                  <div className="text-muted-foreground flex items-center gap-2 px-1 text-sm">
                    <Loader2 className="size-4 animate-spin" /> Denkt nach …
                  </div>
                ) : null}

                {/* Bestätigungspflichtige Aktion */}
                {proposed?.type === "create_task" ? (
                  <div className="border-primary/40 bg-primary/5 rounded-lg border p-3 text-sm">
                    <p className="flex items-center gap-1 font-medium">
                      <Sparkles className="text-primary size-3.5" /> Aufgabe anlegen
                    </p>
                    <p className="mt-1">{proposed.task.title}</p>
                    <p className="text-muted-foreground text-xs">
                      An: {proposed.task.employeeNames.join(", ") || "—"}
                      {proposed.task.projectTitle ? ` · Projekt: ${proposed.task.projectTitle}` : ""}
                    </p>
                    {proposed.task.unmatched.length > 0 ? (
                      <p className="text-destructive mt-1 text-xs">
                        Nicht zugeordnet: {proposed.task.unmatched.join(", ")}
                      </p>
                    ) : null}
                    <div className="mt-2 flex gap-2">
                      <Button
                        size="sm"
                        disabled={executing || proposed.task.employeeIds.length === 0}
                        onClick={() => void runProposed()}
                      >
                        <Check className="size-4" /> {executing ? "…" : "Ausführen"}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={executing}
                        onClick={() => setProposed(null)}
                      >
                        <X className="size-4" /> Verwerfen
                      </Button>
                    </div>
                  </div>
                ) : null}
                <div ref={threadEndRef} />
              </div>
            ) : null}

            {/* Sofort-Stichworttreffer (beim Tippen) */}
            {query.trim().length >= 2 ? (
              loading && total === 0 ? (
                <p className="text-muted-foreground p-3 text-sm">Suche …</p>
              ) : total > 0 ? (
                <>
                  {aiEnabled ? (
                    <p className="text-muted-foreground px-2 pb-1 text-xs">
                      Direkte Treffer (Enter fragt den Assistenten):
                    </p>
                  ) : null}
                  {groups.map((g) => (
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
                  ))}
                </>
              ) : !aiEnabled ? (
                <p className="text-muted-foreground p-3 text-sm">Keine Treffer.</p>
              ) : null
            ) : !hasChat ? (
              <p className="text-muted-foreground p-3 text-sm">
                {aiEnabled
                  ? "Stell eine Frage, bitte um eine Auswertung oder gib eine Aufgabe auf — oder tippe, um direkt zu suchen."
                  : "Mindestens 2 Zeichen eingeben."}
              </p>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
