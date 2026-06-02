import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import type {
  ProjectTask,
  WorkflowStep,
  WorkflowTemplate,
} from "@/lib/types";

export async function getWorkflowTemplates(): Promise<WorkflowTemplate[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("workflow_templates")
    .select("*")
    .order("project_type", { ascending: true, nullsFirst: true });
  if (error) {
    console.error("getWorkflowTemplates:", error.message);
    return [];
  }
  return (data ?? []) as WorkflowTemplate[];
}

export async function getWorkflowSteps(
  templateId: string,
): Promise<WorkflowStep[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("workflow_steps")
    .select("*")
    .eq("template_id", templateId)
    .order("sort", { ascending: true });
  if (error) {
    console.error("getWorkflowSteps:", error.message);
    return [];
  }
  return (data ?? []) as WorkflowStep[];
}

/** Alle Schritte (für die Verwaltung, gruppiert nach Vorlage im UI). */
export async function getAllWorkflowSteps(): Promise<WorkflowStep[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("workflow_steps")
    .select("*")
    .order("sort", { ascending: true });
  if (error) {
    console.error("getAllWorkflowSteps:", error.message);
    return [];
  }
  return (data ?? []) as WorkflowStep[];
}

export async function getProjectTasks(
  projectId: string,
): Promise<ProjectTask[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("project_tasks")
    .select("*")
    .eq("project_id", projectId)
    .order("sort", { ascending: true });
  if (error) {
    console.error("getProjectTasks:", error.message);
    return [];
  }
  return (data ?? []) as ProjectTask[];
}

export type TaskWithProject = ProjectTask & {
  project: { id: string; title: string | null } | null;
};

/** Offene Aufgaben des aktuellen Mitarbeiters (für das Dashboard). */
export async function getMyOpenTasks(
  employeeId: string,
): Promise<TaskWithProject[]> {
  if (!isSupabaseConfigured() || !employeeId) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("project_tasks")
    .select("*, project:projects(id, title)")
    .eq("assignee_employee_id", employeeId)
    .eq("status", "offen")
    .order("due_date", { ascending: true, nullsFirst: false });
  if (error) {
    console.error("getMyOpenTasks:", error.message);
    return [];
  }
  return (data ?? []) as unknown as TaskWithProject[];
}
