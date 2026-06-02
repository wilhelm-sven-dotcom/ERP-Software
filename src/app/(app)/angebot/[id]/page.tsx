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
import { OfferStatusSelect } from "@/components/angebot/offer-status-select";
import {
  DocumentHeader,
  DocumentFooter,
  RecipientBlock,
  salutationLine,
} from "@/components/documents/letterhead";
import { getOffer } from "@/lib/data/offers";
import { getProject } from "@/lib/data/projects";
import { getCustomer } from "@/lib/data/customers";
import { getCompanySettings } from "@/lib/data/settings";
import { getTextBlocksFor } from "@/lib/data/text-blocks";
import { getAllProductAssets, PRODUCT_ASSETS_BUCKET } from "@/lib/data/products";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { deleteOffer } from "@/app/(app)/angebot/actions";
import { createOrderConfirmation } from "@/app/(app)/dokumente/actions";
import { calculate } from "@/lib/calc/engine";
import { POSITION_GROUPS } from "@/lib/calc/types";
import { formatCurrency, formatNumber } from "@/lib/format";
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
  const [customer, blocks, assetsByProduct] = await Promise.all([
    project?.customer_id ? getCustomer(project.customer_id) : Promise.resolve(null),
    getTextBlocksFor(project?.project_type ?? null),
    getAllProductAssets(),
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
  const result = calculate({
    positions: offer.positions as CalcPosition[],
    pauschalRabattPercent: meta.pauschalRabattPercent,
    nachlass: meta.nachlass,
    mwstPercent: meta.mwstPerGroup?.["Sonstiges"] ?? 19,
    mwstPerGroup: meta.mwstPerGroup,
    skontoPercent: meta.skontoPercent,
  });
  const t = result.totals;

  // Bausteine nach Art gruppieren; Leistungsbausteine per Titel (Gruppe/Kategorie).
  const block = (kind: string) => blocks.find((b) => b.kind === kind) ?? null;
  const leistungByTitle = new Map(
    blocks
      .filter((b) => b.kind === "leistung" && b.title)
      .map((b) => [b.title!.toLowerCase(), b.body ?? ""]),
  );

  // Produktbilder je Position (öffentliche URL).
  const supabase = isSupabaseConfigured() ? await createClient() : null;
  const imageFor = (productId: string | undefined | null): string | null => {
    if (!productId || !supabase) return null;
    const img = (assetsByProduct[productId] ?? []).find((a) => a.kind === "image");
    if (!img?.storage_path) return null;
    return supabase.storage.from(PRODUCT_ASSETS_BUCKET).getPublicUrl(img.storage_path)
      .data.publicUrl;
  };

  // Positionen je Leistungsgruppe (für „Lieferungen und Leistungen").
  const grouped = POSITION_GROUPS.map((g) => ({
    group: g,
    rows: result.positions.filter((p) => (p.group ?? "Sonstiges") === g),
  })).filter((s) => s.rows.length > 0);

  const datum = new Intl.DateTimeFormat("de-DE", { dateStyle: "long" }).format(
    new Date(offer.created_at),
  );

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
          {offer.status === "Angenommen" ? (
            <form action={createOrderConfirmation}>
              <input type="hidden" name="offer_id" value={offer.id} />
              <Button type="submit" variant="outline">
                <FileOutput className="size-4" /> Auftragsbestätigung
              </Button>
            </form>
          ) : null}
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
        <DocumentHeader
          company={company}
          rightTitle={`Angebot Nr. ${offer.offer_number ?? "–"}`}
          rightLines={[
            datum,
            ...(offer.valid_until
              ? [
                  `gültig bis ${new Intl.DateTimeFormat("de-DE").format(
                    new Date(offer.valid_until),
                  )}`,
                ]
              : []),
          ]}
        />

        <RecipientBlock customer={customer} />

        <div className="mt-6">
          <h3 className="text-primary font-semibold">
            {offer.title || project?.title || "Photovoltaikanlage"}
          </h3>
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

        {/* Anrede + Einleitung */}
        <p className="mt-6 text-sm">{salutationLine(customer)}</p>
        {block("intro") ? (
          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">
            {block("intro")!.body}
          </p>
        ) : null}

        {block("art_der_anlage") ? (
          <Section title={block("art_der_anlage")!.title || "Art der Anlage"}>
            <p className="whitespace-pre-wrap">{block("art_der_anlage")!.body}</p>
          </Section>
        ) : null}

        {/* Lieferungen und Leistungen, nummeriert je Gruppe */}
        <Section title="Lieferungen und Leistungen">
          <ol className="space-y-4">
            {grouped.map((s, i) => {
              const lb = leistungByTitle.get(s.group.toLowerCase());
              const thumbs = s.rows
                .map((r) => imageFor(r.product_id))
                .filter((u): u is string => Boolean(u));
              return (
                <li key={s.group}>
                  <p className="font-medium">
                    {i + 1}. {s.group}
                  </p>
                  {lb ? (
                    <p className="text-muted-foreground mt-1 whitespace-pre-wrap">
                      {lb}
                    </p>
                  ) : null}
                  <ul className="mt-1 list-inside list-disc">
                    {s.rows.map((r) => (
                      <li key={r.id}>
                        {formatNumber(r.menge)} {r.einheit} · {r.bezeichnung || "—"}
                      </li>
                    ))}
                  </ul>
                  {thumbs.length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {thumbs.map((u, k) => (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          key={k}
                          src={u}
                          alt=""
                          className="h-16 w-16 rounded border object-cover"
                        />
                      ))}
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ol>
        </Section>

        {block("nicht_enthalten") ? (
          <Section title={block("nicht_enthalten")!.title || "Explizit nicht enthalten"}>
            <p className="whitespace-pre-wrap">{block("nicht_enthalten")!.body}</p>
          </Section>
        ) : null}

        {/* Preisübersicht */}
        <div className="mt-8">
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
              <tr>
                <td className="py-1">Zwischensumme</td>
                <td className="py-1 text-right">{formatCurrency(t.nettoVorPauschal)}</td>
              </tr>
              {meta.pauschalRabattPercent > 0 ? (
                <tr>
                  <td className="py-1">
                    Pauschalrabatt {formatNumber(meta.pauschalRabattPercent, 1)} %
                  </td>
                  <td className="py-1 text-right">
                    – {formatCurrency(t.nettoVorPauschal * (meta.pauschalRabattPercent / 100))}
                  </td>
                </tr>
              ) : null}
              {meta.nachlass > 0 ? (
                <tr>
                  <td className="py-1">Nachlass</td>
                  <td className="py-1 text-right">– {formatCurrency(meta.nachlass)}</td>
                </tr>
              ) : null}
              <tr className="border-t font-semibold">
                <td className="py-1">Summe netto</td>
                <td className="py-1 text-right">{formatCurrency(t.netto)}</td>
              </tr>
              {(
                t.mwstSaetze ?? [{ rate: t.mwstSatz, betrag: t.mwstBetrag, netto: t.netto }]
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
                <td className="text-primary py-1.5 text-right">{formatCurrency(t.brutto)}</td>
              </tr>
              {t.skontoBetrag > 0 ? (
                <>
                  <tr>
                    <td className="py-1">Skonto {formatNumber(meta.skontoPercent, 1)} %</td>
                    <td className="py-1 text-right">– {formatCurrency(t.skontoBetrag)}</td>
                  </tr>
                  <tr className="font-semibold">
                    <td className="py-1">Brutto nach Skonto</td>
                    <td className="py-1 text-right">{formatCurrency(t.bruttoNachSkonto)}</td>
                  </tr>
                </>
              ) : null}
            </tbody>
          </table>
        </div>

        {/* Spezifische Preise */}
        {t.spezifischPvProKwp !== null || t.spezifischSpeicherProKwh !== null ? (
          <p className="text-muted-foreground mt-3 text-right text-xs">
            {t.spezifischPvProKwp !== null
              ? `Spez. Preis PV: ${formatCurrency(t.spezifischPvProKwp)} / kWp`
              : ""}
            {t.spezifischSpeicherProKwh !== null
              ? `  ·  Speicher: ${formatCurrency(t.spezifischSpeicherProKwh)} / kWh`
              : ""}
          </p>
        ) : null}

        {block("optionale_leistungen") ? (
          <Section title={block("optionale_leistungen")!.title || "Optionale Leistungen"}>
            <p className="whitespace-pre-wrap">{block("optionale_leistungen")!.body}</p>
          </Section>
        ) : null}

        {/* Bedingungen */}
        {(["zahlungsbedingungen", "gewaehrleistung", "gueltigkeit", "liefertermin"] as const).map(
          (k) =>
            block(k) ? (
              <Section key={k} title={block(k)!.title || k}>
                <p className="whitespace-pre-wrap">{block(k)!.body}</p>
              </Section>
            ) : null,
        )}

        {block("schluss") ? (
          <p className="mt-6 whitespace-pre-wrap text-sm leading-relaxed">
            {block("schluss")!.body}
          </p>
        ) : null}

        {/* Unterschrift */}
        <div className="mt-10 text-sm">
          <p>
            {company.city || "Weiden"}, den{" "}
            {new Intl.DateTimeFormat("de-DE").format(new Date(offer.created_at))}
          </p>
          <p className="mt-8">{company.name || "ip³ Energietechnik"}</p>
          {company.ceo ? <p className="text-muted-foreground">{company.ceo}</p> : null}
        </div>

        <DocumentFooter company={company} />
      </article>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-6 text-sm leading-relaxed">
      <h4 className="text-primary mb-1 font-semibold">{title}</h4>
      {children}
    </div>
  );
}
