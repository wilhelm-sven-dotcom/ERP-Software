import { NextResponse } from "next/server";

import { getCurrentEmployee } from "@/lib/supabase/auth";
import { createRueckfrage, assignTask, toggleTask } from "@/app/(app)/workflow/actions";
import { moveProjectStatus, addProjectActivity } from "@/app/(app)/projekte/actions";
import { moveServiceTicket } from "@/app/(app)/service/actions";
import { completeMaintenance } from "@/app/(app)/wartung/actions";
import { addSiteLogEntry } from "@/app/(app)/bautagebuch/actions";
import { markInvoicePaid, createInvoice } from "@/app/(app)/dokumente/actions";
import { saveCustomer } from "@/app/(app)/kunden/actions";
import { createLead } from "@/app/(app)/vertrieb/actions";
import { createOfferFromCalculation } from "@/app/(app)/angebot/actions";

type Payload = Record<string, unknown>;
const ok = () => NextResponse.json({ ok: true });
const fail = (error: string) => NextResponse.json({ ok: false, error });

function fd(entries: Record<string, string | null | undefined>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) if (v != null && v !== "") f.set(k, v);
  return f;
}
const str = (p: Payload, k: string) => (p[k] != null ? String(p[k]) : undefined);

/**
 * Führt eine vom Assistenten vorgeschlagene Aktion aus — erst NACH Bestätigung.
 * RLS bleibt die Wahrheit (Ausführung im Kontext des angemeldeten Nutzers über
 * die bestehenden Server-Actions). Keine Lösch-/Adminaktionen.
 */
export async function POST(req: Request) {
  const me = await getCurrentEmployee();
  if (!me) return fail("Nicht angemeldet.");

  let action = "";
  let p: Payload = {};
  try {
    const body = (await req.json()) as { action?: string; payload?: Payload };
    action = body.action ?? "";
    p = body.payload ?? {};
  } catch {
    return fail("Ungültige Daten.");
  }

  try {
    switch (action) {
      case "create_task": {
        const ids = (p.employeeIds as string[]) ?? [];
        if (!p.title || ids.length === 0) return fail("Betreff und mindestens ein Kollege nötig.");
        const res = await createRueckfrage({ ok: false }, fd({
          title: str(p, "title"), body: str(p, "body"),
          employee_ids: ids.join(","), project_id: str(p, "projectId"),
        }));
        return NextResponse.json({ ok: res.ok, error: res.error ?? null });
      }
      case "complete_task": {
        if (!p.taskId) return fail("Keine Aufgabe ausgewählt.");
        await toggleTask(fd({ id: str(p, "taskId"), project_id: str(p, "projectId"), done: "true" }));
        return ok();
      }
      case "assign_task": {
        if (!p.taskId || !p.employeeId) return fail("Aufgabe und Kollege nötig.");
        await assignTask(fd({ id: str(p, "taskId"), employee_id: str(p, "employeeId") }));
        return ok();
      }
      case "set_project_status": {
        if (!p.projectId || !p.status) return fail("Projekt und Status nötig.");
        await moveProjectStatus(String(p.projectId), String(p.status));
        return ok();
      }
      case "move_service_ticket": {
        if (!p.ticketId || !p.status) return fail("Ticket und Status nötig.");
        await moveServiceTicket(String(p.ticketId), String(p.status));
        return ok();
      }
      case "complete_maintenance": {
        if (!p.contractId) return fail("Kein Vertrag ausgewählt.");
        await completeMaintenance(fd({ id: str(p, "contractId") }));
        return ok();
      }
      case "add_activity": {
        if (!p.projectId || !p.title) return fail("Projekt und Titel nötig.");
        const res = await addProjectActivity({ ok: false }, fd({
          project_id: str(p, "projectId"), title: str(p, "title"), body: str(p, "body"), type: "notiz",
        }));
        return NextResponse.json({ ok: res.ok, error: res.error ?? null });
      }
      case "add_site_log": {
        if (!p.projectId || !p.workDone) return fail("Projekt und Arbeiten nötig.");
        const res = await addSiteLogEntry({ ok: false }, fd({
          project_id: str(p, "projectId"), work_done: str(p, "workDone"),
          weather: str(p, "weather"), crew: str(p, "crew"), note: str(p, "note"),
        }));
        return NextResponse.json({ ok: res.ok, error: res.error ?? null });
      }
      case "mark_invoice_paid": {
        if (!p.invoiceId) return fail("Keine Rechnung ausgewählt.");
        await markInvoicePaid(fd({ id: str(p, "invoiceId"), amount: str(p, "amount") }));
        return ok();
      }
      case "create_customer": {
        if (!p.last_name && !p.company) return fail("Nachname oder Firma nötig.");
        const res = await saveCustomer({ ok: false }, fd({
          kind: str(p, "kind") ?? "privat", company: str(p, "company"),
          first_name: str(p, "first_name"), last_name: str(p, "last_name"),
          email: str(p, "email"), phone: str(p, "phone"),
          street: str(p, "street"), zip: str(p, "zip"), city: str(p, "city"), notes: str(p, "notes"),
          force: "1",
        }));
        return NextResponse.json({ ok: res.ok, error: res.error ?? null });
      }
      case "create_lead": {
        if (!p.last_name && !p.company) return fail("Nachname oder Firma nötig.");
        const ids = (p.employeeIds as string[]) ?? [];
        const res = await createLead({ ok: false }, fd({
          kind: str(p, "kind") ?? "privat", company: str(p, "company"),
          first_name: str(p, "first_name"), last_name: str(p, "last_name"),
          email: str(p, "email"), phone: str(p, "phone"),
          street: str(p, "street"), zip: str(p, "zip"), city: str(p, "city"),
          notes: str(p, "notes"), source: str(p, "source"), employee_ids: ids.join(","),
        }));
        return NextResponse.json({ ok: res.ok, error: res.error ?? null });
      }
      case "create_offer": {
        if (!p.calcId || !p.projectId) return fail("Projekt mit Kalkulation nötig.");
        await createOfferFromCalculation(fd({ calc_id: str(p, "calcId"), project_id: str(p, "projectId") }));
        return ok();
      }
      case "create_invoice": {
        if (!p.sourceId) return fail("Kein Angebot als Grundlage gefunden.");
        await createInvoice(fd({
          source_id: str(p, "sourceId"), invoice_type: str(p, "invoiceType") ?? "voll",
          percent: str(p, "percent"),
        }));
        return ok();
      }
      default:
        return fail("Unbekannte Aktion.");
    }
  } catch (e) {
    return fail((e as Error).message || "Aktion fehlgeschlagen.");
  }
}
