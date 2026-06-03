import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { SupabaseNotice } from "@/components/shared/supabase-notice";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { WirtschaftRechner } from "@/components/wirtschaft/wirtschaft-rechner";
import { getProject } from "@/lib/data/projects";
import { getCalculationByProject } from "@/lib/data/calculations";
import { getWirtschaftDefaults } from "@/lib/data/settings";
import { customerName } from "@/lib/format";

export const metadata: Metadata = { title: "Wirtschaftlichkeit" };

export default async function WirtschaftDetailPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const project = await getProject(projectId);
  if (!project) notFound();

  const [calc, params2] = await Promise.all([
    getCalculationByProject(projectId),
    getWirtschaftDefaults(),
  ]);

  const kwp = project.system_size_kwp ?? 0;
  const speicherKwh =
    typeof (project.details as Record<string, unknown>)?.speicherKwh === "number"
      ? ((project.details as Record<string, number>).speicherKwh ?? 0)
      : 0;
  const investBrutto =
    typeof (calc?.totals as Record<string, unknown>)?.brutto === "number"
      ? ((calc!.totals as Record<string, number>).brutto ?? 0)
      : 0;

  return (
    <div>
      <div className="mb-2">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/wirtschaft">
            <ArrowLeft className="size-4" /> Zur Übersicht
          </Link>
        </Button>
      </div>

      <PageHeader
        title={`Wirtschaftlichkeit: ${project.title ?? "Projekt"}`}
        description={project.customer ? customerName(project.customer) : undefined}
      />

      <SupabaseNotice />

      {kwp <= 0 ? (
        <EmptyState
          title="Keine Anlagengröße hinterlegt"
          description="Trage im Projekt die Anlagengröße (kWp) ein, um die Wirtschaftlichkeit zu berechnen."
        >
          <Button asChild>
            <Link href={`/projekte/${projectId}`}>Zum Projekt</Link>
          </Button>
        </EmptyState>
      ) : (
        <>
          {investBrutto <= 0 ? (
            <div className="mb-4 rounded-md border border-[var(--warning)]/40 bg-[var(--warning)]/10 p-3 text-sm">
              Noch keine Kalkulation vorhanden – die Investition wird mit 0 €
              angesetzt. Lege zuerst eine{" "}
              <Link className="underline" href={`/kalkulation/${projectId}`}>
                Kalkulation
              </Link>{" "}
              an.
            </div>
          ) : null}
          <WirtschaftRechner
            kwp={kwp}
            speicherKwh={speicherKwh}
            investBrutto={investBrutto}
            defaults={params2}
          />
        </>
      )}
    </div>
  );
}
