import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

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
import { PrintButton } from "@/components/angebot/print-button";
import { getProject } from "@/lib/data/projects";
import { getCompanySettings } from "@/lib/data/settings";
import {
  getCalculationByProject,
  readMeta,
  readPositions,
} from "@/lib/data/calculations";
import { calculate } from "@/lib/calc/engine";
import { customerName, formatCurrency, formatNumber } from "@/lib/format";

export const metadata: Metadata = { title: "Angebot" };

export default async function AngebotDokumentPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const project = await getProject(projectId);
  if (!project) notFound();

  const [calc, company] = await Promise.all([
    getCalculationByProject(projectId),
    getCompanySettings(),
  ]);

  const positions = readPositions(calc);
  const meta = readMeta(calc);
  const result = calculate({
    positions,
    pauschalRabattPercent: meta.pauschalRabattPercent,
    nachlass: meta.nachlass,
    mwstPercent: meta.mwstPercent,
    skontoPercent: meta.skontoPercent,
  });
  const t = result.totals;

  const heute = new Intl.DateTimeFormat("de-DE", { dateStyle: "long" }).format(
    new Date(),
  );
  const customer = project.customer;
  const customerAddr = customer ? customerName(customer) : "—";

  return (
    <div>
      <div className="flex items-center justify-between gap-2 print:hidden">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/angebot">
            <ArrowLeft className="size-4" /> Zur Übersicht
          </Link>
        </Button>
        <PrintButton />
      </div>

      <div className="print:hidden">
        <PageHeader title={`Angebot: ${project.title ?? "Projekt"}`} />
        <SupabaseNotice />
      </div>

      {positions.length === 0 ? (
        <EmptyState
          title="Keine Kalkulation vorhanden"
          description="Erstelle zuerst eine Kalkulation für dieses Projekt."
        >
          <Button asChild>
            <Link href={`/kalkulation/${projectId}`}>Zur Kalkulation</Link>
          </Button>
        </EmptyState>
      ) : (
        <article className="bg-card mx-auto max-w-3xl rounded-lg border p-8 print:border-0 print:p-0 print:shadow-none">
          {/* Kopf: Firma + Angebotsmeta */}
          <header className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-primary text-xl font-bold">
                {company.name || "ip³ Energietechnik"}
              </h2>
              <p className="text-muted-foreground text-sm">
                {[company.street, [company.zip, company.city].filter(Boolean).join(" ")]
                  .filter(Boolean)
                  .join(", ")}
              </p>
              <p className="text-muted-foreground text-sm">
                {[company.phone, company.email].filter(Boolean).join(" · ")}
              </p>
            </div>
            <div className="text-right text-sm">
              <p className="font-semibold">Angebot</p>
              <p className="text-muted-foreground">{heute}</p>
            </div>
          </header>

          {/* Empfänger */}
          <div className="mt-8">
            <p className="text-muted-foreground text-xs">Angebot für</p>
            <p className="font-medium">{customerAddr}</p>
            {customer?.company && (customer.first_name || customer.last_name) ? (
              <p className="text-sm">
                {[customer.first_name, customer.last_name].filter(Boolean).join(" ")}
              </p>
            ) : null}
          </div>

          {/* Projektbezug */}
          <div className="mt-6">
            <h3 className="text-primary font-semibold">{project.title}</h3>
            {project.system_size_kwp ? (
              <p className="text-muted-foreground text-sm">
                PV-Anlage {formatNumber(project.system_size_kwp)} kWp
                {project.city ? ` · Montageort: ${project.city}` : ""}
              </p>
            ) : null}
          </div>

          {/* Positionsübersicht */}
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
                    <TableCell className="text-right">
                      {formatNumber(p.menge)}
                    </TableCell>
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

          {/* Kaufmännische Zusammenfassung */}
          <div className="mt-6 flex justify-end">
            <table className="min-w-[320px] text-sm">
              <tbody>
                <tr>
                  <td className="py-1">Zwischensumme</td>
                  <td className="py-1 text-right">
                    {formatCurrency(t.nettoVorPauschal)}
                  </td>
                </tr>
                {meta.pauschalRabattPercent > 0 ? (
                  <tr>
                    <td className="py-1">
                      Pauschalrabatt {formatNumber(meta.pauschalRabattPercent, 1)} %
                    </td>
                    <td className="py-1 text-right">
                      –{" "}
                      {formatCurrency(
                        t.nettoVorPauschal *
                          (meta.pauschalRabattPercent / 100),
                      )}
                    </td>
                  </tr>
                ) : null}
                {meta.nachlass > 0 ? (
                  <tr>
                    <td className="py-1">Nachlass</td>
                    <td className="py-1 text-right">
                      – {formatCurrency(meta.nachlass)}
                    </td>
                  </tr>
                ) : null}
                <tr className="border-t font-semibold">
                  <td className="py-1">Summe netto</td>
                  <td className="py-1 text-right">{formatCurrency(t.netto)}</td>
                </tr>
                <tr>
                  <td className="py-1">MwSt {formatNumber(t.mwstSatz, 0)} %</td>
                  <td className="py-1 text-right">
                    {formatCurrency(t.mwstBetrag)}
                  </td>
                </tr>
                <tr className="border-t text-base font-bold">
                  <td className="text-primary py-1.5">Endpreis brutto</td>
                  <td className="text-primary py-1.5 text-right">
                    {formatCurrency(t.brutto)}
                  </td>
                </tr>
                {t.skontoBetrag > 0 ? (
                  <>
                    <tr>
                      <td className="pt-3" colSpan={2}>
                        <em className="text-muted-foreground text-xs">
                          Bei Zahlung innerhalb von 14 Tagen:
                        </em>
                      </td>
                    </tr>
                    <tr>
                      <td className="py-1">
                        Skonto {formatNumber(meta.skontoPercent, 1)} %
                      </td>
                      <td className="py-1 text-right">
                        – {formatCurrency(t.skontoBetrag)}
                      </td>
                    </tr>
                    <tr className="font-semibold">
                      <td className="py-1">Brutto nach Skonto</td>
                      <td className="py-1 text-right">
                        {formatCurrency(t.bruttoNachSkonto)}
                      </td>
                    </tr>
                  </>
                ) : null}
              </tbody>
            </table>
          </div>

          <footer className="text-muted-foreground mt-10 border-t pt-4 text-xs">
            Dieses Angebot ist freibleibend. Es gelten unsere allgemeinen
            Geschäftsbedingungen.
          </footer>
        </article>
      )}
    </div>
  );
}
