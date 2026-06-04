import { NextResponse } from "next/server";

import { getCurrentEmployee } from "@/lib/supabase/auth";
import { searchAll, type SearchHit, type SearchResults } from "@/app/(app)/search/actions";
import { chatJSON, isAiConfigured } from "@/lib/ai/openai";

/** Alle Treffer einer SearchResults-Struktur flach als Liste. */
function flatten(r: SearchResults): SearchHit[] {
  return [
    ...r.customers,
    ...r.projects,
    ...r.offers,
    ...r.products,
    ...r.employees,
    ...r.files,
  ];
}

/**
 * Intelligente Such-/Frage-Antwort-Route (RAG-lite, RLS-sicher):
 * Die DB-Stichwortsuche liefert die berechtigten Kandidaten, ChatGPT
 * interpretiert die Frage und formuliert eine Antwort + nennt die
 * relevanten Treffer. Ohne API-Key bzw. Login passiert nichts.
 */
export async function POST(req: Request) {
  const me = await getCurrentEmployee();
  if (!me) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!isAiConfigured()) return NextResponse.json({ enabled: false });

  let query = "";
  try {
    const body = (await req.json()) as { query?: string };
    query = (body.query ?? "").trim();
  } catch {
    return NextResponse.json({ enabled: true, answer: null });
  }
  if (query.length < 2) return NextResponse.json({ enabled: true, answer: null });

  // Kandidaten sammeln: Gesamtanfrage + je bedeutsamem Wort, dedupliziert.
  const seen = new Map<string, SearchHit>();
  const collect = (hits: SearchHit[]) => {
    for (const h of hits) {
      const key = `${h.type}:${h.id}`;
      if (!seen.has(key)) seen.set(key, h);
    }
  };
  collect(flatten(await searchAll(query)));
  if (seen.size < 12) {
    const words = Array.from(new Set(query.split(/\s+/).filter((w) => w.length >= 3))).slice(0, 5);
    const more = await Promise.all(words.map((w) => searchAll(w)));
    for (const r of more) collect(flatten(r));
  }
  const candidates = Array.from(seen.values()).slice(0, 40);

  const result = await chatJSON<{ answer?: string; relevant_ids?: string[] }>([
    {
      role: "system",
      content:
        "Du bist die Such- und Frageassistenz für ein PV-/Speicher-CRM (Vertrieb, Projekte, " +
        "Angebote, Produkte, Dateien). Antworte knapp, klar und auf Deutsch. Interpretiere die " +
        "Frage des Nutzers. Nutze die bereitgestellten Treffer (candidates) als Faktenbasis und " +
        "erfinde keine Daten, Namen oder Zahlen. Passt kein Treffer zur Frage, sag das ehrlich " +
        "und beantworte allgemeine Fragen aus deinem Wissen. Gib relevant_ids als Liste der ids " +
        "der wirklich passenden Treffer zurück. Antworte ausschließlich als JSON " +
        '{"answer": string, "relevant_ids": string[]}.',
    },
    {
      role: "user",
      content: JSON.stringify({ frage: query, candidates }),
    },
  ]);

  if (!result) return NextResponse.json({ enabled: true, answer: null });
  return NextResponse.json({
    enabled: true,
    answer: result.answer ?? null,
    relevantIds: Array.isArray(result.relevant_ids) ? result.relevant_ids : [],
  });
}
