import "server-only";

import type { ChatTool } from "@/lib/ai/openai";
import { searchAll } from "@/app/(app)/search/actions";
import { getProjects } from "@/lib/data/projects";
import { getEmployees } from "@/lib/data/employees";
import { getAdminStats } from "@/lib/data/stats";
import { getOverdueTasks } from "@/lib/data/notifications";
import { customerName } from "@/lib/format";

/**
 * Werkzeuge (Function-Calling) für den KI-Assistenten.
 *
 * LESE-Werkzeuge werden serverseitig ausgeführt (RLS bleibt die Wahrheit) und
 * liefern dem Modell kompakte Fakten für Antworten/Auswertungen.
 * AKTIONS-Werkzeuge (propose_*) werden NICHT ausgeführt, sondern als Vorschlag
 * an die Oberfläche zurückgegeben — der Nutzer bestätigt sie per Klick.
 */
export const ASSISTANT_TOOLS: ChatTool[] = [
  {
    type: "function",
    function: {
      name: "search_data",
      description:
        "Durchsucht Kunden, Projekte, Angebote, Produkte, Mitarbeiter und Dateien nach einem " +
        "Stichwort/Namen/Ort. Für gezielte Suche nach Einträgen.",
      parameters: {
        type: "object",
        properties: { query: { type: "string", description: "Suchbegriff" } },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "company_stats",
      description:
        "Liefert Kennzahlen: angenommener Umsatz, verkaufte kWp/kWh, offene Pipeline (Wert/kWp/kWh) " +
        "sowie Umsatz je Monat (letzte 6 Monate). Für Auswertungen/Übersichten.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "list_projects",
      description:
        "Listet Projekte (optional nach Status gefiltert), je mit Kunde, Status, Ort und Anlagengröße.",
      parameters: {
        type: "object",
        properties: {
          status: {
            type: "string",
            description:
              "Optionaler Status-Filter, z. B. 'Anfrage', 'Angebot', 'gewonnen', 'verloren'.",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "overdue_tasks",
      description: "Listet alle überfälligen, nicht erledigten Aufgaben (projektübergreifend).",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "list_employees",
      description: "Listet aktive Mitarbeiter mit Name und Rolle (für Zuweisungen).",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "propose_task",
      description:
        "Schlägt vor, einem oder mehreren Kollegen eine Aufgabe/Rückfrage zu stellen. WIRD NICHT " +
        "sofort ausgeführt — der Nutzer bestätigt den Vorschlag. Nutze dies, wenn der Nutzer eine " +
        "Aufgabe vergeben/erledigen lassen möchte.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Kurzer Betreff der Aufgabe" },
          body: { type: "string", description: "Beschreibung/Details (optional)" },
          assignees: {
            type: "array",
            items: { type: "string" },
            description: "Namen der zuständigen Kollegen (wie vom Nutzer genannt)",
          },
          project: {
            type: "string",
            description: "Optionaler Projekt-Titel, falls die Aufgabe zu einem Projekt gehört",
          },
        },
        required: ["title", "assignees"],
      },
    },
  },
];

const cut = <T,>(arr: T[], n: number): T[] => arr.slice(0, n);

/** Ein LESE-Werkzeug ausführen und ein kompaktes Ergebnis (JSON-String) liefern. */
export async function runReadTool(name: string, args: Record<string, unknown>): Promise<string> {
  try {
    switch (name) {
      case "search_data": {
        const r = await searchAll(String(args.query ?? ""));
        return JSON.stringify({
          customers: r.customers,
          projects: r.projects,
          offers: r.offers,
          products: r.products,
          employees: r.employees,
          files: r.files,
        });
      }
      case "company_stats": {
        const s = await getAdminStats();
        return JSON.stringify({
          umsatz_angenommen: s.revenueTotal,
          verkauft_kwp: s.soldKwp,
          verkauft_kwh: s.soldKwh,
          pipeline_wert: s.pipelineValue,
          pipeline_kwp: s.pipelineKwp,
          pipeline_kwh: s.pipelineKwh,
          offene_projekte: s.openProjects,
          umsatz_je_monat: s.months.map((m) => ({
            monat: m.label,
            umsatz: m.revenue,
            kwp: m.kwp,
            kwh: m.kwh,
          })),
        });
      }
      case "list_projects": {
        const status = args.status ? String(args.status).toLowerCase() : null;
        const all = await getProjects();
        const filtered = status
          ? all.filter((p) => (p.status ?? "").toLowerCase() === status)
          : all;
        return JSON.stringify({
          anzahl: filtered.length,
          projekte: cut(filtered, 60).map((p) => ({
            id: p.id,
            titel: p.title,
            status: p.status,
            ort: p.city,
            kwp: p.system_size_kwp,
            kunde: p.customer ? customerName(p.customer) : null,
          })),
        });
      }
      case "overdue_tasks": {
        const t = await getOverdueTasks();
        return JSON.stringify({
          anzahl: t.length,
          aufgaben: cut(t, 60).map((x) => ({
            titel: x.title,
            projekt: x.project_title,
            zustaendig: x.assignee_name,
            faellig: x.due_date,
          })),
        });
      }
      case "list_employees": {
        const e = await getEmployees();
        return JSON.stringify(
          e
            .filter((x) => x.active)
            .map((x) => ({
              id: x.id,
              name: x.name ?? x.email,
              rolle: x.role,
              vertrieb: Boolean(x.is_sales),
            })),
        );
      }
      default:
        return JSON.stringify({ error: `Unbekanntes Werkzeug: ${name}` });
    }
  } catch (e) {
    return JSON.stringify({ error: (e as Error).message });
  }
}

export interface ResolvedTask {
  title: string;
  body: string;
  employeeIds: string[];
  employeeNames: string[];
  projectId: string | null;
  projectTitle: string | null;
  unmatched: string[];
}

/** Namen aus propose_task auf echte Mitarbeiter-/Projekt-IDs auflösen. */
export async function resolveProposedTask(args: {
  title?: string;
  body?: string;
  assignees?: string[];
  project?: string;
}): Promise<ResolvedTask> {
  const [employees, projects] = await Promise.all([getEmployees(), getProjects()]);
  const active = employees.filter((e) => e.active);

  const employeeIds: string[] = [];
  const employeeNames: string[] = [];
  const unmatched: string[] = [];
  for (const raw of args.assignees ?? []) {
    const q = raw.trim().toLowerCase();
    if (!q) continue;
    const hit =
      active.find((e) => (e.name ?? "").toLowerCase() === q) ??
      active.find((e) => (e.name ?? "").toLowerCase().includes(q)) ??
      active.find((e) => (e.email ?? "").toLowerCase().includes(q));
    if (hit) {
      if (!employeeIds.includes(hit.id)) {
        employeeIds.push(hit.id);
        employeeNames.push(hit.name ?? hit.email ?? "Mitarbeiter");
      }
    } else {
      unmatched.push(raw);
    }
  }

  let projectId: string | null = null;
  let projectTitle: string | null = null;
  if (args.project) {
    const q = args.project.trim().toLowerCase();
    const hit =
      projects.find((p) => (p.title ?? "").toLowerCase() === q) ??
      projects.find((p) => (p.title ?? "").toLowerCase().includes(q));
    if (hit) {
      projectId = hit.id;
      projectTitle = hit.title ?? null;
    }
  }

  return {
    title: args.title ?? "",
    body: args.body ?? "",
    employeeIds,
    employeeNames,
    projectId,
    projectTitle,
    unmatched,
  };
}
