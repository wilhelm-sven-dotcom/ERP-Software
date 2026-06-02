import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileOutput, Trash2 } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { SupabaseNotice } from "@/components/shared/supabase-notice";
import { Button } from "@/components/ui/button";
import { PrintButton } from "@/components/angebot/print-button";
import { OfferStatusSelect } from "@/components/angebot/offer-status-select";
import {
  DocumentFooter,
  RecipientBlock,
  salutationLine,
} from "@/components/documents/letterhead";
import { getOffer } from "@/lib/data/offers";
import { getProject } from "@/lib/data/projects";
import { getCustomer } from "@/lib/data/customers";
import { getCompanySettings } from "@/lib/data/settings";
import { getTextBlocksFor } from "@/lib/data/text-blocks";
import {
  getAllProductAssets,
  PRODUCT_ASSETS_BUCKET,
  getProducts,
  getProductGroups,
} from "@/lib/data/products";
import { OfferEditor, type OfferBlock } from "@/components/angebot/offer-editor";
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
  const [customer, defaultBlocks, assetsByProduct, products, productGroups] = await Promise.all([
    project?.customer_id ? getCustomer(project.customer_id) : Promise.resolve(null),
    getTextBlocksFor(project?.project_type ?? null),
    getAllProductAssets(),
    getProducts(),
    getProductGroups(),
  ]);

  // Bausteine: pro Angebot gespeicherte Reihenfolge (meta.blocks) bevorzugen,
  // sonst aus den Vorlagen in kanonischer Reihenfolge ableiten.
  const CANON = [
    "intro",
    "art_der_anlage",
    "leistung",
    "nicht_enthalten",
    "optionale_leistungen",
    "zahlungsbedingungen",
    "gewaehrleistung",
    "gueltigkeit",
    "liefertermin",
    "schluss",
  ];
  const savedBlocks = Array.isArray((offer.meta as Record<string, unknown>)?.blocks)
    ? ((offer.meta as Record<string, unknown>).blocks as OfferBlock[])
    : null;
  const blockList: OfferBlock[] =
    savedBlocks ??
    [...defaultBlocks]
      .sort((a, b) => CANON.indexOf(a.kind) - CANON.indexOf(b.kind))
      .map((b) => ({ kind: b.kind, title: b.title, body: b.body }));

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
  const block = (kind: string) => blockList.find((b) => b.kind === kind) ?? null;
  const leistungByTitle = new Map(
    blockList
      .filter((b) => b.kind === "leistung" && b.title)
      .map((b) => [b.title!.toLowerCase(), b.body ?? ""]),
  );
  // Textbausteine in gespeicherter Reihenfolge (ohne intro/leistung → Sondernutzung).
  const orderedTextBlocks = blockList.filter(
    (b) => b.kind !== "intro" && b.kind !== "leistung" && (b.title || b.body),
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
        <OfferEditor
          offerId={offer.id}
          initialPositions={offer.positions as CalcPosition[]}
          initialBlocks={blockList}
          products={products}
          productGroups={productGroups}
          meta={meta}
        />
      </div>

      <article className="bg-card text-foreground mx-auto max-w-3xl overflow-hidden rounded-2xl border shadow-sm print:max-w-none print:rounded-none print:border-0 print:shadow-none">
        {/* Briefkopf-Band */}
        <header className="bg-primary/5 flex items-center justify-between gap-4 px-8 py-6">
          <div className="flex items-center gap-4">
            {company.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={company.logo_url}
                alt={company.name || "Logo"}
                className="h-14 max-w-52 object-contain"
              />
            ) : null}
            <div>
              <p className="text-primary text-lg font-bold tracking-tight">
                {company.name || "ip³ Energietechnik"}
              </p>
              <p className="text-muted-foreground text-xs">
                {[company.street, [company.zip, company.city].filter(Boolean).join(" ")]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-primary text-xs font-semibold tracking-[0.2em] uppercase">
              Angebot
            </p>
            <p className="text-2xl font-bold">Nr. {offer.offer_number ?? "–"}</p>
            <p className="text-muted-foreground text-xs">{datum}</p>
            {offer.valid_until ? (
              <p className="text-muted-foreground text-xs">
                gültig bis {new Intl.DateTimeFormat("de-DE").format(new Date(offer.valid_until))}
              </p>
            ) : null}
          </div>
        </header>

        <div className="px-8 py-7">
          <RecipientBlock customer={customer} />

          {/* Projekt-Titel + Eckdaten als Pills */}
          <div className="mt-7">
            <p className="text-muted-foreground text-xs tracking-wide uppercase">
              Ihr Vorhaben
            </p>
            <h3 className="mt-1 text-xl font-semibold tracking-tight">
              {offer.title || project?.title || "Photovoltaikanlage"}
            </h3>
            {project?.system_size_kwp || project?.storage_kwh || project?.city ? (
              <div className="mt-3 flex flex-wrap gap-2 text-sm">
                {project?.system_size_kwp ? (
                  <span className="bg-primary/10 text-primary rounded-full px-3 py-1 font-medium">
                    PV {formatNumber(project.system_size_kwp)} kWp
                  </span>
                ) : null}
                {project?.storage_kwh ? (
                  <span className="bg-primary/10 text-primary rounded-full px-3 py-1 font-medium">
                    Speicher {formatNumber(project.storage_kwh)} kWh
                  </span>
                ) : null}
                {project?.city ? (
                  <span className="bg-muted text-muted-foreground rounded-full px-3 py-1">
                    Montageort {project.city}
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>

          {/* Anrede + Einleitung */}
          <p className="mt-7 text-sm">{salutationLine(customer)}</p>
          {block("intro") ? (
            <p className="text-foreground/90 mt-2 text-sm leading-relaxed whitespace-pre-wrap">
              {block("intro")!.body}
            </p>
          ) : null}

          {/* Lieferungen und Leistungen — je Gruppe eine Karte */}
          <h4 className="text-primary mt-8 mb-3 border-b pb-1 text-sm font-semibold tracking-wide uppercase">
            Lieferungen und Leistungen
          </h4>
          <div className="space-y-3">
            {grouped.map((s, i) => {
              const lb = leistungByTitle.get(s.group.toLowerCase());
              const thumbs = s.rows
                .map((r) => imageFor(r.product_id))
                .filter((u): u is string => Boolean(u));
              return (
                <div key={s.group} className="rounded-xl border p-4">
                  <div className="flex items-center gap-3">
                    <span className="bg-primary text-primary-foreground grid size-7 shrink-0 place-items-center rounded-full text-sm font-semibold">
                      {i + 1}
                    </span>
                    <p className="font-semibold">{s.group}</p>
                  </div>
                  {lb ? (
                    <p className="text-muted-foreground mt-2 text-sm whitespace-pre-wrap">{lb}</p>
                  ) : null}
                  <ul className="mt-2 space-y-1 text-sm">
                    {s.rows.map((r) => (
                      <li key={r.id} className="flex gap-2">
                        <span className="text-primary">•</span>
                        <span>
                          <span className="text-muted-foreground tabular-nums">
                            {formatNumber(r.menge)} {r.einheit}
                          </span>{" "}
                          {r.bezeichnung || "—"}
                        </span>
                      </li>
                    ))}
                  </ul>
                  {thumbs.length > 0 ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {thumbs.map((u, k) => (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          key={k}
                          src={u}
                          alt=""
                          className="h-24 w-24 rounded-lg border object-cover"
                        />
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>

          {/* Investitionsübersicht */}
          <h4 className="text-primary mt-8 mb-3 border-b pb-1 text-sm font-semibold tracking-wide uppercase">
            Investitionsübersicht
          </h4>
          <div className="overflow-hidden rounded-xl border">
            <table className="w-full text-sm">
              <thead className="bg-muted/60">
                <tr className="text-muted-foreground text-left text-xs uppercase">
                  <th className="px-3 py-2 font-medium">Position</th>
                  <th className="px-3 py-2 text-right font-medium">Menge</th>
                  <th className="px-3 py-2 text-right font-medium">Einzelpreis</th>
                  <th className="px-3 py-2 text-right font-medium">Summe netto</th>
                </tr>
              </thead>
              <tbody>
                {result.positions.map((p) => (
                  <tr key={p.id} className="border-t">
                    <td className="px-3 py-2">{p.bezeichnung || "—"}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {formatNumber(p.menge)} {p.einheit ?? ""}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {formatCurrency(p.einzelpreis)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {formatCurrency(p.positionNetto)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Summen-Karte */}
          <div className="mt-4 flex justify-end">
            <div className="border-primary/20 bg-primary/5 w-full max-w-sm rounded-xl border p-4 text-sm">
              <Row label="Zwischensumme" value={formatCurrency(t.nettoVorPauschal)} />
              {meta.pauschalRabattPercent > 0 ? (
                <Row
                  label={`Pauschalrabatt ${formatNumber(meta.pauschalRabattPercent, 1)} %`}
                  value={`– ${formatCurrency(t.nettoVorPauschal * (meta.pauschalRabattPercent / 100))}`}
                />
              ) : null}
              {meta.nachlass > 0 ? (
                <Row label="Nachlass" value={`– ${formatCurrency(meta.nachlass)}`} />
              ) : null}
              <div className="my-2 border-t" />
              <Row label="Summe netto" value={formatCurrency(t.netto)} strong />
              {(t.mwstSaetze ?? [{ rate: t.mwstSatz, betrag: t.mwstBetrag, netto: t.netto }]).map(
                (mw) => (
                  <Row
                    key={mw.rate}
                    label={`MwSt ${formatNumber(mw.rate, 0)} %`}
                    value={formatCurrency(mw.betrag)}
                  />
                ),
              )}
              <div className="text-primary mt-2 flex items-baseline justify-between border-t pt-2">
                <span className="font-semibold">Endpreis brutto</span>
                <span className="text-xl font-bold tabular-nums">{formatCurrency(t.brutto)}</span>
              </div>
              {t.skontoBetrag > 0 ? (
                <div className="mt-2 border-t pt-2">
                  <Row
                    label={`Skonto ${formatNumber(meta.skontoPercent, 1)} %`}
                    value={`– ${formatCurrency(t.skontoBetrag)}`}
                  />
                  <Row label="Brutto nach Skonto" value={formatCurrency(t.bruttoNachSkonto)} strong />
                </div>
              ) : null}
              {t.spezifischPvProKwp !== null || t.spezifischSpeicherProKwh !== null ? (
                <p className="text-muted-foreground mt-2 text-right text-[11px]">
                  {t.spezifischPvProKwp !== null
                    ? `${formatCurrency(t.spezifischPvProKwp)} / kWp`
                    : ""}
                  {t.spezifischSpeicherProKwh !== null
                    ? `  ·  ${formatCurrency(t.spezifischSpeicherProKwh)} / kWh`
                    : ""}
                </p>
              ) : null}
            </div>
          </div>

          {/* Textbausteine in gespeicherter (per Drag & Drop änderbarer) Reihenfolge */}
          {orderedTextBlocks.map((b, i) =>
            b.kind === "schluss" && !b.title ? (
              <p key={i} className="mt-7 text-sm leading-relaxed whitespace-pre-wrap">
                {b.body}
              </p>
            ) : (
              <Section key={i} title={b.title || b.kind}>
                <p className="whitespace-pre-wrap">{b.body}</p>
              </Section>
            ),
          )}

          {/* Unterschrift */}
          <div className="mt-10 text-sm">
            <p className="text-muted-foreground">
              {company.city || "Weiden"}, den{" "}
              {new Intl.DateTimeFormat("de-DE").format(new Date(offer.created_at))}
            </p>
            <div className="mt-10 w-56 border-t pt-1 text-xs">
              <p className="font-medium">{company.name || "ip³ Energietechnik"}</p>
              {company.ceo ? <p className="text-muted-foreground">{company.ceo}</p> : null}
            </div>
          </div>

          <DocumentFooter company={company} />
        </div>
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
    <div className="mt-7 text-sm leading-relaxed">
      <h4 className="text-primary mb-2 border-b pb-1 text-sm font-semibold tracking-wide uppercase">
        {title}
      </h4>
      <div className="text-foreground/90">{children}</div>
    </div>
  );
}

function Row({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between py-0.5">
      <span className={strong ? "font-semibold" : "text-muted-foreground"}>{label}</span>
      <span className={strong ? "font-semibold tabular-nums" : "tabular-nums"}>{value}</span>
    </div>
  );
}
