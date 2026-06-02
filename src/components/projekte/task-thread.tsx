"use client";

import * as React from "react";
import { Send } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { postTaskMessage, markTaskRead } from "@/app/(app)/workflow/actions";
import { cn } from "@/lib/utils";
import { formatDateTime } from "@/lib/format";

interface Msg {
  id: string;
  author_employee_id: string | null;
  body: string;
  kind: string;
  created_at: string;
  author?: { name: string | null } | null;
}

/** Messenger-Verlauf einer Aufgabe mit Live-Aktualisierung (Supabase Realtime). */
export function TaskThread({
  taskId,
  taskTitle,
  currentEmployeeId,
  trigger,
}: {
  taskId: string;
  taskTitle: string;
  currentEmployeeId: string | null;
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
  const [messages, setMessages] = React.useState<Msg[]>([]);
  const [body, setBody] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const endRef = React.useRef<HTMLDivElement>(null);

  const load = React.useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("task_messages")
      .select("*, author:employees(name)")
      .eq("task_id", taskId)
      .order("created_at", { ascending: true });
    setMessages((data ?? []) as Msg[]);
  }, [taskId]);

  // Beim Öffnen laden, als gelesen markieren und live abonnieren.
  React.useEffect(() => {
    if (!open) return;
    void load();
    void markTaskRead(taskId);
    const supabase = createClient();
    const channel = supabase
      .channel(`task-${taskId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "task_messages", filter: `task_id=eq.${taskId}` },
        () => void load(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [open, taskId, load]);

  React.useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send() {
    const v = body.trim();
    if (!v) return;
    setSending(true);
    const fd = new FormData();
    fd.set("task_id", taskId);
    fd.set("body", v);
    const res = await postTaskMessage({ ok: false }, fd);
    setSending(false);
    if (res.ok) {
      setBody("");
      void load();
    } else {
      toast.error(res.error ?? "Nachricht konnte nicht gesendet werden");
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="flex max-h-[80vh] flex-col sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="truncate">{taskTitle}</DialogTitle>
          <DialogDescription>Verlauf & Rücksprache zu dieser Aufgabe.</DialogDescription>
        </DialogHeader>

        <div className="flex-1 space-y-2 overflow-y-auto pr-1">
          {messages.length === 0 ? (
            <p className="text-muted-foreground py-6 text-center text-sm">
              Noch keine Nachrichten.
            </p>
          ) : (
            messages.map((m) =>
              m.kind === "event" ? (
                <p key={m.id} className="text-muted-foreground text-center text-xs">
                  — {m.body} ({formatDateTime(m.created_at)}) —
                </p>
              ) : (
                <div
                  key={m.id}
                  className={cn(
                    "max-w-[80%] rounded-lg border px-3 py-2 text-sm",
                    m.author_employee_id === currentEmployeeId
                      ? "bg-primary/10 ml-auto"
                      : "bg-muted/40",
                  )}
                >
                  <p className="text-muted-foreground text-xs">
                    {m.author?.name ?? "Mitarbeiter"} · {formatDateTime(m.created_at)}
                  </p>
                  <p className="whitespace-pre-wrap">{m.body}</p>
                </div>
              ),
            )
          )}
          <div ref={endRef} />
        </div>

        <div className="flex gap-2 border-t pt-3">
          <Input
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder="Nachricht schreiben …"
          />
          <Button onClick={send} disabled={sending} size="icon" title="Senden">
            <Send className="size-4" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
