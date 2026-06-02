import type { Metadata } from "next";
import Link from "next/link";

import { Download } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { SupabaseNotice } from "@/components/shared/supabase-notice";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getDocumentsByKind } from "@/lib/data/documents";
import { customerName, formatCurrency, formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Rechnungen" };

const num = (v: unknown, d = 0) => (typeof v === "number" ? v : d);

function paymentBadge(status: string | null, due: string | null) {
  const today = new Date().toISOString().slice(0, 10);
  if (status === "bezahlt") return { label: "bezahlt", variant: "default" as const };
  if (status === "teilbezahlt") return { label: "teilbezahlt", variant: "secondary" as const };
  if (due && due < today) return { label: "überfällig", variant: "destructive" as const };
  return { label: "offen", variant: "outline" as const };
}

export default async function RechnungPage() {
  const docs = await getDocumentsByKind("rechnung");

  return (
    <div>
      <PageHeader title="Rechnungen" description="Voll-, Abschlags- und Schlussrechnungen." />
      <SupabaseNotice />

      <form
        method="get"
        action="/api/datev/export"
        className="bg-card mb-4 flex flex-wrap items-end gap-2 rounded-xl border p-3 text-sm"
      >
        <div className="grid gap-1">
          <label htmlFor="from" className="text-muted-foreground text-xs">Von</label>
          <input id="from" name="from" type="date" defaultValue={`${new Date().getFullYear()}-01-01`} className="border-input h-9 rounded-lg border bg-transparent px-3" />
        </div>
        <div className="grid gap-1">
          <label htmlFor="to" className="text-muted-foreground text-xs">Bis</label>
          <input id="to" name="to" type="date" defaultValue={new Date().toISOString().slice(0, 10)} className="border-input h-9 rounded-lg border bg-transparent px-3" />
        </div>
        <div className="grid gap-1">
          <label htmlFor="status" className="text-muted-foreground text-xs">Status</label>
          <select id="status" name="status" className="border-input h-9 rounded-lg border bg-transparent px-3">
            <option value="">alle</option>
            <option value="offen">nur offen</option>
            <option value="bezahlt">nur bezahlt</option>
          </select>
        </div>
        <Button type="submit" variant="outline">
          <Download className="size-4" /> DATEV-/CSV-Export
        </Button>
      </form>

      {docs.length === 0 ? (
        <EmptyState
          title="Noch keine Rechnungen"
          description="Aus einer Auftragsbestätigung kann eine (Abschlags-)Rechnung erstellt werden."
        />
      ) : (
        <div className="bg-card rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-24">Nr.</TableHead>
                <TableHead>Bezeichnung</TableHead>
                <TableHead>Kunde</TableHead>
                <TableHead className="w-28">Datum</TableHead>
                <TableHead className="w-28 text-right">Betrag</TableHead>
                <TableHead className="w-28">Zahlung</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {docs.map((d) => {
                const pay = paymentBadge(d.payment_status, d.due_date);
                return (
                  <TableRow key={d.id}>
                    <TableCell className="font-medium">
                      <Link href={`/rechnung/${d.id}`} className="hover:underline">
                        {d.doc_number ?? "–"}
                      </Link>
                    </TableCell>
                    <TableCell>{d.title ?? "Rechnung"}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {d.project?.customer ? customerName(d.project.customer) : "–"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(d.invoice_date ?? d.created_at)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(num((d.totals as { brutto?: number }).brutto))}
                    </TableCell>
                    <TableCell>
                      <Badge variant={pay.variant}>{pay.label}</Badge>
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
