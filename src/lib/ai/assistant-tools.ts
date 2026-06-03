import "server-only";

import type { ChatTool } from "@/lib/ai/openai";
import { createClient } from "@/lib/supabase/server";
import { searchAll } from "@/app/(app)/search/actions";
import {
  getProjects,
  getProject,
  getProjectsByCustomer,
  getProjectActivities,
} from "@/lib/data/projects";
import { getProjectTasks, getMyOpenTasks } from "@/lib/data/workflow";
import { getCustomers, getCustomer, getCustomerActivities } from "@/lib/data/customers";
import { getEmployees } from "@/lib/data/employees";
import { getAdminStats } from "@/lib/data/stats";
import { getOverdueTasks, getInbox } from "@/lib/data/notifications";
import { getAllOffers, getOffersByProject } from "@/lib/data/offers";
import { getDocumentsByKind } from "@/lib/data/documents";
import { getServiceTickets } from "@/lib/data/service";
import { getServiceContracts, getDueServiceContracts } from "@/lib/data/service-contracts";
import { getDispoEntries } from "@/lib/data/dispo";
import { getTimeEntries, getTimeEntriesByProject } from "@/lib/data/time";
import { getProducts } from "@/lib/data/products";
import { getCalculationByProject } from "@/lib/data/calculations";
import { customerName } from "@/lib/format";

/**
 * Werkzeuge (Function-Calling) für den KI-Assistenten.
 *
 * LESE-Werkzeuge werden serverseitig ausgeführt (RLS bleibt die Wahrheit) und
 * liefern dem Modell kompakte, gedeckelte Fakten für Antworten/Auswertungen.
 * AKTIONS-Werkzeuge (propose_*) werden NICHT ausgeführt, sondern als Vorschlag
 * an die Oberfläche zurückgegeben — der Nutzer bestätigt sie per Klick.
 */

const obj = (props: Record<string, unknown>, required: string[] = []) => ({
  type: "object",
  properties: props,
  ...(required.length ? { required } : {}),
});
const str = (description: string) => ({ type: "string", description });

