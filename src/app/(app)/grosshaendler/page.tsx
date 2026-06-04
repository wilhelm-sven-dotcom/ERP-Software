import type { Metadata } from "next";
import { Pencil, Plus, Trash2 } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { SupabaseNotice } from "@/components/shared/supabase-notice";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { WholesalerFormDialog } from "@/components/grosshaendler/wholesaler-form-dialog";
import { getWholesalers } from "@/lib/data/wholesalers";
import { deleteWholesaler } from "@/app/(app)/grosshaendler/actions";

export const metadata: Metadata = { title: "Großhändler" };

export default async function GrosshaendlerPage() {
  const wholesalers = await getWholesalers();

  const newButton = (
    <WholesalerFormDialog
      trigger={
        <Button>
          <Plus className="size-4" /> Neuer Großhändler
        </Button>
      }
    />
  );

  return (
    <div>
      <PageHeader
        title="Großhändler"
        description="Lieferanten verwalten – je Produkt mit Bestellnummer und EK-Preis hinterlegbar."
      >
        {newButton}
      </PageHeader>

      <SupabaseNotice />

      {wholesalers.length === 0 ? (
        <EmptyState
          title="Noch keine Großhändler"
          description="Lege Großhändler an, um sie in Produkten mit Bestellnummer zu verknüpfen."
        >
          {newButton}
        </EmptyState>
      ) : (
        <div className="bg-card rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Ansprechpartner</TableHead>
                <TableHead>E-Mail</TableHead>
                <TableHead>Telefon</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {wholesalers.map((w) => (
                <TableRow key={w.id}>
                  <TableCell className="font-medium">{w.name}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {w.contact ?? "–"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {w.email ?? "–"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {w.phone ?? "–"}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-0.5">
                      <WholesalerFormDialog
                        wholesaler={w}
                        trigger={
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8"
                            title="Bearbeiten"
                          >
                            <Pencil className="size-4" />
                          </Button>
                        }
                      />
                      <form action={deleteWholesaler}>
                        <input type="hidden" name="id" value={w.id} />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8"
                          type="submit"
                          title="Löschen"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </form>
                    </div>
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
