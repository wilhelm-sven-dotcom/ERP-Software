import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileOutput, Trash2 } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { SupabaseNotice } from "@/components/shared/supabase-notice";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PrintButton } from "@/components/angebot/print-button";
import { DocumentStatusSelect } from "@/components/dokumente/document-status-select";
import {
  DocumentHeader,
  DocumentFooter,
  RecipientBlock,
  salutationLine,
} from "@/components/documents/letterhead";
import { getDocument } from "@/lib/data/documents";
import { getProject } from "@/lib/data/projects";
import { getCustomer } from "@/lib/data/customers";
import { getCompanySettings } from "@/lib/data/settings";
import { getTextBlocksFor } from "@/lib/data/text-blocks";
import {
  createDeliveryNote,
  deleteDocument,
} from "@/app/(app)/dokumente/actions";
import { calculate } from "@/lib/calc/engine";
import { formatCurrency, formatNumber } from "@/lib/format";
import type { CalcPosition } from "@/lib/calc/types";

export const metadata: Metadata = { title: "Auftragsbestätigung" };

export default async function AuftragDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const doc = await getDocument(id);
  if (!doc || doc.kind !== "auftragsbestaetigung") notFound();

  const [project, company] = await Promise.all([
    getProject(doc.project_id),
    getCompanySettings(),
  ]);
  const [customer, blocks] = await Promise.all([
    project?.customer_id ? getCustomer(project.customer_id) : Promise.resolve(null),
    getTextBlocksFor(project?.project_type ?? null),
  ]);

  const m = doc.meta as Record<string, unknown>;
  const num = (v: unknown, d = 0) => (typeof v === "number" ? v : d);
  const result = calculate({
    positions: doc.positions as CalcPosition[],
    pauschalRabattPercent: num(m.pauschalRabattPercent),
    nachlass: num(m.nachlass),
    mwstPercent:
      (m.mwstPerGroup as Record<string, number> | undefined)?.["Sonstiges"] ?? 19,
    mwstPerGroup:
      m.mwstPerGroup && typeof m.mwstPerGroup === "object"
        ? (m.mwstPerGroup as Record<string, number>)
        : undefined,
    skontoPercent: num(m.skontoPercent),
  });
  const t = result.totals;
  const block = (kind: string) => blocks.find((b) => b.kind === kind) ?? null;
  const datum = new Intl.DateTimeFormat("de-DE", { dateStyle: "long" }).format(
    new Date(doc.created_at),
  );

  return (
    <div>
      <div className="flex items-center justify-between gap-2 print:hidden">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/auftrag">
            <ArrowLeft className="size-4" /> Zur Übersicht
          </Link>
        </Button>
        <div className="flex items-center gap-2">
          <DocumentStatusSelect documentId={doc.id} kind={doc.kind} status={doc.status} />
          <form action={createDeliveryNote}>
            <input type="hidden" name="document_id" value={doc.id} />
            <Button type="submit" variant="outline">
              <FileOutput className="size-4" /> Lieferschein erstellen
            </Button>
          </form>
          <PrintButton />
          <form action={deleteDocument}>
            <input type="hidden" name="id" value={doc.id} />
            <input type="hidden" name="kind" value={doc.kind} />
            <input type="hidden" name="project_id" value={doc.project_id} />
            <Button variant="ghost" size="icon" type="submit" title="Löschen">
              <Trash2 className="size-4" />
            </Button>
          </form>
        </div>
      </div>

      <div className="print:hidden">
        <PageHeader
          title={`Auftragsbestätigung Nr. ${doc.doc_number ?? "–"}`}
          description={project?.title ?? undefined}
        />
        <SupabaseNotice />
      </div>

      <article className="bg-card mx-auto max-w-3xl rounded-lg border p-8 print:border-0 print:p-0 print:shadow-none">
        <DocumentHeader
          company={company}
          rightTitle={`Auftragsbestätigung Nr. ${doc.doc_number ?? "–"}`}
          rightLines={[datum]}
        />
        <RecipientBlock customer={customer} />

        <p className="mt-6 text-sm">{salutationLine(customer)}</p>
        <p className="mt-2 text-sm leading-relaxed">
          vielen Dank für Ihren Auftrag. Hiermit bestätigen wir die Ausführung der
          folgenden Leistungen für Ihr Projekt
          {project?.title ? ` „${project.title}“` : ""}.
        </p>

        <div className="mt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Position</TableHead>
                <TableHead className="text-right">Menge</TableHead>
                <TableHead>Einheit</TableHead>
                <TableHead className="text-right">Einzelpreis</TableHead>
                <TableHead className="text-right">Summe netto</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.positions.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>{p.bezeichnung || "—"}</TableCell>
                  <TableCell className="text-right">{formatNumber(p.menge)}</TableCell>
                  <TableCell>{p.einheit ?? ""}</TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(p.einzelpreis)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(p.positionNetto)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="mt-6 flex justify-end">
          <table className="min-w-[320px] text-sm">
            <tbody>
              <tr className="font-semibold">
                <td className="py-1">Summe netto</td>
                <td className="py-1 text-right">{formatCurrency(t.netto)}</td>
              </tr>
              {(t.mwstSaetze ?? [{ rate: t.mwstSatz, betrag: t.mwstBetrag, netto: t.netto }]).map(
                (mw) => (
                  <tr key={mw.rate}>
                    <td className="py-1">MwSt {formatNumber(mw.rate, 0)} %</td>
                    <td className="py-1 text-right">{formatCurrency(mw.betrag)}</td>
                  </tr>
                ),
              )}
              <tr className="border-t text-base font-bold">
                <td className="text-primary py-1.5">Gesamt brutto</td>
                <td className="text-primary py-1.5 text-right">{formatCurrency(t.brutto)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {block("zahlungsbedingungen") ? (
          <div className="mt-6 text-sm leading-relaxed">
            <h4 className="text-primary mb-1 font-semibold">
              {block("zahlungsbedingungen")!.title || "Zahlungsbedingungen"}
            </h4>
            <p className="whitespace-pre-wrap">{block("zahlungsbedingungen")!.body}</p>
          </div>
        ) : null}

        <div className="mt-10 text-sm">
          <p>
            {company.city || "Weiden"}, den{" "}
            {new Intl.DateTimeFormat("de-DE").format(new Date(doc.created_at))}
          </p>
          <p className="mt-8">{company.name || "ip³ Energietechnik"}</p>
          {company.ceo ? <p className="text-muted-foreground">{company.ceo}</p> : null}
        </div>

        <DocumentFooter company={company} />
      </article>
    </div>
  );
}
