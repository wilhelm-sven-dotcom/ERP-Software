import type { Metadata } from "next";

import { PageHeader } from "@/components/shared/page-header";
import { SupabaseNotice } from "@/components/shared/supabase-notice";
import { PipelineBoard } from "@/components/pipeline/pipeline-board";
import { LeadPriorisierung } from "@/components/pipeline/lead-priorisierung";
import { LeadIntakeDialog } from "@/components/vertrieb/lead-intake-dialog";
import { getProjects } from "@/lib/data/projects";
import { getSalesEmployees } from "@/lib/data/employees";
import { getProjectsProgress } from "@/lib/data/workflow";

export const metadata: Metadata = { title: "Vertrieb" };

export default async function PipelinePage() {
  const [projects, salesEmployees] = await Promise.all([
    getProjects(),
    getSalesEmployees(),
  ]);
  const progress = await getProjectsProgress(projects.map((p) => p.id));

  return (
    <div>
      <PageHeader
        title="Vertrieb"
        description="Leads & Anfragen im Funnel — per Drag & Drop weiterziehen, „Gewonnen“ macht daraus ein Projekt."
        helpId="pipeline"
      >
        <LeadIntakeDialog salesEmployees={salesEmployees} />
      </PageHeader>

      <SupabaseNotice />

      <LeadPriorisierung />

      <PipelineBoard projects={projects} progress={progress} />
    </div>
  );
}
