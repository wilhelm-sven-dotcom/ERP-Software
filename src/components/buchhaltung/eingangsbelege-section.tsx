import { BookCheck } from "lucide-react";

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
import { getIncomingInvoices, getBookedFileIds, getInvoiceFileUrls, getSupplierNames } from "@/lib/data/incoming-invoices";
import { bookIncomingInvoice } from "@/app/(app)/buchhaltung/actions";
import { IncomingInvoicesTable } from "@/components/buchhaltung/incoming-invoices-table";

/**
 * Eingangsbelege: ausgelesene Belege als Eingangsrechnung verbuchen +
 * Liste der gebuchten Eingangsrechnungen mit Zahlungsstatus.
 */
export async function EingangsbelegeSection() {
  const [docs, invoicesRaw, bookedIds, suppliers] = await Promise.all([
    getIncomingDocuments(),
    getIncomingInvoices(),
    getBookedFileIds(),
    getSupplierNames(),
  ]);
  const unbooked = docs.filter((d) => !bookedIds.has(d.id));
  const fileUrls = await getInvoiceFileUrls(invoicesRaw);
  const today = new Date().toISOString().slice(0, 10);
  const isOverdue = (i: (typeof invoicesRaw)[number]) =>
    i.status !== "bezahlt" && i.due_date != null && i.due_date < today;
  // Sortierung: überfällige zuerst, dann offene, dann bezahlte.
  const rank = (i: (typeof invoicesRaw)[number]) =>
    isOverdue(i) ? 0 : i.status !== "bezahlt" ? 1 : 2;
  const invoices = [...invoicesRaw].sort((a, b) => rank(a) - rank(b));

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
      <IncomingInvoicesTable invoices={invoices} fileUrls={fileUrls} suppliers={suppliers} />
    </div>
  );
}
