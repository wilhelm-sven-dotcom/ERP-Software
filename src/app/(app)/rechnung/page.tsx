import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/shared/page-header";
import { SupabaseNotice } from "@/components/shared/supabase-notice";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
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
