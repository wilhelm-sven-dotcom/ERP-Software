import Link from "next/link";
import { BookCheck, Check, FileText, Trash2 } from "lucide-react";

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
import { getIncomingDocuments } from "@/lib/data/project-files";
import { getIncomingInvoices, getBookedFileIds, getInvoiceFileUrls } from "@/lib/data/incoming-invoices";
import { bookIncomingInvoice, markIncomingPaid, deleteIncomingInvoice } from "@/app/(app)/buchhaltung/actions";
import { formatCurrency, formatDate } from "@/lib/format";

const num = (v: unknown): number => (typeof v === "number" ? v : 0);

/**
 * Eingangsbelege: ausgelesene Belege als Eingangsrechnung verbuchen +
 * Liste der gebuchten Eingangsrechnungen mit Zahlungsstatus.
 */
export async function EingangsbelegeSection() {
  const [docs, invoices, bookedIds] = await Promise.all([
    getIncomingDocuments(),
    getIncomingInvoices(),
    getBookedFileIds(),
  ]);
  const unbooked = docs.filter((d) => !bookedIds.has(d.id));
  const fileUrls = await getInvoiceFileUrls(invoices);
  const today = new Date().toISOString().slice(0, 10);
  const openSum = invoices.filter((i) => i.status !== "bezahlt").reduce((s, i) => s + num(i.amount), 0);

  return (
    <div className="space-y-6">
      {/* Noch nicht verbuchte, ausgelesene Belege */}
      <div>
        <h3 className="mb-2 text-sm font-semibold">Erfasste Belege (noch nicht verbucht)</h3>
        {unbooked.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            Keine offenen Belege. Ziehe Rechnungen in den KI-Assistenten/ein Projekt — die KI liest
            Lieferant, Nummer, Betrag und Datum aus.
          </p>
        ) : (
          <div className="bg-card rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Beleg</TableHead>
                  <TableHead>Lieferant</TableHead>
                  <TableHead className="w-24">Nr.</TableHead>
                  <TableHead className="w-28 text-right">Betrag</TableHead>
                  <TableHead>Projekt</TableHead>
                  <TableHead className="w-32 text-right">Aktion</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {unbooked.map((d) => {
                  const m = d.doc_meta ?? {};
                  return (
                    <TableRow key={d.id}>
                      <TableCell className="font-medium">{d.name}</TableCell>
                      <TableCell className="text-muted-foreground">{m.supplier ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{m.invoice_number ?? "—"}</TableCell>
                      <TableCell className="text-right">
                        {m.amount != null && m.amount !== "" ? `${m.amount} ${m.currency ?? "€"}` : "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {d.project?.title ?? "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <form action={bookIncomingInvoice}>
                          <input type="hidden" name="source_file_id" value={d.id} />
                          <input type="hidden" name="supplier" value={m.supplier ?? ""} />
                          <input type="hidden" name="invoice_number" value={m.invoice_number ?? ""} />
                          <input type="hidden" name="invoice_date" value={m.invoice_date ?? ""} />
                          <input type="hidden" name="due_date" value={m.due_date ?? ""} />
                          <input type="hidden" name="amount" value={m.amount != null ? String(m.amount) : ""} />
                          <input type="hidden" name="currency" value={m.currency ?? "EUR"} />
                          <input type="hidden" name="project_id" value={d.project?.id ?? ""} />
                          <Button variant="outline" size="sm" type="submit">
                            <BookCheck className="size-4" /> Verbuchen
                          </Button>
                        </form>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Gebuchte Eingangsrechnungen */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold">Eingangsrechnungen</h3>
          {openSum > 0 ? (
            <span className="text-muted-foreground text-sm">
              offen: <span className="text-foreground font-semibold">{formatCurrency(openSum)}</span>
            </span>
          ) : null}
        </div>
        {invoices.length === 0 ? (
          <EmptyState title="Keine Eingangsrechnungen" description="Verbuche oben einen erfassten Beleg." />
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
                {invoices.map((i) => {
                  const overdue = i.status !== "bezahlt" && i.due_date != null && i.due_date < today;
                  return (
                    <TableRow key={i.id}>
                      <TableCell className="font-medium">{i.supplier ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{i.invoice_number ?? "—"}</TableCell>
                      <TableCell className={overdue ? "text-destructive" : "text-muted-foreground"}>
                        {i.due_date ? formatDate(i.due_date) : "—"}
                      </TableCell>
                      <TableCell className="text-right">{formatCurrency(num(i.amount))}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {i.project ? (
                          <Link href={`/projekte/${i.project.id}`} className="hover:underline">{i.project.title ?? "Projekt"}</Link>
                        ) : "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={i.status === "bezahlt" ? "default" : overdue ? "destructive" : "outline"}>
                          {i.status === "bezahlt" ? "bezahlt" : overdue ? "überfällig" : "offen"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
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
                              <Button variant="ghost" size="sm" type="submit"><Check className="size-4" /> Bezahlt</Button>
                            </form>
                          ) : null}
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
    </div>
  );
}
