"use client";

import * as React from "react";
import Link from "next/link";
import { Sparkles, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface RankedLead {
  id: string;
  title: string;
  customer: string | null;
  status: string | null;
  score: number;
  reason: string;
  nextAction: string;
}

/** KI-Priorisierung der offenen Leads (auf Knopfdruck). */
export function LeadPriorisierung() {
  const [loading, setLoading] = React.useState(false);
  const [leads, setLeads] = React.useState<RankedLead[] | null>(null);

  async function run() {
    setLoading(true);
    try {
      const res = await fetch("/api/leads/score", { method: "POST" });
      const data = (await res.json()) as { enabled?: boolean; leads?: RankedLead[] };
      setLeads(data.enabled === false ? [] : data.leads ?? []);
    } catch {
      setLeads([]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mb-4">
      {leads === null ? (
        <Button variant="outline" size="sm" onClick={() => void run()} disabled={loading}>
          {loading ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
          KI-Priorisierung der Leads
        </Button>
      ) : (
        <div className="bg-card rounded-lg border p-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="flex items-center gap-1 text-sm font-semibold">
              <Sparkles className="text-primary size-4" /> Priorisierte Leads
            </p>
            <Button variant="ghost" size="sm" onClick={() => void run()} disabled={loading}>
              {loading ? <Loader2 className="size-4 animate-spin" /> : "Neu"}
            </Button>
          </div>
          {leads.length === 0 ? (
            <p className="text-muted-foreground text-sm">Keine offenen Leads (oder KI nicht aktiv).</p>
          ) : (
            <ul className="divide-y">
              {leads.map((l) => (
                <li key={l.id} className="flex items-start justify-between gap-3 py-2 text-sm">
                  <div className="min-w-0">
                    <Link href={`/projekte/${l.id}`} className="font-medium hover:underline">
                      {l.title}
                    </Link>
                    {l.customer ? <span className="text-muted-foreground"> · {l.customer}</span> : null}
                    <p className="text-muted-foreground text-xs">{l.reason}</p>
                    {l.nextAction ? <p className="text-primary text-xs">→ {l.nextAction}</p> : null}
                  </div>
                  <Badge variant={l.score >= 70 ? "default" : "outline"}>{l.score}</Badge>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
