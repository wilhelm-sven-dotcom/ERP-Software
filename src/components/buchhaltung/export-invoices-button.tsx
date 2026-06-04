"use client";

import { Download } from "lucide-react";

import { Button } from "@/components/ui/button";

export interface InvoiceExportRow {
  supplier: string | null;
  invoice_number: string | null;
  invoice_date: string | null;
  due_date: string | null;
  amount: number | null;
  currency: string;
  status: string;
  notes: string | null;
  project?: { title: string | null } | null;
}

const csvCell = (v: unknown): string => {
  const s = v == null ? "" : String(v);
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** Exportiert die Eingangsrechnungen als CSV (für den Steuerberater / Excel). */
export function ExportInvoicesButton({ rows }: { rows: InvoiceExportRow[] }) {
  function exportCsv() {
    const header = [
      "Lieferant",
      "Rechnungsnr.",
      "Rechnungsdatum",
      "Fällig",
      "Betrag",
      "Währung",
      "Status",
      "Projekt",
      "Notiz",
    ];
    const lines = rows.map((r) =>
      [
        r.supplier,
        r.invoice_number,
        r.invoice_date,
        r.due_date,
        r.amount != null ? String(r.amount).replace(".", ",") : "",
        r.currency,
        r.status,
        r.project?.title ?? "",
        r.notes,
      ]
        .map(csvCell)
        .join(";"),
    );
    // BOM für korrekte Umlaute in Excel.
    const blob = new Blob(["﻿" + [header.join(";"), ...lines].join("\r\n")], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `eingangsrechnungen-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Button variant="outline" size="sm" onClick={exportCsv} disabled={rows.length === 0}>
      <Download className="size-4" /> CSV
    </Button>
  );
}
