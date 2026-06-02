import type { Metadata } from "next";
import Link from "next/link";
import { BellRing, Check } from "lucide-react";

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
import { markInvoicePaid, createReminder } from "@/app/(app)/dokumente/actions";
import { mahnStage } from "@/lib/constants";
import { customerName, formatCurrency, formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Offene Posten" };

const num = (v: unknown, d = 0) => (typeof v === "number" ? v : d);

export default async function OffenePostenPage() {
  const all = await getDocumentsByKind("rechnung");
  const today = new Date().toISOString().slice(0, 10);
  const open = all
    .filter((d) => d.payment_status !== "bezahlt")
    .sort((a, b) => (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999"));

  const offenSum = open.reduce((s, d) => s + num((d.totals as { brutto?: number }).brutto), 0);
  const overdueCount = open.filter((d) => d.due_date && d.due_date < today).length;

  return (
    <div>
      <PageHeader
        title="Offene Posten"
        description="Unbezahlte Rechnungen, Fälligkeiten und Mahnungen."
      />
      <SupabaseNotice />

      {open.length === 0 ? (
        <EmptyState
          title="Keine offenen Posten"
          description="Alle Rechnungen sind bezahlt. 🎉"
        />
      ) : (
        <>
          <div className="text-muted-foreground mb-3 text-sm">
            {open.length} offen · {overdueCount} überfällig · Summe{" "}
            <span className="text-foreground font-semibold">{formatCurrency(offenSum)}</span>
          </div>
          <div className="bg-card rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-20">Nr.</TableHead>
                  <TableHead>Kunde</TableHead>
                  <TableHead className="w-28">Fällig</TableHead>
                  <TableHead className="w-28 text-right">Betrag</TableHead>
                  <TableHead className="w-24">Mahnstufe</TableHead>
                  <TableHead className="w-56 text-right">Aktion</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {open.map((d) => {
                  const overdue = d.due_date != null && d.due_date < today;
                  const level = num(d.reminder_level);
                  const nextStage = mahnStage(level + 1);
                  return (
                    <TableRow key={d.id}>
                      <TableCell className="font-medium">
                        <Link href={`/rechnung/${d.id}`} className="hover:underline">
                          {d.doc_number ?? "–"}
                        </Link>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {d.project?.customer ? customerName(d.project.customer) : "–"}
                      </TableCell>
                      <TableCell className={overdue ? "text-destructive" : "text-muted-foreground"}>
                        {d.due_date ? formatDate(d.due_date) : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(num((d.totals as { brutto?: number }).brutto))}
                      </TableCell>
                      <TableCell>
                        {level > 0 ? (
                          <Badge variant="destructive">Stufe {level}</Badge>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          <form action={createReminder}>
                            <input type="hidden" name="invoice_id" value={d.id} />
                            <Button variant="outline" size="sm" type="submit" title={nextStage.title}>
                              <BellRing className="size-4" /> {nextStage.title}
                            </Button>
                          </form>
                          <form action={markInvoicePaid}>
                            <input type="hidden" name="id" value={d.id} />
                            <Button variant="ghost" size="sm" type="submit" title="Als bezahlt markieren">
                              <Check className="size-4" /> Bezahlt
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
        </>
      )}
    </div>
  );
}