export const ASSISTANT_TOOLS: ChatTool[] = [
  // ---- LESE-Werkzeuge ----
  fn("search_data", "Durchsucht Kunden, Projekte, Angebote, Produkte, Mitarbeiter und Dateien (Name/Inhalt/Ort) nach einem Stichwort.", obj({ query: str("Suchbegriff") }, ["query"])),
  fn("company_stats", "Kennzahlen: angenommener Umsatz, verkaufte kWp/kWh, offene Pipeline (Wert/kWp/kWh), Umsatz je Monat (6 Monate).", obj({})),
  fn("list_projects", "Listet Projekte (optional nach Status), je mit Kunde, Status, Ort, kWp.", obj({ status: str("Optionaler Status, z. B. Anfrage, Angebot, gewonnen, verloren") })),
  fn("get_project_detail", "Details zu EINEM Projekt: Stammdaten, Aufgaben, Angebote, Kalkulation, jüngste Aktivitäten. query = Titel/Ort/Kunde oder ID.", obj({ query: str("Projekt-Titel, Ort, Kunde oder ID") }, ["query"])),
  fn("list_customers", "Listet Kunden (optional nach Name/Ort gefiltert), gedeckelt.", obj({ query: str("Optionaler Filter (Name, Firma, Ort)") })),
  fn("get_customer_detail", "Details zu EINEM Kunden: Stammdaten, Projekte, jüngste Aktivitäten.", obj({ query: str("Kundenname, Firma, Nr. oder ID") }, ["query"])),
  fn("list_offers", "Listet Angebote (optional nach Status), mit Nummer, Projekt, Kunde, Summe.", obj({ status: str("Optionaler Status, z. B. Entwurf, Versendet, Angenommen") })),
  fn("list_invoices", "Listet Rechnungen (optional nach Zahlungsstatus offen/bezahlt/überfällig), mit Nummer, Betrag, Fälligkeit.", obj({ status: str("Optional: offen | bezahlt | ueberfaellig") })),
  fn("open_items", "Offene/überfällige Rechnungen (offene Posten) mit Betrag und Tagen überfällig.", obj({})),
  fn("overdue_tasks", "Alle überfälligen, nicht erledigten Aufgaben (projektübergreifend).", obj({})),
  fn("list_service_tickets", "Service-Tickets (optional nach Status), mit Kunde/Ort.", obj({ status: str("Optionaler Service-Status") })),
  fn("due_maintenance", "Demnächst fällige Wartungsverträge.", obj({ days: { type: "number", description: "Zeitfenster in Tagen (Default 30)" } })),
  fn("list_dispo", "Plantafel-/Einsatz-Einträge in einem Zeitraum.", obj({ from: str("Von-Datum YYYY-MM-DD"), to: str("Bis-Datum YYYY-MM-DD") }, ["from", "to"])),
  fn("time_summary", "Zeiterfassung: Summe Stunden, optional je Projekt. project = Titel/ID.", obj({ project: str("Optional: Projekt-Titel oder ID") })),
  fn("list_products", "Produktkatalog (optional gefiltert), mit Hersteller/Preis.", obj({ query: str("Optionaler Filter (Name, Hersteller, Artikelnr.)") })),
  fn("list_employees", "Aktive Mitarbeiter mit Name und Rolle (für Zuweisungen).", obj({})),
  fn("my_overview", "Eigener Überblick des angemeldeten Nutzers: Posteingang + offene Aufgaben.", obj({})),

  // ---- AKTIONS-Werkzeuge (Vorschlag → Bestätigung) ----
  fn("propose_task", "Schlägt vor, einem/mehreren Kollegen eine Aufgabe/Rückfrage zu stellen. Wird erst nach Bestätigung angelegt.", obj({
    title: str("Kurzer Betreff"), body: str("Beschreibung (optional)"),
    assignees: { type: "array", items: { type: "string" }, description: "Namen der Kollegen" },
    project: str("Optionaler Projekt-Titel"),
  }, ["title", "assignees"])),
  fn("propose_complete_task", "Schlägt vor, eine offene Aufgabe als erledigt zu markieren.", obj({ task: str("Aufgaben-Titel (Stichwort)"), project: str("Optional: Projekt zur Eingrenzung") }, ["task"])),
  fn("propose_assign_task", "Schlägt vor, eine Aufgabe einem Kollegen zuzuweisen.", obj({ task: str("Aufgaben-Titel"), assignee: str("Name des Kollegen") }, ["task", "assignee"])),
  fn("propose_set_project_status", "Schlägt vor, den Status/die Pipeline-Stufe eines Projekts zu ändern.", obj({ project: str("Projekt-Titel/Kunde/ID"), status: str("Ziel-Status, z. B. Angebot, Auftrag, gewonnen") }, ["project", "status"])),
  fn("propose_move_service_ticket", "Schlägt vor, ein Service-Ticket in eine andere Spalte/Status zu verschieben.", obj({ ticket: str("Ticket-Titel/Stichwort"), status: str("Ziel-Status") }, ["ticket", "status"])),
  fn("propose_complete_maintenance", "Schlägt vor, eine Wartung als erledigt zu markieren (nächste Fälligkeit wird gesetzt).", obj({ contract: str("Vertrag/Kunde/Titel") }, ["contract"])),
  fn("propose_add_activity", "Schlägt vor, einen Logbuch-/Aktivitätseintrag zu einem Projekt zu erstellen.", obj({ project: str("Projekt"), title: str("Titel des Eintrags"), body: str("Text (optional)") }, ["project", "title"])),
  fn("propose_add_site_log", "Schlägt vor, einen Bautagebuch-Eintrag zu einem Projekt zu erstellen.", obj({ project: str("Projekt"), work_done: str("Ausgeführte Arbeiten"), weather: str("Wetter (optional)"), crew: str("Mannschaft (optional)"), note: str("Notiz (optional)") }, ["project", "work_done"])),
  fn("propose_mark_invoice_paid", "Schlägt vor, eine Rechnung als bezahlt zu markieren.", obj({ invoice: str("Rechnungsnummer oder Projekt"), amount: { type: "number", description: "Betrag (optional, sonst Bruttobetrag)" } }, ["invoice"])),
  fn("propose_create_customer", "Schlägt vor, einen neuen Kunden anzulegen.", obj({
    kind: str("privat oder gewerbe"), company: str("Firma (gewerbe)"), first_name: str("Vorname"), last_name: str("Nachname"),
    email: str("E-Mail"), phone: str("Telefon"), street: str("Straße"), zip: str("PLZ"), city: str("Ort"), notes: str("Notiz"),
  })),
  fn("propose_create_lead", "Schlägt vor, eine neue Anfrage/Lead anzulegen (Kunde + Projekt + Vertriebszuweisung).", obj({
    kind: str("privat oder gewerbe"), company: str("Firma"), first_name: str("Vorname"), last_name: str("Nachname"),
    email: str("E-Mail"), phone: str("Telefon"), street: str("Straße"), zip: str("PLZ"), city: str("Ort"),
    source: str("Quelle, z. B. Empfehlung, Website"), notes: str("Notiz"),
    assignees: { type: "array", items: { type: "string" }, description: "Vertriebsmitarbeiter (Namen)" },
  }, ["last_name"])),
  fn("propose_create_offer", "Schlägt vor, aus der Kalkulation eines Projekts ein Angebot zu erzeugen.", obj({ project: str("Projekt-Titel/Kunde/ID") }, ["project"])),
  fn("propose_create_invoice", "Schlägt vor, eine Rechnung zu erstellen (Voll-/Abschlags-/Schlussrechnung) aus dem Angebot eines Projekts.", obj({ project: str("Projekt"), invoice_type: str("voll | abschlag | schluss"), percent: { type: "number", description: "Prozent (nur Abschlag)" } }, ["project"])),
  fn("propose_report", "Schlägt eine Auswertung vor, die als CSV exportiert werden kann.", obj({
    dataset: str("Datensatz: invoices | open_items | projects | customers | offers | overdue_tasks | time"),
    title: str("Titel der Auswertung"),
    status: str("Optionaler Statusfilter"), from: str("Optional Von-Datum"), to: str("Optional Bis-Datum"),
  }, ["dataset", "title"])),
];

