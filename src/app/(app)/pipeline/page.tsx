import type { Metadata } from "next";

import { PageHeader } from "@/components/shared/page-header";
import { SupabaseNotice } from "@/components/shared/supabase-notice";
import { PipelineBoard } from "@/components/pipeline/pipeline-board";
import { LeadIntakeDialog } from "@/components/vertrieb/lead-intake-dialog";
import { getProjects } from "@/lib/data/projects";
import { getSalesEmployees } from "@/lib/data/employees";

export const metadata: Metadata = { title: "Pipeline" };

export default async function PipelinePage() {
  const [projects, salesEmployees] = await Promise.all([
    getProjects(),
    getSalesEmployees(),
  ]);

  return (
    <div>
      <PageHeader
        title="Pipeline"
        description="Projekte nach Vertriebsstatus – per Drag & Drop verschieben."
      >
        <LeadIntakeDialog salesEmployees={salesEmployees} />
      </PageHeader>

      <SupabaseNotice />

      <PipelineBoard projects={projects} />
    </div>
  );
}
