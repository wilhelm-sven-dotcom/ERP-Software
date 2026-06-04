"use client";

import * as React from "react";
import { Sparkles, Check, X, Download, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface AmbiguityChoice {
  field: string;
  label: string;
  options: { id: string; label: string }[];
}
export interface ProposedAction {
  kind: string;
  title: string;
  summary: string;
  payload: Record<string, unknown>;
  ambiguities?: AmbiguityChoice[];
  ready: boolean;
  report?: { dataset: string; title: string; status?: string; from?: string; to?: string };
}

/**
 * Bestätigungskarte für einen KI-Aktionsvorschlag. Bei mehrdeutigen Referenzen
 * (z. B. mehrere passende Projekte) zeigt sie Auswahlfelder; „Ausführen" ruft
 * /api/assistant/execute. Für Auswertungen (kind="report") gibt es stattdessen
 * einen CSV-Download.
 */
export function ProposedActionCard({
  proposal,
  onDone,
}: {
  proposal: ProposedAction;
  onDone: (note: string | null) => void;
}) {
  const [overrides, setOverrides] = React.useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const a of proposal.ambiguities ?? []) {
      const cur = proposal.payload[a.field];
      init[a.field] = cur != null && cur !== "" ? String(cur) : (a.options[0]?.id ?? "");
    }
    return init;
  });
  const [busy, setBusy] = React.useState(false);
  const [doneState, setDoneState] = React.useState<"open" | "done">("open");

  if (doneState === "done") return null;

  const isReport = proposal.kind === "report";
  const hasAmbig = (proposal.ambiguities?.length ?? 0) > 0;
  const ambigOk = (proposal.ambiguities ?? []).every((a) => overrides[a.field]);
  // Ausführbar, wenn der Vorschlag fertig ist ODER alle Mehrdeutigkeiten gewählt sind.
  const canExecute = isReport || proposal.ready || (hasAmbig && ambigOk);

  function downloadReport() {
    if (!proposal.report) return;
    const r = proposal.report;
    const qs = new URLSearchParams({ dataset: r.dataset, title: r.title });
    if (r.status) qs.set("status", r.status);
    if (r.from) qs.set("from", r.from);
    if (r.to) qs.set("to", r.to);
    const a = document.createElement("a");
    a.href = `/api/assistant/report?${qs.toString()}`;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setDoneState("done");
    onDone("📊 Auswertung als CSV heruntergeladen.");
  }

  async function execute() {
    setBusy(true);
    try {
      const payload = { ...proposal.payload, ...overrides };
      const res = await fetch("/api/assistant/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: proposal.kind, payload }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string | null };
      if (data.ok) {
        toast.success("Erledigt");
        setDoneState("done");
        onDone(`✅ Erledigt: ${proposal.title} — ${proposal.summary}`);
      } else {
        toast.error(data.error ?? "Konnte die Aktion nicht ausführen.");
      }
    } catch {
      toast.error("Konnte die Aktion nicht ausführen.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="border-primary/40 bg-primary/5 rounded-lg border p-3 text-sm">
      <p className="flex items-center gap-1 font-medium">
        <Sparkles className="text-primary size-3.5" /> {proposal.title}
      </p>
      <p className="text-muted-foreground mt-1 text-xs">{proposal.summary}</p>

      {(proposal.ambiguities ?? []).map((a) => (
        <div key={a.field} className="mt-2">
          <p className="text-muted-foreground mb-1 text-xs">{a.label}</p>
          <Select
            value={overrides[a.field] ?? ""}
            onValueChange={(v) => setOverrides((o) => ({ ...o, [a.field]: v }))}
          >
            <SelectTrigger size="sm" className="h-8 w-full">
              <SelectValue placeholder="Bitte wählen …" />
            </SelectTrigger>
            <SelectContent>
              {a.options.map((opt) => (
                <SelectItem key={opt.id} value={opt.id}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ))}

      <div className="mt-3 flex gap-2">
        {isReport ? (
          <Button size="sm" onClick={downloadReport}>
            <Download className="size-4" /> Als CSV herunterladen
          </Button>
        ) : (
          <Button size="sm" disabled={busy || !canExecute} onClick={() => void execute()}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
            {busy ? "…" : "Ausführen"}
          </Button>
        )}
        <Button
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={() => {
            setDoneState("done");
            onDone(null);
          }}
        >
          <X className="size-4" /> Verwerfen
        </Button>
      </div>

      {!isReport && !proposal.ready && (proposal.ambiguities?.length ?? 0) === 0 ? (
        <p className="text-destructive mt-2 text-xs">
          Konnte nicht eindeutig zuordnen — bitte die Anfrage konkreter formulieren.
        </p>
      ) : null}
    </div>
  );
}