function fn(name: string, description: string, parameters: unknown): ChatTool {
  return { type: "function", function: { name, description, parameters: parameters as Record<string, unknown> } };
}

const cut = <T,>(arr: T[], n: number): T[] => arr.slice(0, n);
const num = (v: unknown): number => (typeof v === "number" ? v : 0);
const brutto = (totals: Record<string, unknown>): number => num((totals as { brutto?: number }).brutto);

export function isActionTool(name: string): boolean {
  return name.startsWith("propose_");
}

// ===========================================================================
// LESE-Werkzeuge ausführen (RLS-sicher; alle Listen gedeckelt/kompakt)
// ===========================================================================
export async function runReadTool(
  name: string,
  args: Record<string, unknown>,
  me: { id: string } | null,
): Promise<string> {
  try {
    switch (name) {
      case "search_data": {
        const r = await searchAll(String(args.query ?? ""));
        return JSON.stringify(r);
      }
      case "company_stats": {
        const s = await getAdminStats();
        return JSON.stringify({
          umsatz_angenommen: s.revenueTotal, verkauft_kwp: s.soldKwp, verkauft_kwh: s.soldKwh,
          pipeline_wert: s.pipelineValue, pipeline_kwp: s.pipelineKwp, pipeline_kwh: s.pipelineKwh,
          offene_projekte: s.openProjects,
          umsatz_je_monat: s.months.map((m) => ({ monat: m.label, umsatz: m.revenue, kwp: m.kwp, kwh: m.kwh })),
        });
      }
      case "list_projects": {
        const status = args.status ? String(args.status).toLowerCase() : null;
        const all = await getProjects();
        const f = status ? all.filter((p) => (p.status ?? "").toLowerCase() === status) : all;
        return JSON.stringify({
          gesamt: f.length, angezeigt: Math.min(f.length, 60),
          projekte: cut(f, 60).map((p) => ({ id: p.id, titel: p.title, status: p.status, ort: p.city, kwp: p.system_size_kwp, kunde: p.customer ? customerName(p.customer) : null })),
        });
      }
      case "get_project_detail": {
        const p = await resolveProjectRow(String(args.query ?? ""));
        if (!p) return JSON.stringify({ gefunden: false });
        const [tasks, offers, calc, acts] = await Promise.all([
          getProjectTasks(p.id), getOffersByProject(p.id), getCalculationByProject(p.id), getProjectActivities(p.id),
        ]);
        return JSON.stringify({
          gefunden: true,
          projekt: { id: p.id, titel: p.title, status: p.status, ort: p.city, kwp: p.system_size_kwp, kunde: p.customer ? customerName(p.customer) : null },
          aufgaben: cut(tasks, 40).map((t) => ({ titel: t.title, status: t.status, faellig: t.due_date })),
          angebote: cut(offers, 20).map((o) => ({ nummer: o.offer_number, status: o.status, brutto: brutto(o.totals) })),
          kalkulation: calc ? { brutto: brutto(calc.totals), kwp: calc.system_size_kwp ?? null } : null,
          aktivitaeten: cut(acts, 8).map((a) => ({ titel: a.title, datum: a.created_at })),
        });
      }
      case "list_customers": {
        const q = args.query ? String(args.query).toLowerCase() : "";
        const all = await getCustomers();
        const f = q ? all.filter((c) => `${c.company ?? ""} ${c.first_name ?? ""} ${c.last_name ?? ""} ${c.city ?? ""}`.toLowerCase().includes(q)) : all;
        return JSON.stringify({
          gesamt: f.length, angezeigt: Math.min(f.length, 60),
          kunden: cut(f, 60).map((c) => ({ id: c.id, nr: c.customer_nr, name: customerName(c), ort: c.city, email: c.email })),
        });
      }
      case "get_customer_detail": {
        const c = await resolveCustomerRow(String(args.query ?? ""));
        if (!c) return JSON.stringify({ gefunden: false });
        const [projects, acts] = await Promise.all([getProjectsByCustomer(c.id), getCustomerActivities(c.id)]);
        return JSON.stringify({
          gefunden: true,
          kunde: { id: c.id, nr: c.customer_nr, name: customerName(c), ort: c.city, email: c.email, telefon: c.phone ?? c.mobile },
          projekte: cut(projects, 30).map((p) => ({ id: p.id, titel: p.title, status: p.status })),
          aktivitaeten: cut(acts, 8).map((a) => ({ titel: a.title, datum: a.created_at })),
        });
      }
      case "list_offers": {
        const status = args.status ? String(args.status).toLowerCase() : null;
        const all = await getAllOffers();
        const f = status ? all.filter((o) => (o.status ?? "").toLowerCase() === status) : all;
        return JSON.stringify({
          gesamt: f.length, angezeigt: Math.min(f.length, 60),
          angebote: cut(f, 60).map((o) => ({ nummer: o.offer_number, status: o.status, brutto: brutto(o.totals), projekt: o.project?.title ?? null, kunde: o.project?.customer ? customerName(o.project.customer) : null })),
        });
      }
      case "list_invoices":
      case "open_items": {
        const wanted = name === "open_items" ? "offen" : args.status ? String(args.status).toLowerCase() : null;
        const all = await getDocumentsByKind("rechnung");
        const today = new Date().toISOString().slice(0, 10);
        const withState = all.map((d) => {
          const paid = d.payment_status === "bezahlt";
          const overdue = !paid && d.due_date != null && d.due_date < today;
          return { d, state: paid ? "bezahlt" : overdue ? "ueberfaellig" : "offen", overdue };
        });
        const f = withState.filter((x) => (wanted ? x.state === wanted : true));
        return JSON.stringify({
          gesamt: f.length, angezeigt: Math.min(f.length, 60),
          rechnungen: cut(f, 60).map(({ d, state }) => ({
            nummer: d.doc_number, status: state, brutto: brutto(d.totals), faellig: d.due_date,
            projekt: d.project?.title ?? null, kunde: d.project?.customer ? customerName(d.project.customer) : null,
          })),
        });
      }
      case "overdue_tasks": {
        const t = await getOverdueTasks();
        return JSON.stringify({ anzahl: t.length, aufgaben: cut(t, 60).map((x) => ({ titel: x.title, projekt: x.project_title, zustaendig: x.assignee_name, faellig: x.due_date })) });
      }
      case "list_service_tickets": {
        const status = args.status ? String(args.status).toLowerCase() : null;
        const all = await getServiceTickets();
        const f = status ? all.filter((t) => (t.status ?? "").toLowerCase() === status) : all;
        return JSON.stringify({ gesamt: f.length, tickets: cut(f, 60).map((t) => ({ id: t.id, titel: t.title, status: t.status, ort: t.location, kunde: t.customer ? customerName(t.customer) : null, faellig: t.due_date })) });
      }
      case "due_maintenance": {
        const days = typeof args.days === "number" ? args.days : 30;
        const c = await getDueServiceContracts(days);
        return JSON.stringify({ anzahl: c.length, vertraege: cut(c, 60).map((x) => ({ titel: x.title, faellig: x.next_due, kunde: x.customer ? customerName(x.customer) : null })) });
      }
      case "list_dispo": {
        const d = await getDispoEntries(String(args.from ?? ""), String(args.to ?? ""));
        return JSON.stringify({ anzahl: d.length, eintraege: cut(d, 80).map((x) => ({ datum: x.date, titel: x.title, art: x.kind, projekt: x.project?.title ?? null })) });
      }
      case "time_summary": {
        let entries;
        if (args.project) {
          const p = await resolveProjectRow(String(args.project));
          entries = p ? await getTimeEntriesByProject(p.id) : [];
        } else {
          entries = await getTimeEntries();
        }
        const total = entries.reduce((s, e) => s + num(e.hours), 0);
        return JSON.stringify({ eintraege_gezeigt: Math.min(entries.length, 50), stunden_gesamt: total, liste: cut(entries, 50).map((e) => ({ datum: e.work_date, stunden: e.hours, taetigkeit: e.activity })) });
      }
      case "list_products": {
        const q = args.query ? String(args.query).toLowerCase() : "";
        const all = await getProducts();
        const f = q ? all.filter((p) => `${p.name} ${p.manufacturer ?? ""} ${p.sku ?? ""}`.toLowerCase().includes(q)) : all;
        return JSON.stringify({ gesamt: f.length, produkte: cut(f, 60).map((p) => ({ name: p.name, hersteller: p.manufacturer, artikelnr: p.sku, vk: p.price_sell })) });
      }
      case "list_employees": {
        const e = await getEmployees();
        return JSON.stringify(e.filter((x) => x.active).map((x) => ({ id: x.id, name: x.name ?? x.email, rolle: x.role, vertrieb: Boolean(x.is_sales) })));
      }
      case "my_overview": {
        if (!me?.id) return JSON.stringify({ hinweis: "Kein angemeldeter Mitarbeiter." });
        const [inbox, tasks] = await Promise.all([getInbox(me.id), getMyOpenTasks(me.id)]);
        return JSON.stringify({
          posteingang: { angeboten: inbox.offered.length, ungelesen: inbox.unread.length, ueberfaellig: inbox.overdue.length },
          offene_aufgaben: cut(tasks, 40).map((t) => ({ titel: t.title, faellig: t.due_date, projekt: t.project?.title ?? null })),
        });
      }
      default:
        return JSON.stringify({ error: `Unbekanntes Werkzeug: ${name}` });
    }
  } catch (e) {
    return JSON.stringify({ error: (e as Error).message });
  }
}

