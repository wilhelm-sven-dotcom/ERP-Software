import type { Metadata } from "next";
import Link from "next/link";
import { Calculator } from "lucide-react";

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
import { getProjects } from "@/lib/data/projects";
import { customerName, formatNumber } from "@/lib/format";

export const metadata: Metadata = { title: "Kalkulation" };

export default async function KalkulationPage() {
  const projects = await getProjects();

  return (
    <div>
      <PageHeader
        title="Kalkulation"
        description="Projekt wählen, um dessen Kalkulation zu bearbeiten."
      />

      <SupabaseNotice />

      {projects.length === 0 ? (
        <EmptyState
          title="Keine Projekte"
          description="Lege zuerst ein Projekt an, um eine Kalkulation zu erstellen."
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
                <TableHead>Projekt</TableHead>
                <TableHead>Kunde</TableHead>
                <TableHead className="text-right">kWp</TableHead>
                <TableHead className="w-32" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {projects.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">
                    {p.title ?? "Ohne Titel"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {p.customer ? customerName(p.customer) : "–"}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatNumber(p.system_size_kwp)}
                  </TableCell>
                  <TableCell>
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/kalkulation/${p.id}`}>
                        <Calculator className="size-4" /> Kalkulieren
                      </Link>
                    </Button>
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
