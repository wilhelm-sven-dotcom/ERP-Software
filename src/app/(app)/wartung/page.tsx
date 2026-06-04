import type { Metadata } from "next";
import { CheckCircle2, Pencil, Trash2 } from "lucide-react";

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
import { ContractFormDialog } from "@/components/wartung/contract-form-dialog";
import { getServiceContracts } from "@/lib/data/service-contracts";
import { getCustomers } from "@/lib/data/customers";
import { completeMaintenance, deleteContract } from "@/app/(app)/wartung/actions";
import { customerName, formatCurrency, formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Wartung" };

export default async function WartungPage() {
  const [contracts, customers] = await Promise.all([
    getServiceContracts(),
    getCustomers(),
  ]);
  const customerOptions = customers.map((c) => ({ id: c.id, name: customerName(c) }));
  const today = new Date().toISOString().slice(0, 10);
  const soon = new Date();
  soon.setDate(soon.getDate() + 30);
  const soonStr = soon.toISOString().slice(0, 10);

  return (
    <div>
      <PageHeader title="Wartung" description="Wartungsverträge mit Intervall und Fälligkeit.">
        <ContractFormDialog customers={customerOptions} />
      </PageHeader>
      <SupabaseNotice />

      {contracts.length === 0 ? (
        <EmptyState
          title="Noch keine Wartungsverträge"
          description="Lege einen wiederkehrenden Wartungsvertrag für einen Kunden an."
        />
      ) : (
        <div className="bg-card rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Vertrag</TableHead>
                <TableHead>Kunde</TableHead>
                <TableHead className="w-24">Intervall</TableHead>
                <TableHead className="w-32">Nächste Fälligkeit</TableHead>
                <TableHead className="w-24 text-right">Preis</TableHead>
                <TableHead className="w-24">Status</TableHead>
                <TableHead className="w-44 text-right">Aktion</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contracts.map((c) => {
                const overdue = c.status === "aktiv" && c.next_due != null && c.next_due < today;
                const dueSoon =
                  c.status === "aktiv" && c.next_due != null && !overdue && c.next_due <= soonStr;
                return (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.title}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {c.customer ? customerName(c.customer) : "–"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{c.interval_months} Mon.</TableCell>
                    <TableCell className={overdue ? "text-destructive font-medium" : dueSoon ? "text-warning font-medium" : ""}>
                      {c.next_due ? formatDate(c.next_due) : "—"}
                      {overdue ? " · überfällig" : dueSoon ? " · bald" : ""}
                    </TableCell>
                    <TableCell className="text-right">
                      {c.price != null ? formatCurrency(c.price) : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={c.status === "aktiv" ? "outline" : "secondary"}>{c.status}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <form action={completeMaintenance}>
                          <input type="hidden" name="id" value={c.id} />
                          <Button variant="ghost" size="sm" type="submit" title="Wartung durchgeführt">
                            <CheckCircle2 className="size-4" /> Erledigt
                          </Button>
                        </form>
                        <ContractFormDialog
                          contract={c}
                          customers={customerOptions}
                          trigger={
                            <Button variant="ghost" size="icon" className="size-8" title="Bearbeiten">
                              <Pencil className="size-4" />
                            </Button>
                          }
                        />
                        <form action={deleteContract}>
                          <input type="hidden" name="id" value={c.id} />
                          <Button variant="ghost" size="icon" className="size-8" type="submit" title="Löschen">
                            <Trash2 className="size-4" />
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
