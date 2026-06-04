import { NextResponse } from "next/server";

import { getCurrentEmployee } from "@/lib/supabase/auth";
import { chatJSON, isAiConfigured } from "@/lib/ai/openai";
import { getProjects } from "@/lib/data/projects";
import { customerName } from "@/lib/format";

const OPEN = ["anfrage", "angebot"];

interface Ranked {
  ranked?: { id: string; score: number; reason: string; next_action: string }[];
}

/**
 * KI-Priorisierung der offenen Leads (Status Anfrage/Angebot): Reihenfolge nach
 * Abschluss-Wahrscheinlichkeit + konkrete „nächste beste Aktion". RLS-sicher.
 */
export async function POST() {
  const me = await getCurrentEmployee();
  if (!me) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!isAiConfigured()) return NextResponse.json({ enabled: false });

  const all = await getProjects();
  const today = Date.now();
  const leads = all
    .filter((p) => OPEN.includes((p.status ?? "").toLowerCase()))
    .map((p) => ({
      id: p.id,
      titel: p.title,
      status: p.status,
      ort: p.city,
      kunde: p.customer ? customerName(p.customer) : null,
      kwp: p.system_size_kwp,
      alter_tage: Math.round((today - new Date(p.created_at).getTime()) / 86400000),
    }));
  if (leads.length === 0) return NextResponse.json({ enabled: true, leads: [] });

  const result = await chatJSON<Ranked>(
    [
      {
        role: "system",
        content:
          "Du bist Vertriebsassistenz für einen PV-/Speicher-Betrieb. Priorisiere offene Leads nach " +
          "Abschluss-Wahrscheinlichkeit: Status 'Angebot' ist näher am Abschluss als 'Anfrage'; " +
          "ältere Leads ohne Bewegung brauchen dringendes Nachfassen; größere Anlagen (kWp) sind " +
          "wertvoller. Gib je Lead einen score 0..100 und eine kurze, konkrete next_action (z. B. " +
          "'heute anrufen', 'Angebot nachfassen', 'Vor-Ort-Termin vorschlagen'). Antworte als JSON " +
          '{"ranked":[{"id","score","reason","next_action"}]} — nur ids aus der Liste.',
      },
      { role: "user", content: JSON.stringify({ leads }) },
    ],
    { maxTokens: 1200 },
  );

  const byId = new Map(all.map((p) => [p.id, p]));
  const ranked = (result?.ranked ?? [])
    .filter((r) => byId.has(r.id))
    .map((r) => {
      const p = byId.get(r.id)!;
      return {
        id: r.id,
        title: p.title ?? "Lead",
        customer: p.customer ? customerName(p.customer) : null,
        status: p.status,
        score: typeof r.score === "number" ? r.score : 0,
        reason: r.reason ?? "",
        nextAction: r.next_action ?? "",
      };
    })
    .sort((a, b) => b.score - a.score);

  return NextResponse.json({ enabled: true, leads: ranked });
}