// ===========================================================================
// AKTIONS-Vorschläge: Referenzen auflösen → ProposedAction (mit Auswahl bei Mehrdeutigkeit)
// ===========================================================================
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
  /** Nur für kind === "report": kein execute, sondern CSV-Download. */
  report?: { dataset: string; title: string; status?: string; from?: string; to?: string };
}

export async function buildProposal(name: string, args: Record<string, unknown>): Promise<ProposedAction | null> {
  switch (name) {
    case "propose_task":
      return proposeTask(args);
    case "propose_complete_task":
      return proposeTaskAction("complete_task", "Aufgabe erledigen", args, true);
    case "propose_assign_task":
      return proposeAssignTask(args);
    case "propose_set_project_status":
      return proposeProjectStatus(args);
    case "propose_move_service_ticket":
      return proposeMoveTicket(args);
    case "propose_complete_maintenance":
      return proposeCompleteMaintenance(args);
    case "propose_add_activity":
      return proposeAddActivity(args);
    case "propose_add_site_log":
      return proposeAddSiteLog(args);
    case "propose_mark_invoice_paid":
      return proposeMarkPaid(args);
    case "propose_create_customer":
      return proposeCreateCustomer(args);
    case "propose_create_lead":
      return proposeCreateLead(args);
    case "propose_create_offer":
      return proposeCreateOffer(args);
    case "propose_create_invoice":
      return proposeCreateInvoice(args);
    case "propose_report":
      return proposeReport(args);
    default:
      return null;
  }
}

