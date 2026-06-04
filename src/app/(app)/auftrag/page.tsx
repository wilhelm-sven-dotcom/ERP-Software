import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/shared/page-header";
import { SupabaseNotice } from "@/components/shared/supabase-notice";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getDocumentsByKind } from "@/lib/data/documents";
import { customerName, formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Aufträge" };

export default async function AuftragPage() {
  const docs = await getDocumentsByKind("auftragsbestaetigung");

  return (
    <div>
      <PageHeader title="Aufträge" description="Auftragsbestätigungen." />
      <SupabaseNotice />

      {docs.length === 0 ? (
        <EmptyState
          title="Noch keine Aufträge"
          description="Aus einem angenommenen Angebot kann eine Auftragsbestätigung erstellt werden."
        />
      ) : (
        <div className="bg-card rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-28">AB-Nr.</TableHead>
                <TableHead>Projekt</TableHead>
                <TableHead>Kunde</TableHead>
                <TableHead className="w-28">Datum</TableHead>
                <TableHead className="w-32">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {docs.map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="font-medium">
                    <Link href={`/auftrag/${d.id}`} className="hover:underline">
                      {d.doc_number ?? "–"}
                    </Link>
                  </TableCell>
                  <TableCell>{d.project?.title ?? "–"}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {d.project?.customer ? customerName(d.project.customer) : "–"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(d.created_at)}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{d.status}</Badge>
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
