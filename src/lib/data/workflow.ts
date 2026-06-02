import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import type {
  ProjectTask,
  TaskCandidate,
  TaskMessageWithAuthor,
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

/** Kandidaten (angebotene Mitarbeiter) zu den Aufgaben eines Projekts. */
export async function getTaskCandidatesByProject(
  projectId: string,
): Promise<TaskCandidate[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("task_candidates")
    .select("task_id, employee_id, created_at, project_tasks!inner(project_id)")
    .eq("project_tasks.project_id", projectId);
  if (error) {
    console.error("getTaskCandidatesByProject:", error.message);
    return [];
  }
  return (data ?? []).map((r) => ({
    task_id: r.task_id,
    employee_id: r.employee_id,
    created_at: r.created_at,
  })) as TaskCandidate[];
}

/** Nachrichten-Thread einer Aufgabe (Chat + Ereignisse), mit Autorname. */
export async function getTaskMessages(
  taskId: string,
): Promise<TaskMessageWithAuthor[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("task_messages")
    .select("*, author:employees(name)")
    .eq("task_id", taskId)
    .order("created_at", { ascending: true });
  if (error) {
    console.error("getTaskMessages:", error.message);
    return [];
  }
  return (data ?? []) as unknown as TaskMessageWithAuthor[];
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
