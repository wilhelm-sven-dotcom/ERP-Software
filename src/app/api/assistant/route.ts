import { NextResponse } from "next/server";

import { getCurrentEmployee } from "@/lib/supabase/auth";
import { chatRaw, isAiConfigured, type ToolCall } from "@/lib/ai/openai";
import {
  ASSISTANT_TOOLS,
  runReadTool,
  resolveProposedTask,
  type ResolvedTask,
} from "@/lib/ai/assistant-tools";

interface IncomingMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ProposedAction {
  type: "create_task";
  task: ResolvedTask;
}

const MAX_STEPS = 6;

const SYSTEM = `Du bist der KI-Assistent eines PV-/Speicher-CRM (ip³ PV-Tool) für ein Handwerks-/
Vertriebsteam. Du hilfst bei drei Dingen:
1. Fragen beantworten — nutze die Werkzeuge, um echte Daten zu holen, statt zu raten.
2. Auswertungen/Übersichten erstellen (z. B. Umsatz, Pipeline, überfällige Aufgaben).
3. Aufgaben vergeben — wenn der Nutzer jemandem etwas auftragen will, rufe propose_task auf.
   Aktionen werden NICHT von dir ausgeführt, sondern dem Nutzer zur Bestätigung vorgeschlagen.

Antworte knapp, klar und auf Deutsch. Erfinde keine Zahlen, Namen oder Datensätze — wenn du etwas
nicht über die Werkzeuge belegen kannst, sage das. Formuliere Auswertungen übersichtlich
(kurze Aufzählungen, konkrete Zahlen).`;

/**
 * KI-Assistent mit Werkzeug-Schleife (Agent). Lese-Werkzeuge werden serverseitig
 * (RLS-sicher) ausgeführt; eine vorgeschlagene Aktion (propose_*) wird nicht
 * ausgeführt, sondern als bestätigungspflichtiger Vorschlag zurückgegeben.
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
      .slice(-12); // Verlauf begrenzen (Kosten/Tokens)
  } catch {
    return NextResponse.json({ enabled: true, answer: null });
  }
  if (incoming.length === 0) return NextResponse.json({ enabled: true, answer: null });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const messages: any[] = [{ role: "system", content: SYSTEM }, ...incoming];

  for (let step = 0; step < MAX_STEPS; step++) {
    const msg = await chatRaw(messages, { tools: ASSISTANT_TOOLS });
    if (!msg) return NextResponse.json({ enabled: true, answer: null });

    const toolCalls = msg.tool_calls ?? [];
    if (toolCalls.length === 0) {
      return NextResponse.json({ enabled: true, answer: msg.content ?? "" });
    }

    // Aktionsvorschlag? → nicht ausführen, sondern zur Bestätigung zurückgeben.
    const propose = toolCalls.find((t) => t.function.name.startsWith("propose_"));
    if (propose) {
      const args = parseArgs(propose);
      if (propose.function.name === "propose_task") {
        const task = await resolveProposedTask(args);
        const answer = buildTaskAnswer(task);
        return NextResponse.json({
          enabled: true,
          answer,
          proposedAction: { type: "create_task", task } satisfies ProposedAction,
        });
      }
    }

    // Lese-Werkzeuge ausführen und Ergebnisse zurückspeisen.
    messages.push(msg);
    for (const call of toolCalls) {
      const args = parseArgs(call);
      const result = await runReadTool(call.function.name, args);
      messages.push({ role: "tool", tool_call_id: call.id, content: result });
    }
  }

  return NextResponse.json({
    enabled: true,
    answer:
      "Ich konnte die Anfrage nicht vollständig auflösen. Bitte formuliere sie etwas konkreter.",
  });
}

function parseArgs(call: ToolCall): Record<string, unknown> {
  try {
    return JSON.parse(call.function.arguments || "{}");
  } catch {
    return {};
  }
}

function buildTaskAnswer(task: ResolvedTask): string {
  const who = task.employeeNames.length > 0 ? task.employeeNames.join(", ") : "(noch niemand erkannt)";
  const parts = [`Vorschlag: Aufgabe „${task.title}" an ${who}.`];
  if (task.projectTitle) parts.push(`Projekt: ${task.projectTitle}.`);
  if (task.unmatched.length > 0)
    parts.push(`Nicht zugeordnet: ${task.unmatched.join(", ")}.`);
  parts.push("Bitte unten bestätigen.");
  return parts.join(" ");
}
