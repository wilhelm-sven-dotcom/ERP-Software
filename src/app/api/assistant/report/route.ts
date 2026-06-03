import { getCurrentEmployee } from "@/lib/supabase/auth";
import { getProjects } from "@/lib/data/projects";
import { getCustomers } from "@/lib/data/customers";
import { getAllOffers } from "@/lib/data/offers";
import { getDocumentsByKind } from "@/lib/data/documents";
import { getOverdueTasks } from "@/lib/data/notifications";
import { getTimeEntries } from "@/lib/data/time";
import { customerName } from "@/lib/format";

const num = (v: unknown): number => (typeof v === "number" ? v : 0);
const brutto = (t: Record<string, unknown>): number => num((t as { brutto?: number }).brutto);

/** Eine CSV-Zelle sicher quoten (Semikolon-Trennung, deutsch/Excel-freundlich). */
function cell(v: unknown): string {
  const s = v == null ? "" : String(v);
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function toCsv(headers: string[], rows: (string | number | null)[][]): string {
  const lines = [headers.map(cell).join(";"), ...rows.map((r) => r.map(cell).join(";"))];
  return "﻿" + lines.join("\r\n"); // BOM für Excel-Umlaute
}

/**
 * Auswertungs-CSV serverseitig aus echten, RLS-gefilterten Daten erzeugen.
 * Die Zeilen laufen NICHT durch das Sprachmodell (genau + günstig).
 */
export async function GET(req: Request) {
  const me = await getCurrentEmployee();
  if (!me) return new Response("Nicht angemeldet.", { status: 401 });

  const url = new URL(req.url);
  const dataset = url.searchParams.get("dataset") ?? "";
  const status = (url.searchParams.get("status") ?? "").toLowerCase();
  const title = url.searchParams.get("title") || dataset || "auswertung";
  const today = new Date().toISOString().slice(0, 10);

  let csv = "";
  switch (dataset) {
    case "invoices":
    case "open_items": {
      const all = await getDocumentsByKind("rechnung");
      const rows = all
        .map((d) => {
          const paid = d.payment_status === "bezahlt";
          const overdue = !paid && d.due_date != null && d.due_date < today;
          const state = paid ? "bezahlt" : overdue ? "überfällig" : "offen";
          return { d, state };
        })
        .filter((x) => (dataset === "open_items" ? x.state !== "bezahlt" : status ? x.state === status : true));
      csv = toCsv(
        ["Nummer", "Status", "Brutto", "Fällig", "Projekt", "Kunde"],
        rows.map(({ d, state }) => [
          d.doc_number ?? "", state, brutto(d.totals), d.due_date ?? "",
          d.project?.title ?? "", d.project?.customer ? customerName(d.project.customer) : "",
        ]),
      );
      break;
    }
    case "projects": {
      const all = await getProjects();
      const f = status ? all.filter((p) => (p.status ?? "").toLowerCase() === status) : all;
      csv = toCsv(
        ["Titel", "Status", "Ort", "kWp", "Kunde"],
        f.map((p) => [p.title ?? "", p.status ?? "", p.city ?? "", p.system_size_kwp ?? "", p.customer ? customerName(p.customer) : ""]),
      );
      break;
    }
    case "customers": {
      const all = await getCustomers();
      csv = toCsv(
        ["Nr", "Name", "Ort", "E-Mail", "Telefon"],
        all.map((c) => [c.customer_nr ?? "", customerName(c), c.city ?? "", c.email ?? "", c.phone ?? c.mobile ?? ""]),
      );
      break;
    }
    case "offers": {
      const all = await getAllOffers();
      const f = status ? all.filter((o) => (o.status ?? "").toLowerCase() === status) : all;
      csv = toCsv(
        ["Nummer", "Status", "Brutto", "Projekt", "Kunde"],
        f.map((o) => [o.offer_number ?? "", o.status ?? "", brutto(o.totals), o.project?.title ?? "", o.project?.customer ? customerName(o.project.customer) : ""]),
      );
      break;
    }
    case "overdue_tasks": {
      const all = await getOverdueTasks();
      csv = toCsv(
        ["Aufgabe", "Projekt", "Zuständig", "Fällig"],
        all.map((t) => [t.title, t.project_title ?? "", t.assignee_name ?? "", t.due_date ?? ""]),
      );
      break;
    }
    case "time": {
      const all = await getTimeEntries();
      csv = toCsv(
        ["Datum", "Stunden", "Tätigkeit"],
        all.map((e) => [e.work_date, e.hours, e.activity ?? ""]),
      );
      break;
    }
    default:
      return new Response("Unbekannter Datensatz.", { status: 400 });
  }

  const filename = `${title}-${today}`.replace(/[^a-zA-Z0-9_-]+/g, "_") + ".csv";
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
