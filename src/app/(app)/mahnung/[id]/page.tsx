import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Trash2 } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { SupabaseNotice } from "@/components/shared/supabase-notice";
import { Button } from "@/components/ui/button";
import { PrintButton } from "@/components/angebot/print-button";
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
import { formatCurrency, formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Mahnung" };

const num = (v: unknown, d = 0) => (typeof v === "number" ? v : d);

export default async function MahnungDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const doc = await getDocument(id);
  if (!doc || doc.kind !== "mahnung") notFound();

  const [project, company] = await Promise.all([
    getProject(doc.project_id),
    getCompanySettings(),
  ]);
  const customer = project?.customer_id ? await getCustomer(project.customer_id) : null;

  const m = doc.meta as Record<string, unknown>;
  const level = num(m.level, 1);
  const fee = num(m.fee);
  const invoiceNumber = m.invoice_number ? String(m.invoice_number) : "–";
  const invoiceBrutto = num(m.invoice_brutto);
  const invoiceDue = m.invoice_due ? String(m.invoice_due) : null;
  const totalDue = num((doc.totals as { brutto?: number }).brutto, invoiceBrutto + fee);
  const datum = formatDate(doc.created_at);

  const intro =
    level <= 1
      ? "bei der Durchsicht unserer Unterlagen ist uns aufgefallen, dass die folgende Rechnung noch nicht ausgeglichen wurde. Sicher ist Ihnen dies entgangen — wir bitten Sie um Begleichung."
      : level === 2
        ? "trotz unserer Zahlungserinnerung konnten wir bisher keinen Zahlungseingang für die folgende Rechnung feststellen. Wir bitten Sie, den offenen Betrag umgehend zu begleichen."
        : "leider haben Sie auf unsere bisherigen Schreiben nicht reagiert. Wir fordern Sie letztmalig auf, den offenen Betrag zu begleichen, andernfalls behalten wir uns weitere Schritte vor.";

  return (
    <div>
      <div className="flex items-center justify-between gap-2 print:hidden">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/offene-posten">
            <ArrowLeft className="size-4" /> Zu den offenen Posten
          </Link>
        </Button>
        <div className="flex items-center gap-2">
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
        <PageHeader title={`${doc.title ?? "Mahnung"} Nr. ${doc.doc_number ?? "–"}`} description={project?.title ?? undefined} />
        <SupabaseNotice />
      </div>

      <article className="bg-card mx-auto max-w-3xl rounded-xl border p-8 print:border-0 print:p-0 print:shadow-none">
        <DocumentHeader
          company={company}
          rightTitle={doc.title ?? "Mahnung"}
          rightLines={[`Datum: ${datum}`]}
        />
        <RecipientBlock customer={customer} />

        <p className="mt-6 text-sm font-semibold">
          {doc.title ?? "Mahnung"} zu Rechnung Nr. {invoiceNumber}
        </p>
        <p className="mt-2 text-sm">{salutationLine(customer)}</p>
        <p className="mt-2 text-sm leading-relaxed">{intro}</p>

        <div className="mt-6 flex justify-end">
          <table className="min-w-[340px] text-sm">
            <tbody>
              <tr>
                <td className="py-1">Rechnung Nr. {invoiceNumber}</td>
                <td className="py-1 text-right">{formatCurrency(invoiceBrutto)}</td>
              </tr>
              {invoiceDue ? (
                <tr className="text-muted-foreground">
                  <td className="py-1">fällig seit</td>
                  <td className="py-1 text-right">{formatDate(invoiceDue)}</td>
                </tr>
              ) : null}
              {fee > 0 ? (
                <tr>
                  <td className="py-1">Mahngebühr</td>
                  <td className="py-1 text-right">{formatCurrency(fee)}</td>
                </tr>
              ) : null}
              <tr className="border-t text-base font-bold">
                <td className="text-primary py-1.5">Offener Betrag</td>
                <td className="text-primary py-1.5 text-right">{formatCurrency(totalDue)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="mt-8 text-sm leading-relaxed">
          <p>
            Bitte überweisen Sie den offenen Betrag unter Angabe der Rechnungsnummer{" "}
            {invoiceNumber} auf folgendes Konto:
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
        </div>

        <DocumentFooter company={company} />
      </article>
    </div>
  );
}
