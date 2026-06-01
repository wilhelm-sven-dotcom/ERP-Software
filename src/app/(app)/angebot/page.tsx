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
import { getProjects } from "@/lib/data/projects";
import { customerName } from "@/lib/format";
import { statusVariant } from "@/lib/constants";

export const metadata: Metadata = { title: "Angebot" };

export default async function AngebotPage() {
  const projects = await getProjects();

  return (
    <div>
      <PageHeader
        title="Angebot"
        description="Projekt wählen, um das Angebot zu erzeugen (basierend auf der Kalkulation)."
      />

      <SupabaseNotice />

      {projects.length === 0 ? (
        <EmptyState
          title="Keine Projekte"
          description="Lege zuerst ein Projekt mit Kalkulation an."
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
                <TableHead>Status</TableHead>
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
                  <TableCell>
                    <Badge variant={statusVariant(p.status)}>
                      {p.status ?? "–"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/angebot/${p.id}`}>
                        <FileText className="size-4" /> Angebot
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
