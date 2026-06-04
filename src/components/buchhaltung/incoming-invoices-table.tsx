"use client";

import * as React from "react";
import Link from "next/link";
import { Check, Copy, FileText, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { NewIncomingInvoiceDialog } from "@/components/buchhaltung/new-incoming-invoice-dialog";
import { ExportInvoicesButton } from "@/components/buchhaltung/export-invoices-button";
import { markIncomingPaid, markIncomingOpen, deleteIncomingInvoice } from "@/app/(app)/buchhaltung/actions";
import { formatCurrency, formatDate } from "@/lib/format";

export interface InvoiceRow {
  id: string;
  supplier: string | null;
  invoice_number: string | null;
  invoice_date: string | null;
  due_date: string | null;
  amount: number | null;
  currency: string;
  status: string;
  notes: string | null;
  project: { id: string; title: string | null } | null;
}

type Filter = "alle" | "offen" | "ueberfaellig" | "bezahlt";
const num = (v: unknown): number => (typeof v === "number" ? v : 0);

export function IncomingInvoicesTable({
  invoices,
  fileUrls,
  suppliers,
}: {
  invoices: InvoiceRow[];
  fileUrls: Record<string, string>;
  suppliers: string[];
}) {
  const [filter, setFilter] = React.useState<Filter>("alle");
  const today = new Date().toISOString().slice(0, 10);
  const month = today.slice(0, 7);
  const isOverdue = (i: InvoiceRow) => i.status !== "bezahlt" && i.due_date != null && i.due_date < today;

  const open = invoices.filter((i) => i.status !== "bezahlt");
  const openSum = open.reduce((s, i) => s + num(i.amount), 0);
  const overdueCount = invoices.filter(isOverdue).length;
  const monthSum = invoices
    .filter((i) => (i.invoice_date ?? "").slice(0, 7) === month)
    .reduce((s, i) => s + num(i.amount), 0);

  const bySupplier = new Map<string, number>();
  for (const i of open) {
    const key = i.supplier?.trim() || "Ohne Lieferant";
    bySupplier.set(key, (bySupplier.get(key) ?? 0) + num(i.amount));
  }
  const topSuppliers = [...bySupplier.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);

  const shown = invoices.filter((i) =>
    filter === "alle"
      ? true
      : filter === "bezahlt"
        ? i.status === "bezahlt"
        : filter === "ueberfaellig"
          ? isOverdue(i)
          : i.status !== "bezahlt",
  );

  const filters: [Filter, string][] = [
    ["alle", "Alle"],
    ["offen", "Offen"],
    ["ueberfaellig", "Überfällig"],
    ["bezahlt", "Bezahlt"],
  ];

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">Eingangsrechnungen</h3>
        <div className="flex flex-wrap items-center gap-3">
          {overdueCount > 0 ? (
            <span className="text-destructive text-sm font-medium">{overdueCount} überfällig</span>
          ) : null}
          <span className="text-muted-foreground text-sm">
            diesen Monat: <span className="text-foreground font-semibold">{formatCurrency(monthSum)}</span>
          </span>
          {openSum > 0 ? (
            <span className="text-muted-foreground text-sm">
              offen: <span className="text-foreground font-semibold">{formatCurrency(openSum)}</span>
            </span>
          ) : null}
          <ExportInvoicesButton rows={shown} />
          <NewIncomingInvoiceDialog suppliers={suppliers} />
        </div>
      </div>

      {topSuppliers.length > 0 ? (
        <div className="mb-3 flex flex-wrap gap-2">
          {topSuppliers.map(([name, sum]) => (
            <span key={name} className="bg-muted inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs">
              <span className="font-medium">{name}</span>
              <span className="text-muted-foreground">{formatCurrency(sum)}</span>
            </span>
          ))}
        </div>
      ) : null}

      <div className="mb-3 flex gap-1">
        {filters.map(([val, label]) => (
          <Button
            key={val}
            type="button"
            size="sm"
            variant={filter === val ? "default" : "outline"}
            onClick={() => setFilter(val)}
          >
            {label}
          </Button>
        ))}
      </div>

      {shown.length === 0 ? (
        <EmptyState title="Keine Eingangsrechnungen" description="Verbuche oben einen erfassten Beleg oder lege eine an." />
      ) : (
        <div className="bg-card rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Lieferant</TableHead>
                <TableHead className="w-24">Nr.</TableHead>
                <TableHead className="w-28">Fällig</TableHead>
                <TableHead className="w-28 text-right">Betrag</TableHead>
                <TableHead>Projekt</TableHead>
                <TableHead className="w-24">Status</TableHead>
                <TableHead className="w-40 text-right">Aktion</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shown.map((i) => {
                const overdue = isOverdue(i);
                return (
                  <TableRow key={i.id}>
                    <TableCell className="font-medium">
                      {i.supplier ?? "—"}
                      {i.notes ? (
                        <span className="text-muted-foreground block text-xs font-normal">{i.notes}</span>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{i.invoice_number ?? "—"}</TableCell>
                    <TableCell className={overdue ? "text-destructive" : "text-muted-foreground"}>
                      {i.due_date ? formatDate(i.due_date) : "—"}
                    </TableCell>
                    <TableCell className="text-right">{formatCurrency(num(i.amount))}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {i.project ? (
                        <Link href={`/projekte/${i.project.id}`} className="hover:underline">
                          {i.project.title ?? "Projekt"}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={i.status === "bezahlt" ? "default" : overdue ? "destructive" : "outline"}>
                        {i.status === "bezahlt" ? "bezahlt" : overdue ? "überfällig" : "offen"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <NewIncomingInvoiceDialog
                          suppliers={suppliers}
                          title="Eingangsrechnung duplizieren"
                          initial={{
                            supplier: i.supplier,
                            invoice_number: i.invoice_number,
                            amount: i.amount,
                            currency: i.currency,
                            notes: i.notes,
                          }}
                          trigger={
                            <Button variant="ghost" size="icon" className="size-7" title="Duplizieren">
                              <Copy className="size-3.5" />
                            </Button>
                          }
                        />
                        {fileUrls[i.id] ? (
                          <Button variant="ghost" size="sm" asChild title="Beleg-PDF öffnen">
                            <a href={fileUrls[i.id]} target="_blank" rel="noopener noreferrer">
                              <FileText className="size-4" /> PDF
                            </a>
                          </Button>
                        ) : null}
                        {i.status !== "bezahlt" ? (
                          <form action={markIncomingPaid}>
                            <input type="hidden" name="id" value={i.id} />
                            <Button variant="ghost" size="sm" type="submit">
                              <Check className="size-4" /> Bezahlt
                            </Button>
                          </form>
                        ) : (
                          <form action={markIncomingOpen}>
                            <input type="hidden" name="id" value={i.id} />
                            <Button variant="ghost" size="sm" type="submit" title="Wieder als offen markieren">
                              Offen
                            </Button>
                          </form>
                        )}
                        <form action={deleteIncomingInvoice}>
                          <input type="hidden" name="id" value={i.id} />
                          <Button variant="ghost" size="icon" className="size-7" type="submit" title="Löschen">
                            <Trash2 className="size-3.5" />
                          </Button>
                        </form>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