// ---- Resolver-Helfer (RLS-sicher über den normalen Server-Client) ----
async function resolveProjectRow(query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return null;
  const direct = await getProject(query).catch(() => null);
  if (direct) return direct;
  const all = await getProjects();
  return (
    all.find((p) => (p.title ?? "").toLowerCase() === q) ??
    all.find((p) => (p.title ?? "").toLowerCase().includes(q)) ??
    all.find((p) => `${p.city ?? ""} ${p.customer ? customerName(p.customer) : ""}`.toLowerCase().includes(q)) ??
    null
  );
}
async function projectOptions(query: string) {
  const q = query.trim().toLowerCase();
  const all = await getProjects();
  return all
    .filter((p) => `${p.title ?? ""} ${p.city ?? ""} ${p.customer ? customerName(p.customer) : ""}`.toLowerCase().includes(q))
    .slice(0, 8)
    .map((p) => ({ id: p.id, label: `${p.title ?? "Projekt"}${p.city ? ` · ${p.city}` : ""}` }));
}
async function resolveCustomerRow(query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return null;
  const direct = await getCustomer(query).catch(() => null);
  if (direct) return direct;
  const all = await getCustomers();
  return (
    all.find((c) => String(c.customer_nr ?? "") === q) ??
    all.find((c) => customerName(c).toLowerCase() === q) ??
    all.find((c) => customerName(c).toLowerCase().includes(q)) ??
    null
  );
}
async function resolveEmployees(names: string[]) {
  const employees = (await getEmployees()).filter((e) => e.active);
  const ids: string[] = [];
  const labels: string[] = [];
  const unmatched: string[] = [];
  for (const raw of names ?? []) {
    const q = raw.trim().toLowerCase();
    if (!q) continue;
    const hit =
      employees.find((e) => (e.name ?? "").toLowerCase() === q) ??
      employees.find((e) => (e.name ?? "").toLowerCase().includes(q)) ??
      employees.find((e) => (e.email ?? "").toLowerCase().includes(q));
    if (hit && !ids.includes(hit.id)) {
      ids.push(hit.id);
      labels.push(hit.name ?? hit.email ?? "Mitarbeiter");
    } else if (!hit) unmatched.push(raw);
  }
  return { ids, labels, unmatched };
}

