"use client";

import * as React from "react";
import { Sparkles, Send, Loader2 } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ProposedActionCard, type ProposedAction } from "@/components/assistant/proposed-action-card";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

const SUGGESTIONS = [
  "Zeig mir die offenen Posten",
  "Welche Aufgaben sind überfällig?",
  "Umsatz der letzten 6 Monate",
  "Erstell eine Auswertung der offenen Rechnungen als CSV",
];

/**
 * Wiederverwendbarer KI-Assistent-Chat: Fragen, Auswertungen und Aktionen
 * (mit Bestätigung über ProposedActionCard). Wird auf der Assistenten-Seite
 * (groß) und im ⌘K-Schnellfenster (`compact`) genutzt.
 */
export function AssistantChat({ compact = false }: { compact?: boolean }) {
  const [chat, setChat] = React.useState<ChatMessage[]>([]);
  const [query, setQuery] = React.useState("");
  const [thinking, setThinking] = React.useState(false);
  const [proposed, setProposed] = React.useState<ProposedAction | null>(null);
  const endRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat, thinking, proposed]);

  async function ask(text?: string) {
    const q = (text ?? query).trim();
    if (q.length < 2 || thinking) return;
    const next: ChatMessage[] = [...chat, { role: "user", content: q }];
    setChat(next);
    setQuery("");
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
      if (data.enabled === false) {
        setChat((c) => [...c, { role: "assistant", content: "Die KI ist nicht aktiviert (OPENAI_API_KEY fehlt)." }]);
      } else {
        setChat((c) => [...c, { role: "assistant", content: data.answer ?? "Dazu habe ich gerade keine Antwort." }]);
        if (data.proposedAction) setProposed(data.proposedAction);
      }
    } catch {
      setChat((c) => [...c, { role: "assistant", content: "Es gab ein Problem bei der Anfrage." }]);
    } finally {
      setThinking(false);
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className={cn("flex-1 space-y-2 overflow-y-auto", compact ? "max-h-[50vh]" : "min-h-[40vh]")}>
        {chat.length === 0 && !thinking ? (
          <div className="text-muted-foreground p-2 text-sm">
            <p className="mb-2">
              Stell eine Frage, bitte um eine Auswertung oder gib eine Aufgabe auf. Beispiele:
            </p>
            <div className="flex flex-wrap gap-1.5">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => void ask(s)}
                  className="hover:border-primary rounded-full border px-2.5 py-1 text-xs"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : null}

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

        {proposed ? (
          <ProposedActionCard
            proposal={proposed}
            onDone={(note) => {
              setProposed(null);
              if (note) setChat((c) => [...c, { role: "assistant", content: note }]);
            }}
          />
        ) : null}
        <div ref={endRef} />
      </div>

      <div className="mt-2 flex items-center gap-1 border-t pt-2">
        <Input
          autoFocus={!compact}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void ask();
            }
          }}
          placeholder="Frage, Auswertung oder Aufgabe … (Enter)"
          className="h-10"
        />
        <Button
          size="icon"
          className="size-10 shrink-0"
          title="Senden"
          disabled={thinking || query.trim().length < 2}
          onClick={() => void ask()}
        >
          {thinking ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
        </Button>
      </div>
      {!compact ? (
        <p className="text-muted-foreground mt-1 flex items-center gap-1 text-xs">
          <Sparkles className="size-3" /> Antworten basieren auf deinen echten Daten (nur was du
          sehen darfst). Aktionen führst du per Klick aus.
        </p>
      ) : null}
    </div>
  );
}
