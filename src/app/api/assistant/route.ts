import { NextResponse } from "next/server";

import { getCurrentEmployee } from "@/lib/supabase/auth";
import { chatRaw, isAiConfigured, type ToolCall } from "@/lib/ai/openai";
import {
  ASSISTANT_TOOLS,
  isActionTool,
  runReadTool,
  buildProposal,
} from "@/lib/ai/assistant-tools";

interface IncomingMessage {
  role: "user" | "assistant";
  content: string;
}

const MAX_STEPS = 6;

function systemPrompt(me: { name: string | null; role: string; is_sales: boolean }): string {
  const today = new Date().toISOString().slice(0, 10);
  return `Du bist der KI-Assistent eines PV-/Speicher-CRM (ip³ PV-Tool) für ein Handwerks-/
Vertriebsteam. Du hilfst ${me.name ?? "dem Nutzer"} (Rolle: ${me.role}${me.is_sales ? ", Vertrieb" : ""}).
Heute ist ${today}. Du siehst nur Daten, die dieser Nutzer sehen darf (Datenbank-Rechte/RLS).

Aufgaben:
1. Fragen beantworten — nutze die Lese-Werkzeuge, um echte Daten zu holen, statt zu raten.
   Für Fragen zum INHALT von Dokumenten/Datenblättern nutze document_search.
2. Auswertungen/Übersichten erstellen. Für exportierbare Auswertungen nutze propose_report.
3. Aufgaben/Vorgänge ausführen — nutze die passenden propose_*-Werkzeuge. Diese werden NICHT
   von dir ausgeführt, sondern dem Nutzer zur Bestätigung vorgeschlagen.
4. Tagesüberblick: Wird nach „was steht heute an" gefragt, hole überfällige Aufgaben, eigenen
   Überblick, offene Posten und fällige Wartungen und gib eine kurze, priorisierte To-do-Liste.

Antworte knapp, klar und auf Deutsch. Erfinde keine Zahlen, Namen oder Datensätze; wenn ein
Werkzeug nichts liefert, sage das. Zeige je Antwort höchstens die ~10–20 relevantesten Einträge.
Wenn der Nutzer etwas ändern/anlegen will, rufe genau EIN passendes propose_*-Werkzeug auf.`;
}

/**
 * KI-Assistent mit Werkzeug-Schleife (Agent). Lese-Werkzeuge laufen serverseitig
 * (RLS-sicher); ein propose_*-Aufruf wird nicht ausgeführt, sondern als
 * bestätigungspflichtiger Vorschlag zurückgegeben.
 */
export async function POST(req: Request) {
  const me = await getCurrentEmployee();
  if (!me) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!isAiConfigured()) return NextResponse.json({ enabled: false });

  let incoming: IncomingMessage[] = [];
  try {
    const body = (await req.json()) as { messages?: IncomingMessage[] };
    incoming = (body.messages ?? [])
      .filter((m) => m && (m.role === "user" || m.role === "assistant") && m.content)
      .slice(-12);
  } catch {
    return NextResponse.json({ enabled: true, answer: null });
  }
  if (incoming.length === 0) return NextResponse.json({ enabled: true, answer: null });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const messages: any[] = [{ role: "system", content: systemPrompt(me) }, ...incoming];

  for (let step = 0; step < MAX_STEPS; step++) {
    const msg = await chatRaw(messages, { tools: ASSISTANT_TOOLS });
    if (!msg) return NextResponse.json({ enabled: true, answer: null });

    const toolCalls = msg.tool_calls ?? [];
    if (toolCalls.length === 0) {
      return NextResponse.json({ enabled: true, answer: msg.content ?? "" });
    }

    // Aktionsvorschlag? → nicht ausführen, sondern zur Bestätigung zurückgeben.
    const action = toolCalls.find((t) => isActionTool(t.function.name));
    if (action) {
      const proposal = await buildProposal(action.function.name, parseArgs(action));
      const answer = proposal
        ? `${proposal.summary}${proposal.ready ? " — bitte unten bestätigen." : " — bitte unten ergänzen/auswählen."}`
        : "Ich konnte keinen passenden Vorschlag bilden.";
      return NextResponse.json({ enabled: true, answer, proposedAction: proposal });
    }

    // Lese-Werkzeuge ausführen und Ergebnisse zurückspeisen.
    messages.push(msg);
    for (const call of toolCalls) {
      const result = await runReadTool(call.function.name, parseArgs(call), me);
      messages.push({ role: "tool", tool_call_id: call.id, content: result });
    }
  }

  return NextResponse.json({
    enabled: true,
    answer: "Ich konnte die Anfrage nicht vollständig auflösen. Bitte formuliere sie etwas konkreter.",
  });
}

function parseArgs(call: ToolCall): Record<string, unknown> {
  try {
    return JSON.parse(call.function.arguments || "{}");
  } catch {
    return {};
  }
}
