"use client";

import * as React from "react";
import Link from "next/link";
import { Send, Loader2, Plus, MessageSquare, Trash2, Sparkles } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { GlobalFileDrop } from "@/components/shared/global-file-drop";
import type { Product } from "@/lib/types";
import { ProposedActionCard, type ProposedAction } from "@/components/assistant/proposed-action-card";
import {
  createConversation,
  appendMessages,
  listConversations,
  loadConversation,
  deleteConversation,
} from "@/app/(app)/assistent/actions";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}
interface ConversationRow {
  id: string;
  title: string | null;
  updated_at: string;
}

const SUGGESTIONS = [
  "Zeig mir die offenen Posten",
  "Welche Aufgaben sind überfällig?",
  "Umsatz der letzten 6 Monate",
  "Erstell eine Auswertung der offenen Rechnungen als CSV",
];

/**
 * KI-Assistent im Gemini-Stil: zentrierte Begrüßung + großes Eingabefeld im
 * leeren Zustand, Gesprächsverlauf links (gespeichert je Mitarbeiter),
 * Aktionen mit Bestätigung über ProposedActionCard.
 */
export function AssistantChat({
  firstName,
  projects = [],
  products = [],
  aiEnabled = false,
  initialConversations = [],
  briefing = [],
}: {
  firstName?: string;
  projects?: { id: string; title: string }[];
  products?: Product[];
  aiEnabled?: boolean;
  initialConversations?: ConversationRow[];
  briefing?: { label: string; href: string; tone?: "warn" }[];
}) {
  const [chat, setChat] = React.useState<ChatMessage[]>([]);
  const [query, setQuery] = React.useState("");
  const [thinking, setThinking] = React.useState(false);
  const [proposed, setProposed] = React.useState<ProposedAction | null>(null);
  const [conversationId, setConversationId] = React.useState<string | null>(null);
  const [conversations, setConversations] = React.useState<ConversationRow[]>(initialConversations);
  const endRef = React.useRef<HTMLDivElement>(null);

  async function refreshList() {
    try {
      const list = await listConversations();
      setConversations(list.map((c) => ({ id: c.id, title: c.title, updated_at: c.updated_at })));
    } catch {
      /* still */
    }
  }

  React.useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat, thinking, proposed]);

  function newChat() {
    setChat([]);
    setProposed(null);
    setConversationId(null);
    setQuery("");
  }

  async function openConversation(id: string) {
    if (id === conversationId) return;
    setProposed(null);
    setThinking(true);
    try {
      const msgs = await loadConversation(id);
      setChat(msgs.map((m) => ({ role: m.role, content: m.content })));
      setConversationId(id);
    } finally {
      setThinking(false);
    }
  }

  async function removeConversation(id: string) {
    await deleteConversation(id);
    if (id === conversationId) newChat();
    void refreshList();
  }

  async function ask(text?: string) {
    const q = (text ?? query).trim();
    if (q.length < 2 || thinking) return;
    const next: ChatMessage[] = [...chat, { role: "user", content: q }];
    setChat(next);
    setQuery("");
    setProposed(null);
    setThinking(true);

    // Gespräch beim ersten Beitrag anlegen.
    let convId = conversationId;
    if (!convId) {
      const res = await createConversation(q);
      if (res.ok && res.id) {
        convId = res.id;
        setConversationId(convId);
        void refreshList();
      }
    }

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
      const answer =
        data.enabled === false
          ? "Die KI ist nicht aktiviert (OPENAI_API_KEY fehlt)."
          : data.answer ?? "Dazu habe ich gerade keine Antwort.";
      setChat((c) => [...c, { role: "assistant", content: answer }]);
      if (data.proposedAction) setProposed(data.proposedAction);
      if (convId) void appendMessages(convId, [{ role: "user", content: q }, { role: "assistant", content: answer }]);
    } catch {
      setChat((c) => [...c, { role: "assistant", content: "Es gab ein Problem bei der Anfrage." }]);
    } finally {
      setThinking(false);
    }
  }

  const empty = chat.length === 0 && !thinking;

  const canAttach = projects.length > 0;
  const inputBar = (
    <div className="flex items-center gap-2">
      <div className="bg-card focus-within:border-primary flex flex-1 items-center gap-2 rounded-full border px-4 py-1 shadow-sm transition-colors">
        {canAttach ? (
          <Dialog>
            <DialogTrigger asChild>
              <button
                type="button"
                title="Dokument hochladen (KI ordnet zu)"
                className="text-muted-foreground hover:text-foreground shrink-0"
              >
                <Plus className="size-5" />
              </button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-2xl">
              <DialogHeader>
                <DialogTitle>Dokument hochladen</DialogTitle>
              </DialogHeader>
              <p className="text-muted-foreground mb-2 text-sm">
                Datenblatt, Rechnung, Plan oder Foto hierher ziehen — die KI liest es aus und schlägt
                die richtige Zuordnung vor.
              </p>
              <GlobalFileDrop projects={projects} products={products} aiEnabled={aiEnabled} />
            </DialogContent>
          </Dialog>
        ) : (
          <Sparkles className="text-muted-foreground size-4 shrink-0" />
        )}
        <Input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void ask();
            }
          }}
          placeholder="Frage stellen, Auswertung anfordern oder Aufgabe vergeben …"
          className="h-10 border-0 bg-transparent shadow-none focus-visible:ring-0"
        />
        <Button
          size="icon"
          className="size-9 shrink-0 rounded-full"
          title="Senden"
          disabled={thinking || query.trim().length < 2}
          onClick={() => void ask()}
        >
          {thinking ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
        </Button>
      </div>
    </div>
  );

  return (
    <div className="flex h-[calc(100vh-9rem)] gap-4">
      {/* Verlauf */}
      <aside className="hidden w-60 shrink-0 flex-col md:flex">
        <Button variant="outline" size="sm" className="mb-2 justify-start gap-2" onClick={newChat}>
          <Plus className="size-4" /> Neuer Chat
        </Button>
        <div className="flex-1 space-y-0.5 overflow-y-auto">
          {conversations.length === 0 ? (
            <p className="text-muted-foreground px-2 py-1 text-xs">Noch keine Gespräche.</p>
          ) : (
            conversations.map((c) => (
              <div
                key={c.id}
                className={cn(
                  "group flex items-center gap-1 rounded-md px-2 py-1.5 text-sm",
                  c.id === conversationId ? "bg-muted" : "hover:bg-muted/60",
                )}
              >
                <button
                  type="button"
                  onClick={() => void openConversation(c.id)}
                  className="flex min-w-0 flex-1 items-center gap-2 text-left"
                >
                  <MessageSquare className="text-muted-foreground size-3.5 shrink-0" />
                  <span className="truncate">{c.title ?? "Gespräch"}</span>
                </button>
                <button
                  type="button"
                  title="Löschen"
                  onClick={() => void removeConversation(c.id)}
                  className="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            ))
          )}
        </div>
      </aside>

      {/* Chat / Hero */}
      <div className="flex min-w-0 flex-1 flex-col">
        {empty ? (
          <div className="flex flex-1 flex-col items-center justify-center px-2">
            <h1 className="mb-8 text-center text-3xl font-semibold tracking-tight sm:text-4xl">
              Was steht als Nächstes an{firstName ? `, ${firstName}` : ""}?
            </h1>
            <div className="w-full max-w-2xl">{inputBar}</div>
            <div className="mt-4 flex max-w-2xl flex-wrap justify-center gap-1.5">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => void ask(s)}
                  className="hover:border-primary text-muted-foreground rounded-full border px-3 py-1.5 text-xs"
                >
                  {s}
                </button>
              ))}
            </div>

            {briefing.length > 0 ? (
              <div className="mt-8 w-full max-w-2xl">
                <p className="text-muted-foreground mb-2 text-center text-xs">Heute für dich:</p>
                <div className="flex flex-wrap justify-center gap-2">
                  {briefing.map((b) => (
                    <Link
                      key={b.label}
                      href={b.href}
                      className={cn(
                        "rounded-lg border px-3 py-1.5 text-sm transition-colors",
                        b.tone === "warn"
                          ? "border-destructive/40 bg-destructive/5 text-destructive hover:bg-destructive/10"
                          : "hover:border-primary",
                      )}
                    >
                      {b.label}
                    </Link>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : (
          <>
            <div className="flex-1 space-y-2 overflow-y-auto pr-1">
              {chat.map((m, i) => (
                <div
                  key={i}
                  className={
                    m.role === "user"
                      ? "bg-primary text-primary-foreground ml-auto max-w-[85%] rounded-2xl px-4 py-2 text-sm"
                      : "bg-muted mr-auto max-w-[90%] rounded-2xl px-4 py-2 text-sm whitespace-pre-wrap"
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
                    if (note) {
                      setChat((c) => [...c, { role: "assistant", content: note }]);
                      if (conversationId) void appendMessages(conversationId, [{ role: "assistant", content: note }]);
                    }
                  }}
                />
              ) : null}
              <div ref={endRef} />
            </div>
            <div className="mt-3">{inputBar}</div>
          </>
        )}
      </div>
    </div>
  );
}
