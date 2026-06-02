import type { Metadata } from "next";

import { PageHeader } from "@/components/shared/page-header";
import { SupabaseNotice } from "@/components/shared/supabase-notice";
import { EmptyState } from "@/components/shared/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { WorkflowStepManager } from "@/components/workflow/workflow-step-manager";
import {
  getWorkflowTemplates,
  getAllWorkflowSteps,
} from "@/lib/data/workflow";
import { getCurrentEmployee } from "@/lib/supabase/auth";

export const metadata: Metadata = { title: "Ablauf-Vorlagen" };

export default async function WorkflowPage() {
  const [templates, steps, me] = await Promise.all([
    getWorkflowTemplates(),
    getAllWorkflowSteps(),
    getCurrentEmployee(),
  ]);

  if (me?.role !== "admin") {
    return (
      <div>
        <PageHeader title="Ablauf-Vorlagen" description="Projektablauf je Anlagentyp." />
        <EmptyState
          title="Nur für Administratoren"
          description="Die Ablauf-Vorlagen können nur von Administratoren bearbeitet werden."
        />
      </div>
    );
  }

  const stepsByTemplate = new Map<string, typeof steps>();
  for (const s of steps) {
    (stepsByTemplate.get(s.template_id) ?? stepsByTemplate.set(s.template_id, []).get(s.template_id)!).push(s);
  }

  return (
    <div>
      <PageHeader
        title="Ablauf-Vorlagen"
        description="Schritte je Anlagentyp — werden beim Start des Projektablaufs zu Aufgaben."
      />
      <SupabaseNotice />

      {templates.length === 0 ? (
        <EmptyState
          title="Keine Vorlagen"
          description="Führe die Migration 20260531121600 aus, um Standard-Vorlagen anzulegen."
        />
      ) : (
        <div className="space-y-4">
          {templates.map((tmpl) => (
            <Card key={tmpl.id}>
              <CardHeader>
                <CardTitle className="text-base">
                  {tmpl.project_type ?? "Allgemein"}
                  <span className="text-muted-foreground ml-2 text-sm font-normal">
                    {tmpl.name}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <WorkflowStepManager
                  templateId={tmpl.id}
                  steps={stepsByTemplate.get(tmpl.id) ?? []}
                />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
