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
} from "@/components/documents/letterhead";
import { getDocument } from "@/lib/data/documents";
import { getProject } from "@/lib/data/projects";
import { getCustomer } from "@/lib/data/customers";
import { getCompanySettings } from "@/lib/data/settings";
import { getProducts } from "@/lib/data/products";
import { getAllProductWholesalers, getWholesalers } from "@/lib/data/wholesalers";
import { deleteDocument } from "@/app/(app)/dokumente/actions";
import { formatNumber } from "@/lib/format";
import type { CalcPosition } from "@/lib/calc/types";

export const metadata: Metadata = { title: "Lieferschein" };

export default async function LieferscheinDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const doc = await getDocument(id);
  if (!doc || doc.kind !== "lieferschein") notFound();

  const [project, company, products, plwMap, wholesalers] = await Promise.all([
    getProject(doc.project_id),
    getCompanySettings(),
    getProducts(),
    getAllProductWholesalers(),
    getWholesalers(),
  ]);
  const customer = project?.customer_id ? await getCustomer(project.customer_id) : null;

  const positions = doc.positions as CalcPosition[];
  const productById = new Map(products.map((p) => [p.id, p]));
  const wholesalerName = new Map(wholesalers.map((w) => [w.id, w.name]));
  const datum = new Intl.DateTimeFormat("de-DE", { dateStyle: "long" }).format(
    new Date(doc.created_at),
  );

  // Bestellliste je Großhändler aggregieren (für die Beschaffung).
  type OrderLine = {
    order_number: string | null;
    name: string;
    sku: string | null;
    menge: number;
  };
  const byWholesaler = new Map<string, OrderLine[]>();
  const NONE = "— ohne Großhändler —";
  for (const pos of positions) {
    if (!pos.product_id) {
      (byWholesaler.get(NONE) ?? byWholesaler.set(NONE, []).get(NONE)!).push({
        order_number: null,
        name: pos.bezeichnung || "—",
        sku: null,
        menge: Number(pos.menge) || 0,
      });
      continue;
    }
    const prod = productById.get(pos.product_id);
    const links = plwMap[pos.product_id] ?? [];
    if (links.length === 0) {
      const key = NONE;
      (byWholesaler.get(key) ?? byWholesaler.set(key, []).get(key)!).push({
        order_number: prod?.sku ?? null,
        name: pos.bezeichnung || prod?.name || "—",
        sku: prod?.sku ?? null,
        menge: Number(pos.menge) || 0,
      });
      continue;
    }
    // Bevorzugt den ersten verknüpften Großhändler.
    const link = links[0];
    const key = wholesalerName.get(link.wholesaler_id) ?? "Großhändler";
    (byWholesaler.get(key) ?? byWholesaler.set(key, []).get(key)!).push({
      order_number: link.order_number,
      name: pos.bezeichnung || prod?.name || "—",
      sku: prod?.sku ?? null,
      menge: Number(pos.menge) || 0,
    });
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-2 print:hidden">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/lieferschein">
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
        <PageHeader
          title={`Lieferschein Nr. ${doc.doc_number ?? "–"}`}
          description={project?.title ?? undefined}
        />
        <SupabaseNotice />
      </div>

      <article className="bg-card mx-auto max-w-3xl rounded-lg border p-8 print:border-0 print:p-0 print:shadow-none">
        <DocumentHeader
          company={company}
          rightTitle={`Lieferschein Nr. ${doc.doc_number ?? "–"}`}
          rightLines={[datum, ...(doc.commission ? [`Kommission: ${doc.commission}`] : [])]}
        />
        <RecipientBlock customer={customer} />

        <div className="mt-6">
          <h3 className="text-primary font-semibold">
            {project?.title || "Lieferung"}
          </h3>
          {project?.street || project?.city ? (
            <p className="text-muted-foreground text-sm">
              Lieferadresse: {[project?.street, project?.zip, project?.city].filter(Boolean).join(", ")}
            </p>
          ) : null}
        </div>

        {/* Artikelliste ohne Preise */}
        <div className="mt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-32">Artikelnr.</TableHead>
                <TableHead>Bezeichnung</TableHead>
                <TableHead className="text-right">Menge</TableHead>
                <TableHead>Einheit</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {positions.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="text-muted-foreground">
                    {(p.product_id && productById.get(p.product_id)?.sku) || "—"}
                  </TableCell>
                  <TableCell>{p.bezeichnung || "—"}</TableCell>
                  <TableCell className="text-right">{formatNumber(p.menge)}</TableCell>
                  <TableCell>{p.einheit ?? ""}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="mt-10 grid grid-cols-2 gap-8 text-sm">
          <div>
            <p className="border-t pt-1">Datum, Unterschrift Lieferant</p>
          </div>
          <div>
            <p className="border-t pt-1">Datum, Unterschrift Empfänger</p>
          </div>
        </div>

        <DocumentFooter company={company} />
      </article>

      {/* Bestellliste je Großhändler (eigene Seite beim Druck) */}
      <article className="bg-card mx-auto mt-6 max-w-3xl rounded-lg border p-8 print:mt-0 print:border-0 print:p-0 print:shadow-none print:break-before-page">
        <h2 className="text-primary text-lg font-bold">
          Bestell-/Lagerliste — Lieferschein Nr. {doc.doc_number ?? "–"}
        </h2>
        <p className="text-muted-foreground mb-4 text-sm">
          Benötigtes Material je Großhändler (mit Bestellnummern).
        </p>
        {[...byWholesaler.entries()].map(([name, lines]) => (
          <div key={name} className="mb-6">
            <h3 className="mb-1 font-semibold">{name}</h3>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-36">Bestellnr.</TableHead>
                  <TableHead>Artikel</TableHead>
                  <TableHead className="text-right">Menge</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lines.map((l, i) => (
                  <TableRow key={i}>
                    <TableCell className="text-muted-foreground">
                      {l.order_number ?? l.sku ?? "—"}
                    </TableCell>
                    <TableCell>{l.name}</TableCell>
                    <TableCell className="text-right">{formatNumber(l.menge)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ))}
      </article>
    </div>
  );
}
