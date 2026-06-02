import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { SupabaseNotice } from "@/components/shared/supabase-notice";
import { Button } from "@/components/ui/button";
import { CalcEditor } from "@/components/kalkulation/calc-editor";
import { VariantBar } from "@/components/kalkulation/variant-bar";
import { getProject } from "@/lib/data/projects";
import { getProducts, getProductGroups } from "@/lib/data/products";
import { getCalcTemplates } from "@/lib/data/templates";
import {
  getCalculationsByProject,
  readMeta,
  readPositions,
} from "@/lib/data/calculations";
import { customerName } from "@/lib/format";
import type { Calculation } from "@/lib/types";

export const metadata: Metadata = { title: "Kalkulation" };

export default async function KalkulationEditorPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ calc?: string }>;
}) {
  const { projectId } = await params;
  const { calc: calcParam } = await searchParams;
  const project = await getProject(projectId);
  if (!project) notFound();

  const [variants, products, productGroups, templates] = await Promise.all([
    getCalculationsByProject(projectId),
    getProducts(),
    getProductGroups(),
    getCalcTemplates(),
  ]);

  // Aktive Variante: aus ?calc, sonst die ausgewählte, sonst die neueste.
  const active: Calculation | null =
    variants.find((v) => v.id === calcParam) ??
    variants.find((v) => v.is_selected) ??
    variants[variants.length - 1] ??
    null;

  const meta = readMeta(active);
  const positions = readPositions(active);

  return (
    <div>
      <div className="mb-2">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/kalkulation">
            <ArrowLeft className="size-4" /> Zur Übersicht
          </Link>
        </Button>
      </div>

      <PageHeader
        title={`Kalkulation: ${project.title ?? "Projekt"}`}
        description={project.customer ? customerName(project.customer) : undefined}
      />

      <SupabaseNotice />

      {variants.length > 0 ? (
        <div className="mb-4">
          <VariantBar
            projectId={projectId}
            variants={variants}
            activeId={active?.id ?? null}
          />
        </div>
      ) : null}

      <CalcEditor
        key={active?.id ?? "neu"}
        projectId={projectId}
        calcId={active?.id ?? null}
        calcName={active?.name ?? "Standard"}
        initialPositions={positions}
        initialPauschalRabatt={meta.pauschalRabattPercent}
        initialNachlass={meta.nachlass}
        initialMwst={meta.mwstPercent}
        initialSkonto={meta.skontoPercent}
        systemSizeKwp={project.system_size_kwp}
        storageKwh={project.storage_kwh}
        products={products}
        productGroups={productGroups}
        templates={templates}
      />
    </div>
  );
}
