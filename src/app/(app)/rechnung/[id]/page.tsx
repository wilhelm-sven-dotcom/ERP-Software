import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Trash2 } from "lucide-react";

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
import { deleteDocument } from "@/app/(app)/dokumente/actions";
import { calculate } from "@/lib/calc/engine";
import { formatCurrency, formatNumber, formatDate } from "@/lib/format";
import type { CalcPosition } from "@/lib/calc/types";

export const metadata: Metadata = { title: "Rechnung" };

type Totals = {
  netto?: number;
  brutto?: number;
  mwstSatz?: number;
  mwstBetrag?: number;
  mwstSaetze?: { rate: number; betrag: number; netto: number }[];
};
const num = (v: unknown, d = 0) => (typeof v === "number" ? v : d);

export default async function RechnungDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const doc = await getDocument(id);
  if (!doc || doc.kind !== "rechnung") notFound();

  const [project, company] = await Promise.all([
    getProject(doc.project_id),
    getCompanySettings(),
  ]);
  const customer = project?.customer_id ? await getCustomer(project.customer_id) : null;

  const m = doc.meta as Record<string, unknown>;
  const invoiceType = String(m.invoice_type ?? "voll");
  const isAbschlag = invoiceType === "abschlag";
  const isSchluss = invoiceType === "schluss";

  // Positionen + Summen: Abschlag rendert die eingefrorenen Summen direkt,
  // Voll-/Schlussrechnung rechnet die Positionen wie bei der AB.
  let rows: { id: string; bezeichnung: string; menge: number; einheit: string; einzelpreis: number; positionNetto: number }[];
  let t: Totals;
  if (isAbschlag) {
    const pos = (doc.positions as Record<string, unknown>[]) ?? [];
    rows = pos.map((p, i) => ({
      id: String(p.id ?? i),
      bezeichnung: String(p.bezeichnung ?? ""),
      menge: num(p.menge, 1),
      einheit: String(p.einheit ?? ""),
      einzelpreis: num(p.einzelpreis),
      positionNetto: num(p.einzelpreis) * num(p.menge, 1),
    }));
    t = doc.totals as Totals;
  } else {
    const result = calculate({
      positions: doc.positions as CalcPosition[],
      pauschalRabattPercent: num(m.pauschalRabattPercent),
      nachlass: num(m.nachlass),
      mwstPercent: (m.mwstPerGroup as Record<string, number> | undefined)?.["Sonstiges"] ?? 19,
      mwstPerGroup:
        m.mwstPerGroup && typeof m.mwstPerGroup === "object"
          ? (m.mwstPerGroup as Record<string, number>)
          : undefined,
      skontoPercent: num(m.skontoPercent),
    });
    rows = result.positions.map((p) => ({
      id: p.id,
      bezeichnung: p.bezeichnung || "—",
      menge: p.menge,
      einheit: p.einheit ?? "",
      einzelpreis: p.einzelpreis,
      positionNetto: p.positionNetto,
    }));
    t = result.totals as Totals;
  }

  const mwstLines = t.mwstSaetze ?? [
    { rate: num(t.mwstSatz, 19), betrag: num(t.mwstBetrag), netto: num(t.netto) },
  ];
  const deductions = (m.deductions as { doc_number: number | null; label: string; brutto: number }[] | undefined) ?? [];
  const deductionSum = deductions.reduce((s, d) => s + num(d.brutto), 0);
  const restbetrag = num(t.brutto) - deductionSum;

  const title =
    doc.title ||
    (isAbschlag ? "Abschlagsrechnung" : isSchluss ? "Schlussrechnung" : "Rechnung");
  const datum = doc.invoice_date ? formatDate(doc.invoice_date) : formatDate(doc.created_at);

  return (
    <div>
      <div className="flex items-center justify-between gap-2 print:hidden">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/rechnung">
            <ArrowLeft className="size-4" /> Zur Übersicht
          </Link>
        </Button>
        <div className="flex items-center gap-2">
          <DocumentStatusSelect documentId={doc.id} kind={doc.kind} status={doc.status} />
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
        <PageHeader title={`${title} Nr. ${doc.doc_number ?? "–"}`} description={project?.title ?? undefined} />
        <SupabaseNotice />
      </div>

      <article className="bg-card mx-auto max-w-3xl rounded-xl border p-8 print:border-0 print:p-0 print:shadow-none">
        <DocumentHeader
          company={company}
          rightTitle={`${title} Nr. ${doc.doc_number ?? "–"}`}
          rightLines={[
            `Datum: ${datum}`,
            doc.due_date ? `Fällig bis: ${formatDate(doc.due_date)}` : "",
            project?.title ? `Projekt: ${project.title}` : "",
          ].filter(Boolean)}
        />
        <RecipientBlock customer={customer} />

        <p className="mt-6 text-sm">{salutationLine(customer)}</p>
        <p className="mt-2 text-sm leading-relaxed">
          {isAbschlag
            ? "vereinbarungsgemäß stellen wir Ihnen folgenden Abschlag in Rechnung:"
            : isSchluss
              ? "wir bedanken uns für Ihren Auftrag und stellen Ihnen die erbrachten Leistungen abschließend in Rechnung. Bereits geleistete Abschläge werden abgezogen."
              : "wir bedanken uns für Ihren Auftrag und stellen Ihnen die folgenden Leistungen in Rechnung."}
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
              {rows.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>{p.bezeichnung || "—"}</TableCell>
                  <TableCell className="text-right">{formatNumber(p.menge)}</TableCell>
                  <TableCell>{p.einheit}</TableCell>
                  <TableCell className="text-right">{formatCurrency(p.einzelpreis)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(p.positionNetto)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="mt-6 flex justify-end">
          <table className="min-w-[340px] text-sm">
            <tbody>
              <tr className="font-semibold">
                <td className="py-1">Summe netto</td>
                <td className="py-1 text-right">{formatCurrency(num(t.netto))}</td>
              </tr>
              {mwstLines.map((mw) => (
                <tr key={mw.rate}>
                  <td className="py-1">MwSt {formatNumber(mw.rate, 0)} %</td>
                  <td className="py-1 text-right">{formatCurrency(num(mw.betrag))}</td>
                </tr>
              ))}
              <tr className="border-t text-base font-bold">
                <td className="py-1.5">Gesamt brutto</td>
                <td className="py-1.5 text-right">{formatCurrency(num(t.brutto))}</td>
              </tr>
              {isSchluss && deductions.length > 0 ? (
                <>
                  {deductions.map((d, i) => (
                    <tr key={i} className="text-muted-foreground">
                      <td className="py-1">
                        abzgl. Abschlag{d.doc_number ? ` Nr. ${d.doc_number}` : ""}
                      </td>
                      <td className="py-1 text-right">− {formatCurrency(num(d.brutto))}</td>
                    </tr>
                  ))}
                  <tr className="border-t text-base font-bold">
                    <td className="text-primary py-1.5">Restbetrag</td>
                    <td className="text-primary py-1.5 text-right">{formatCurrency(restbetrag)}</td>
                  </tr>
                </>
              ) : null}
            </tbody>
          </table>
        </div>

        {/* Zahlungshinweis mit Bankverbindung */}
        <div className="mt-8 text-sm leading-relaxed">
          <h4 className="text-primary mb-1 font-semibold">Zahlung</h4>
          <p>
            Bitte überweisen Sie den
            {isSchluss && deductions.length > 0 ? " Restbetrag" : " Rechnungsbetrag"}
            {doc.due_date ? ` bis zum ${formatDate(doc.due_date)}` : " innerhalb von 14 Tagen"} ohne Abzug
            unter Angabe der Rechnungsnummer {doc.doc_number ?? ""} auf folgendes Konto:
          </p>
          <p className="mt-1">
            {[company.bank, company.iban ? `IBAN ${company.iban}` : "", company.bic ? `BIC ${company.bic}` : ""]
              .filter(Boolean)
              .join(" · ") || "—"}
          </p>
        </div>

        <div className="mt-8 text-sm">
          <p>
            {company.city || "Weiden"}, den {datum}
          </p>
          <p className="mt-6">{company.name || "ip³ Energietechnik"}</p>
          {company.ceo ? <p className="text-muted-foreground">{company.ceo}</p> : null}
        </div>

        <DocumentFooter company={company} />
      </article>
    </div>
  );
}