async function proposeTask(args: Record<string, unknown>): Promise<ProposedAction> {
  const emp = await resolveEmployees((args.assignees as string[]) ?? []);
  let projectId: string | null = null;
  let projectTitle: string | null = null;
  if (args.project) {
    const p = await resolveProjectRow(String(args.project));
    if (p) { projectId = p.id; projectTitle = p.title ?? null; }
  }
  const title = String(args.title ?? "");
  return {
    kind: "create_task",
    title: "Aufgabe anlegen",
    summary: `„${title}" an ${emp.labels.join(", ") || "(niemand erkannt)"}${projectTitle ? ` · Projekt: ${projectTitle}` : ""}`,
    payload: { title, body: String(args.body ?? ""), employeeIds: emp.ids, projectId },
    ready: emp.ids.length > 0 && title.length > 0,
  };
}

async function proposeTaskAction(kind: string, title: string, args: Record<string, unknown>, done: boolean): Promise<ProposedAction> {
  const supabase = await createClient();
  const q = `%${String(args.task ?? "").trim()}%`;
  let projectId: string | null = null;
  if (args.project) {
    const p = await resolveProjectRow(String(args.project));
    projectId = p?.id ?? null;
  }
  let query = supabase.from("project_tasks").select("id, title, project_id, status").ilike("title", q).limit(8);
  if (projectId) query = query.eq("project_id", projectId);
  const { data } = await query;
  const rows = data ?? [];
  const best = rows[0] ?? null;
  return {
    kind, title,
    summary: best ? `„${best.title}"` : `keine offene Aufgabe zu „${String(args.task)}" gefunden`,
    payload: { taskId: best?.id ?? "", projectId: best?.project_id ?? null, done },
    ambiguities: rows.length > 1 ? [{ field: "taskId", label: "Welche Aufgabe?", options: rows.map((r) => ({ id: r.id, label: r.title })) }] : undefined,
    ready: Boolean(best),
  };
}

async function proposeAssignTask(args: Record<string, unknown>): Promise<ProposedAction> {
  const base = await proposeTaskAction("assign_task", "Aufgabe zuweisen", args, false);
  const emp = await resolveEmployees([String(args.assignee ?? "")]);
  base.payload.employeeId = emp.ids[0] ?? "";
  base.summary = `${base.summary} → ${emp.labels[0] ?? "(unbekannt)"}`;
  base.ready = base.ready && emp.ids.length > 0;
  return base;
}

async function proposeProjectStatus(args: Record<string, unknown>): Promise<ProposedAction> {
  const p = await resolveProjectRow(String(args.project ?? ""));
  const status = String(args.status ?? "");
  return {
    kind: "set_project_status",
    title: "Projekt-Status ändern",
    summary: p ? `„${p.title}" → ${status}` : `Projekt „${String(args.project)}" nicht gefunden`,
    payload: { projectId: p?.id ?? "", status },
    ambiguities: p ? undefined : [{ field: "projectId", label: "Welches Projekt?", options: await projectOptions(String(args.project ?? "")) }],
    ready: Boolean(p) && status.length > 0,
  };
}

