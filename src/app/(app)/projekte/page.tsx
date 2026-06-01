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
import { ProjectFormDialog } from "@/components/projekte/project-form-dialog";
import { getProjects } from "@/lib/data/projects";
import { getCustomers } from "@/lib/data/customers";
import { getEmployees } from "@/lib/data/employees";
import { customerName, formatNumber } from "@/lib/format";
import { statusVariant } from "@/lib/constants";

export const metadata: Metadata = { title: "Projekte" };

export default async function ProjektePage({
  searchParams,
}: {
  searchParams: Promise<{ neu?: string }>;
}) {
  const [{ neu }, projects, customers, employees] = await Promise.all([
    searchParams,
    getProjects(),
    getCustomers(),
    getEmployees(),
  ]);
  const openOnMount = neu === "1";

  const newButton = (
    <ProjectFormDialog
      customers={customers}
      employees={employees}
      openOnMount={openOnMount}
      trigger={
        <Button>
          <Plus className="size-4" /> Neues Projekt
        </Button>
      }
    />
  );

  return (
    <div>
      <PageHeader title="Projekte" description="Alle Projekte verwalten.">
        {newButton}
      </PageHeader>

      <SupabaseNotice />

      {projects.length === 0 ? (
        <EmptyState
          title="Noch keine Projekte"
          description="Lege dein erstes Projekt an."
        >
          {newButton}
        </EmptyState>
      ) : (
        <div className="bg-card rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Titel</TableHead>
                <TableHead>Kunde</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">kWp</TableHead>
                <TableHead>Ort</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {projects.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <Link
                      href={`/projekte/${p.id}`}
                      className="font-medium hover:underline"
                    >
                      {p.title ?? "Ohne Titel"}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {p.customer ? customerName(p.customer) : "–"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(p.status)}>
                      {p.status ?? "–"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {formatNumber(p.system_size_kwp)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {p.city ?? "–"}
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
