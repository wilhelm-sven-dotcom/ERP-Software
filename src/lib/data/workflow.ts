import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { PROJECT_TYPES } from "@/lib/constants";
import type {
  ProjectTask,
  ProjectTaskDep,
  TaskCandidate,
  TaskMessageWithAuthor,
  WorkflowStep,
  WorkflowStepDep,
  WorkflowTemplate,
} from "@/lib/types";

/** Wählbare Anlagentypen: Konstante ∪ selbst angelegte Projekt-Vorlagentypen. */
export async function getProjectTypeOptions(): Promise<string[]> {
  const base = [...PROJECT_TYPES];
  if (!isSupabaseConfigured()) return base;
  const supabase = await createClient();
  const { data } = await supabase
    .from("workflow_templates")
    .select("project_type")
    .eq("phase", "projekt");
  const extra = (data ?? [])
    .map((r) => r.project_type)
    .filter((x): x is string => Boolean(x));
  return Array.from(new Set([...base, ...extra]));
}

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

/** Alle Vorgänger-Beziehungen der Vorlagen-Schritte (für die Verwaltung). */
export async function getAllWorkflowStepDeps(): Promise<WorkflowStepDep[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("workflow_step_deps")
    .select("step_id, depends_on_step_id");
  if (error) {
    console.error("getAllWorkflowStepDeps:", error.message);
    return [];
  }
  return (data ?? []) as WorkflowStepDep[];
}

/** Vorgänger-Beziehungen der Aufgaben eines Projekts (über Task-IDs gefiltert). */
export async function getTaskDeps(taskIds: string[]): Promise<ProjectTaskDep[]> {
  if (!isSupabaseConfigured() || taskIds.length === 0) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("project_task_deps")
    .select("task_id, depends_on_task_id")
    .in("task_id", taskIds);
  if (error) {
    console.error("getTaskDeps:", error.message);
    return [];
  }
  return (data ?? []) as ProjectTaskDep[];
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

export interface ProjectProgress {
  total: number;
  done: number;
  overdue: number;
}

/** Aufgaben-Fortschritt je Projekt (erledigt/gesamt + überfällig), gebündelt. */
export async function getProjectsProgress(
  projectIds: string[],
): Promise<Record<string, ProjectProgress>> {
  const out: Record<string, ProjectProgress> = {};
  if (!isSupabaseConfigured() || projectIds.length === 0) return out;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("project_tasks")
    .select("project_id, status, due_date")
    .in("project_id", projectIds);
  if (error) {
    console.error("getProjectsProgress:", error.message);
    return out;
  }
  const today = new Date().toISOString().slice(0, 10);
  for (const t of data ?? []) {
    const p = (out[t.project_id] ??= { total: 0, done: 0, overdue: 0 });
    p.total += 1;
    if (t.status === "erledigt") p.done += 1;
    else if (t.due_date && t.due_date < today) p.overdue += 1;
  }
  return out;
}

export interface EmployeeTaskLoad {
  open: number;
  overdue: number;
}

/**
 * Offene/überfällige Aufgaben je Mitarbeiter — eine gebündelte Abfrage
 * für die Team-Übersicht im Admin-Dashboard.
 */
export async function getEmployeesTaskLoad(): Promise<Record<string, EmployeeTaskLoad>> {
  const out: Record<string, EmployeeTaskLoad> = {};
  if (!isSupabaseConfigured()) return out;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("project_tasks")
    .select("assignee_employee_id, status, due_date")
    .eq("status", "offen");
  if (error) {
    console.error("getEmployeesTaskLoad:", error.message);
    return out;
  }
  const today = new Date().toISOString().slice(0, 10);
  for (const t of data ?? []) {
    if (!t.assignee_employee_id) continue;
    const e = (out[t.assignee_employee_id] ??= { open: 0, overdue: 0 });
    e.open += 1;
    if (t.due_date && t.due_date < today) e.overdue += 1;
  }
  return out;
}

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
