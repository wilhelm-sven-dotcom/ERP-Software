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
import { OfferStatusSelect } from "@/components/angebot/offer-status-select";
import { getOffer } from "@/lib/data/offers";
import { getProject } from "@/lib/data/projects";
import { getCompanySettings } from "@/lib/data/settings";
import { deleteOffer } from "@/app/(app)/angebot/actions";
import { calculate } from "@/lib/calc/engine";
import { customerName, formatCurrency, formatNumber } from "@/lib/format";
import type { CalcPosition } from "@/lib/calc/types";

export const metadata: Metadata = { title: "Angebot" };

export default async function AngebotPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const offer = await getOffer(id);
  if (!offer) notFound();

  const [project, company] = await Promise.all([
    getProject(offer.project_id),
    getCompanySettings(),
  ]);

  const m = offer.meta as Record<string, unknown>;
  const num = (v: unknown, d = 0) => (typeof v === "number" ? v : d);
  const meta = {
    pauschalRabattPercent: num(m.pauschalRabattPercent),
    nachlass: num(m.nachlass),
    skontoPercent: num(m.skontoPercent),
    mwstPerGroup:
      m.mwstPerGroup && typeof m.mwstPerGroup === "object"
        ? (m.mwstPerGroup as Record<string, number>)
        : undefined,
  };
  // Eingefrorene Positionen/Meta neu auswerten (deterministisch, bleibt fix).
  const result = calculate({
    positions: offer.positions as CalcPosition[],
    pauschalRabattPercent: meta.pauschalRabattPercent,
    nachlass: meta.nachlass,
    mwstPercent: meta.mwstPerGroup?.["Sonstiges"] ?? 19,
    mwstPerGroup: meta.mwstPerGroup,
    skontoPercent: meta.skontoPercent,
  });
  const t = result.totals;

  const datum = new Intl.DateTimeFormat("de-DE", { dateStyle: "long" }).format(
    new Date(offer.created_at),
  );
  const customer = project?.customer;
  const customerAddr = customer ? customerName(customer) : "—";

  return (
    <div>
      <div className="flex items-center justify-between gap-2 print:hidden">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/angebot">
            <ArrowLeft className="size-4" /> Zur Übersicht
          </Link>
        </Button>
        <div className="flex items-center gap-2">
          <OfferStatusSelect offerId={offer.id} status={offer.status} />
          <PrintButton />
          <form action={deleteOffer}>
            <input type="hidden" name="id" value={offer.id} />
            <input type="hidden" name="project_id" value={offer.project_id} />
            <Button variant="ghost" size="icon" type="submit" title="Angebot löschen">
              <Trash2 className="size-4" />
            </Button>
          </form>
        </div>
      </div>

      <div className="print:hidden">
        <PageHeader
          title={`Angebot Nr. ${offer.offer_number ?? "–"}`}
          description={project?.title ?? undefined}
        />
        <SupabaseNotice />
      </div>

      <article className="bg-card mx-auto max-w-3xl rounded-lg border p-8 print:border-0 print:p-0 print:shadow-none">
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
            <p className="font-semibold">Angebot Nr. {offer.offer_number ?? "–"}</p>
            <p className="text-muted-foreground">{datum}</p>
            {offer.valid_until ? (
              <p className="text-muted-foreground">
                gültig bis{" "}
                {new Intl.DateTimeFormat("de-DE").format(new Date(offer.valid_until))}
              </p>
            ) : null}
          </div>
        </header>

        <div className="mt-8">
          <p className="text-muted-foreground text-xs">Angebot für</p>
          <p className="font-medium">{customerAddr}</p>
        </div>

        <div className="mt-6">
          <h3 className="text-primary font-semibold">{project?.title}</h3>
          {project?.system_size_kwp || project?.storage_kwh ? (
            <p className="text-muted-foreground text-sm">
              {project?.system_size_kwp
                ? `PV-Anlage ${formatNumber(project.system_size_kwp)} kWp`
                : ""}
              {project?.storage_kwh
                ? ` · Speicher ${formatNumber(project.storage_kwh)} kWh`
                : ""}
              {project?.city ? ` · Montageort: ${project.city}` : ""}
            </p>
          ) : null}
        </div>

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
                      t.nettoVorPauschal * (meta.pauschalRabattPercent / 100),
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
              {(
                t.mwstSaetze ?? [
                  { rate: t.mwstSatz, betrag: t.mwstBetrag, netto: t.netto },
                ]
              ).map((mw) => (
                <tr key={mw.rate}>
                  <td className="py-1">
                    MwSt {formatNumber(mw.rate, 0)} % (auf {formatCurrency(mw.netto)})
                  </td>
                  <td className="py-1 text-right">{formatCurrency(mw.betrag)}</td>
                </tr>
              ))}
              <tr className="border-t text-base font-bold">
                <td className="text-primary py-1.5">Endpreis brutto</td>
                <td className="text-primary py-1.5 text-right">
                  {formatCurrency(t.brutto)}
                </td>
              </tr>
              {t.skontoBetrag > 0 ? (
                <>
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
    </div>
  );
}