async function proposeMoveTicket(args: Record<string, unknown>): Promise<ProposedAction> {
  const all = await getServiceTickets();
  const q = String(args.ticket ?? "").toLowerCase();
  const matches = all.filter((t) => (t.title ?? "").toLowerCase().includes(q)).slice(0, 8);
  const best = matches[0] ?? null;
  const status = String(args.status ?? "");
  return {
    kind: "move_service_ticket",
    title: "Service-Ticket verschieben",
    summary: best ? `„${best.title}" → ${status}` : `Ticket „${String(args.ticket)}" nicht gefunden`,
    payload: { ticketId: best?.id ?? "", status },
    ambiguities: matches.length > 1 ? [{ field: "ticketId", label: "Welches Ticket?", options: matches.map((t) => ({ id: t.id, label: t.title })) }] : undefined,
    ready: Boolean(best) && status.length > 0,
  };
}

async function proposeCompleteMaintenance(args: Record<string, unknown>): Promise<ProposedAction> {
  const all = await getServiceContracts();
  const q = String(args.contract ?? "").toLowerCase();
  const matches = all.filter((c) => `${c.title} ${c.customer ? customerName(c.customer) : ""}`.toLowerCase().includes(q)).slice(0, 8);
  const best = matches[0] ?? null;
  return {
    kind: "complete_maintenance",
    title: "Wartung abschließen",
    summary: best ? `„${best.title}"` : `Vertrag „${String(args.contract)}" nicht gefunden`,
    payload: { contractId: best?.id ?? "" },
    ambiguities: matches.length > 1 ? [{ field: "contractId", label: "Welcher Vertrag?", options: matches.map((c) => ({ id: c.id, label: c.title })) }] : undefined,
    ready: Boolean(best),
  };
}

async function proposeAddActivity(args: Record<string, unknown>): Promise<ProposedAction> {
  const p = await resolveProjectRow(String(args.project ?? ""));
  const title = String(args.title ?? "");
  return {
    kind: "add_activity",
    title: "Logbuch-Eintrag",
    summary: p ? `„${title}" → ${p.title}` : `Projekt „${String(args.project)}" nicht gefunden`,
    payload: { projectId: p?.id ?? "", title, body: String(args.body ?? "") },
    ambiguities: p ? undefined : [{ field: "projectId", label: "Welches Projekt?", options: await projectOptions(String(args.project ?? "")) }],
    ready: Boolean(p) && title.length > 0,
  };
}

async function proposeAddSiteLog(args: Record<string, unknown>): Promise<ProposedAction> {
  const p = await resolveProjectRow(String(args.project ?? ""));
  const work = String(args.work_done ?? "");
  return {
    kind: "add_site_log",
    title: "Bautagebuch-Eintrag",
    summary: p ? `${p.title}: ${work}` : `Projekt „${String(args.project)}" nicht gefunden`,
    payload: { projectId: p?.id ?? "", workDone: work, weather: String(args.weather ?? ""), crew: String(args.crew ?? ""), note: String(args.note ?? "") },
    ambiguities: p ? undefined : [{ field: "projectId", label: "Welches Projekt?", options: await projectOptions(String(args.project ?? "")) }],
    ready: Boolean(p) && work.length > 0,
  };
}

async function proposeMarkPaid(args: Record<string, unknown>): Promise<ProposedAction> {
  const all = await getDocumentsByKind("rechnung");
  const ref = String(args.invoice ?? "").toLowerCase();
  const num1 = ref.replace(/[^0-9]/g, "");
  const matches = all
    .filter((d) => (num1 && String(d.doc_number ?? "") === num1) || (d.project?.title ?? "").toLowerCase().includes(ref))
    .slice(0, 8);
  const best = matches[0] ?? null;
  return {
    kind: "mark_invoice_paid",
    title: "Rechnung als bezahlt markieren",
    summary: best ? `Rechnung Nr. ${best.doc_number} (${best.project?.title ?? ""})` : `Rechnung „${String(args.invoice)}" nicht gefunden`,
    payload: { invoiceId: best?.id ?? "", amount: typeof args.amount === "number" ? args.amount : undefined },
    ambiguities: matches.length > 1 ? [{ field: "invoiceId", label: "Welche Rechnung?", options: matches.map((d) => ({ id: d.id, label: `Nr. ${d.doc_number} · ${d.project?.title ?? ""}` })) }] : undefined,
    ready: Boolean(best),
  };
}

