import type { Metadata } from "next";

import { PageHeader } from "@/components/shared/page-header";
import { SupabaseNotice } from "@/components/shared/supabase-notice";
import { PipelineBoard } from "@/components/pipeline/pipeline-board";
import { getProjects } from "@/lib/data/projects";

export const metadata: Metadata = { title: "Pipeline" };

export default async function PipelinePage() {
  const projects = await getProjects();

  return (
    <div>
      <PageHeader
        title="Pipeline"
        description="Projekte nach Vertriebsstatus – per Drag & Drop verschieben."
      />

      <SupabaseNotice />

      <PipelineBoard projects={projects} />
    </div>
  );
}
