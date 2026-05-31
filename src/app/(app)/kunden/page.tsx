import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { SupabaseNotice } from "@/components/shared/supabase-notice";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CustomerFormDialog } from "@/components/kunden/customer-form-dialog";
import { getCustomers } from "@/lib/data/customers";
import { customerName } from "@/lib/format";

export const metadata: Metadata = { title: "Kunden" };

export default async function KundenPage() {
  const customers = await getCustomers();

  const newButton = (
    <CustomerFormDialog
      trigger={
        <Button>
          <Plus className="size-4" /> Neuer Kunde
        </Button>
      }
    />
  );

  return (
    <div>
      <PageHeader title="Kunden" description="Kundenstamm verwalten.">
        {newButton}
      </PageHeader>

      <SupabaseNotice />

      {customers.length === 0 ? (
        <EmptyState
          title="Noch keine Kunden"
          description="Lege deinen ersten Kunden an, um loszulegen."
        >
          {newButton}
        </EmptyState>
      ) : (
        <div className="bg-card rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-20">Nr.</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Typ</TableHead>
                <TableHead>Kontakt</TableHead>
                <TableHead>Ort</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customers.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="text-muted-foreground">
                    {c.customer_nr ?? "–"}
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/kunden/${c.id}`}
                      className="font-medium hover:underline"
                    >
                      {customerName(c)}
                    </Link>
                  </TableCell>
                  <TableCell>
                    {c.kind ? (
                      <Badge variant="secondary" className="capitalize">
                        {c.kind}
                      </Badge>
                    ) : (
                      "–"
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {c.email ?? c.phone ?? c.mobile ?? "–"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {c.city ?? "–"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
