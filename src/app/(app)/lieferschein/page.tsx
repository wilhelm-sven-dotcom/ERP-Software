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

export const metadata: Metadata = { title: "Lieferscheine" };

export default async function LieferscheinPage() {
  const docs = await getDocumentsByKind("lieferschein");

  return (
    <div>
      <PageHeader title="Lieferscheine" description="Lieferscheine & Bestelllisten." />
      <SupabaseNotice />

      {docs.length === 0 ? (
        <EmptyState
          title="Noch keine Lieferscheine"
          description="Aus einer Auftragsbestätigung kann ein Lieferschein erstellt werden."
        />
      ) : (
        <div className="bg-card rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-28">LS-Nr.</TableHead>
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
                    <Link href={`/lieferschein/${d.id}`} className="hover:underline">
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