function proposeCreateCustomer(args: Record<string, unknown>): ProposedAction {
  const name = [args.company, args.first_name, args.last_name].filter(Boolean).join(" ") || "(ohne Namen)";
  return {
    kind: "create_customer",
    title: "Kunde anlegen",
    summary: `${name}${args.city ? ` · ${args.city}` : ""}`,
    payload: pickStrings(args, ["kind", "company", "first_name", "last_name", "email", "phone", "street", "zip", "city", "notes"]),
    ready: Boolean(args.last_name || args.company),
  };
}

async function proposeCreateLead(args: Record<string, unknown>): Promise<ProposedAction> {
  const emp = await resolveEmployees((args.assignees as string[]) ?? []);
  const name = [args.company, args.first_name, args.last_name].filter(Boolean).join(" ") || "(ohne Namen)";
  return {
    kind: "create_lead",
    title: "Anfrage/Lead anlegen",
    summary: `${name}${args.city ? ` · ${args.city}` : ""} → ${emp.labels.join(", ") || "Vertrieb offen"}`,
    payload: { ...pickStrings(args, ["kind", "company", "first_name", "last_name", "email", "phone", "street", "zip", "city", "notes", "source"]), employeeIds: emp.ids },
    ready: Boolean(args.last_name || args.company),
  };
}

async function proposeCreateOffer(args: Record<string, unknown>): Promise<ProposedAction> {
  const p = await resolveProjectRow(String(args.project ?? ""));
  let calcId = "";
  if (p) {
    const calc = await getCalculationByProject(p.id);
    calcId = calc?.id ?? "";
  }
  return {
    kind: "create_offer",
    title: "Angebot erstellen",
    summary: p ? (calcId ? `Angebot aus Kalkulation von „${p.title}"` : `„${p.title}" hat noch keine Kalkulation`) : `Projekt „${String(args.project)}" nicht gefunden`,
    payload: { projectId: p?.id ?? "", calcId },
    ambiguities: p ? undefined : [{ field: "projectId", label: "Welches Projekt?", options: await projectOptions(String(args.project ?? "")) }],
    ready: Boolean(p) && calcId.length > 0,
  };
}

async function proposeCreateInvoice(args: Record<string, unknown>): Promise<ProposedAction> {
  const p = await resolveProjectRow(String(args.project ?? ""));
  let sourceId = "";
  let label = "";
  if (p) {
    const offers = await getOffersByProject(p.id);
    const src = offers.find((o) => (o.status ?? "").toLowerCase() === "angenommen") ?? offers[0];
    sourceId = src?.id ?? "";
    label = src ? `Angebot Nr. ${src.offer_number}` : "";
  }
  const type = String(args.invoice_type ?? "voll");
  return {
    kind: "create_invoice",
    title: "Rechnung erstellen",
    summary: p ? (sourceId ? `${type === "abschlag" ? "Abschlagsrechnung" : type === "schluss" ? "Schlussrechnung" : "Rechnung"} für „${p.title}" (${label})` : `„${p.title}" hat kein Angebot als Grundlage`) : `Projekt „${String(args.project)}" nicht gefunden`,
    payload: { sourceId, invoiceType: type, percent: typeof args.percent === "number" ? args.percent : undefined },
    ambiguities: p ? undefined : [{ field: "projectId", label: "Welches Projekt?", options: await projectOptions(String(args.project ?? "")) }],
    ready: Boolean(sourceId),
  };
}

function proposeReport(args: Record<string, unknown>): ProposedAction {
  const dataset = String(args.dataset ?? "");
  const title = String(args.title ?? "Auswertung");
  return {
    kind: "report",
    title: "Auswertung",
    summary: `${title} (${dataset})`,
    payload: {},
    ready: dataset.length > 0,
    report: {
      dataset, title,
      status: args.status ? String(args.status) : undefined,
      from: args.from ? String(args.from) : undefined,
      to: args.to ? String(args.to) : undefined,
    },
  };
}

function pickStrings(args: Record<string, unknown>, keys: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const k of keys) if (args[k] != null && args[k] !== "") out[k] = String(args[k]);
  return out;
}
