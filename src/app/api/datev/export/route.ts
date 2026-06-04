import { NextResponse, type NextRequest } from "next/server";

import { getInvoicesForExport } from "@/lib/data/documents";
import { customerName } from "@/lib/format";

const num = (v: unknown, d = 0) => (typeof v === "number" ? v : d);
/** Betrag im deutschen/DATEV-Format (Komma, zwei Nachkommastellen, keine Tausender). */
const de = (n: number) => n.toFixed(2).replace(".", ",");
/** CSV-Feld escapen (Semikolon-getrennt, deutsche Konvention). */
const cell = (v: unknown) => {
  const s = String(v ?? "");
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/**
 * Buchhaltungs-/DATEV-Export der Rechnungen als CSV (Semikolon, UTF-8 BOM).
 * Vereinfachter Buchungsstapel — von Steuerberatung/DATEV gut importierbar.
 * Parameter: ?from=YYYY-MM-DD&to=YYYY-MM-DD&status=offen|bezahlt
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const today = new Date();
  const from = sp.get("from") || `${today.getFullYear()}-01-01`;
  const to = sp.get("to") || today.toISOString().slice(0, 10);
  const statusRaw = sp.get("status");
  const status = statusRaw === "offen" || statusRaw === "bezahlt" ? statusRaw : undefined;

  const invoices = await getInvoicesForExport(from, to, status);

  const header = [
    "Belegdatum",
    "Rechnungsnummer",
    "Kunde",
    "Bezeichnung",
    "Netto",
    "USt-Betrag",
    "Brutto",
    "Faelligkeit",
    "Zahlstatus",
    "Bezahlt am",
  ];
  const lines = [header.join(";")];
  for (const inv of invoices) {
    const t = (inv.totals ?? {}) as { netto?: number; brutto?: number; mwstBetrag?: number };
    const netto = num(t.netto);
    const brutto = num(t.brutto);
    const ust = num(t.mwstBetrag, brutto - netto);
    const kunde = inv.project?.customer ? customerName(inv.project.customer) : "";
    lines.push(
      [
        cell(inv.invoice_date ?? inv.created_at.slice(0, 10)),
        cell(inv.doc_number ?? ""),
        cell(kunde),
        cell(inv.title ?? "Rechnung"),
        cell(de(netto)),
        cell(de(ust)),
        cell(de(brutto)),
        cell(inv.due_date ?? ""),
        cell(inv.payment_status ?? "offen"),
        cell(inv.paid_at ? inv.paid_at.slice(0, 10) : ""),
      ].join(";"),
    );
  }

  const csv = "﻿" + lines.join("\r\n"); // BOM → Excel/DATEV erkennt UTF-8
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="rechnungen_${from}_bis_${to}.csv"`,
    },
  });
}
