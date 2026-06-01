import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { SupabaseNotice } from "@/components/shared/supabase-notice";
import { Button } from "@/components/ui/button";
import { CalcEditor } from "@/components/kalkulation/calc-editor";
import { getProject } from "@/lib/data/projects";
import { getProducts } from "@/lib/data/products";
import { getCalcTemplates } from "@/lib/data/templates";
import {
  getCalculationByProject,
  readMeta,
  readPositions,
} from "@/lib/data/calculations";
import { customerName } from "@/lib/format";

export const metadata: Metadata = { title: "Kalkulation" };

export default async function KalkulationEditorPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const project = await getProject(projectId);
  if (!project) notFound();

  const [calc, products, templates] = await Promise.all([
    getCalculationByProject(projectId),
    getProducts(),
    getCalcTemplates(),
  ]);
  const meta = readMeta(calc);
  const positions = readPositions(calc);

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

      <CalcEditor
        projectId={projectId}
        calcId={calc?.id ?? null}
        initialPositions={positions}
        initialPauschalRabatt={meta.pauschalRabattPercent}
        initialNachlass={meta.nachlass}
        initialMwst={meta.mwstPercent}
        initialSkonto={meta.skontoPercent}
        products={products}
        templates={templates}
      />
    </div>
  );
}
