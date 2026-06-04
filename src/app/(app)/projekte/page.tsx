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
import { ClickableRow } from "@/components/projekte/clickable-row";
import { ProgressBar } from "@/components/projekte/progress-bar";
import { getProjects } from "@/lib/data/projects";
import { getCustomers } from "@/lib/data/customers";
import { getEmployees } from "@/lib/data/employees";
import { getProjectsProgress, getProjectTypeOptions } from "@/lib/data/workflow";
import { customerName, formatNumber } from "@/lib/format";
import { NewBadge } from "@/components/shared/new-badge";
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
  const [progress, projectTypes] = await Promise.all([
    getProjectsProgress(projects.map((p) => p.id)),
    getProjectTypeOptions(),
  ]);
  const openOnMount = neu === "1";

  const newButton = (
    <ProjectFormDialog
      customers={customers}
      employees={employees}
      projectTypes={projectTypes}
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
      <PageHeader title="Projekte" description="Alle Projekte verwalten." helpId="workflow">
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
                <TableHead className="w-40">Fortschritt</TableHead>
                <TableHead className="text-right">kWp</TableHead>
                <TableHead>Ort</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {projects.map((p) => (
                <ClickableRow key={p.id} href={`/projekte/${p.id}`}>
                  <TableCell>
                    <span className="flex items-center gap-2">
                      <Link
                        href={`/projekte/${p.id}`}
                        className="font-medium hover:underline"
                      >
                        {p.title ?? "Ohne Titel"}
                      </Link>
                      <NewBadge createdAt={p.created_at} />
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {p.customer ? customerName(p.customer) : "–"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(p.status)}>
                      {p.status ?? "–"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <ProgressBar
                      done={progress[p.id]?.done ?? 0}
                      total={progress[p.id]?.total ?? 0}
                      overdue={progress[p.id]?.overdue ?? 0}
                      showLabel
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    {formatNumber(p.system_size_kwp)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {p.city ?? "–"}
                  </TableCell>
                </ClickableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
