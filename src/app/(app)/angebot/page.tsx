import type { Metadata } from "next";
import Link from "next/link";
import { FileText } from "lucide-react";

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
import { getAllOffers } from "@/lib/data/offers";
import { customerName, formatCurrency, formatNumber } from "@/lib/format";
import { offerStatusVariant } from "@/lib/constants";

export const metadata: Metadata = { title: "Angebote" };

export default async function AngebotPage() {
  const offers = await getAllOffers();

  return (
    <div>
      <PageHeader
        title="Angebote"
        description="Erstellte Angebote. Neue Angebote entstehen im Projekt aus einer Kalkulations-Variante."
      />

      <SupabaseNotice />

      {offers.length === 0 ? (
        <EmptyState
          title="Noch keine Angebote"
          description="Öffne ein Projekt und erstelle aus einer Kalkulations-Variante ein Angebot."
        >
          <Button asChild>
            <Link href="/projekte">Zu den Projekten</Link>
          </Button>
        </EmptyState>
      ) : (
        <div className="bg-card rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-20">Nr.</TableHead>
                <TableHead>Projekt</TableHead>
                <TableHead>Kunde</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">kWp / kWh</TableHead>
                <TableHead className="text-right">Brutto</TableHead>
                <TableHead className="w-28" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {offers.map((o) => {
                const brutto =
                  typeof o.totals?.brutto === "number" ? o.totals.brutto : null;
                return (
                  <TableRow key={o.id}>
                    <TableCell className="font-medium">
                      {o.offer_number ?? "–"}
                    </TableCell>
                    <TableCell>{o.project?.title ?? "–"}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {o.project?.customer
                        ? customerName(o.project.customer)
                        : "–"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={offerStatusVariant(o.status)}>
                        {o.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-right">
                      {o.project?.system_size_kwp
                        ? `${formatNumber(o.project.system_size_kwp)} kWp`
                        : "–"}
                      {o.project?.storage_kwh
                        ? ` / ${formatNumber(o.project.storage_kwh)} kWh`
                        : ""}
                    </TableCell>
                    <TableCell className="text-right">
                      {brutto !== null ? formatCurrency(brutto) : "–"}
                    </TableCell>
                    <TableCell>
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/angebot/${o.id}`}>
                          <FileText className="size-4" /> Öffnen
                        </Link>
                      </Button>
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
