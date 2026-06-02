import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import type { Activity, Customer, Project } from "@/lib/types";

export type ProjectWithCustomer = Project & {
  customer: Pick<
    Customer,
    "id" | "first_name" | "last_name" | "company"
  > | null;
};

const SELECT = "*, customer:customers(id, first_name, last_name, company)";

export async function getProjects(): Promise<ProjectWithCustomer[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("projects")
    .select(SELECT)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("getProjects:", error.message);
    return [];
  }
  return (data ?? []) as unknown as ProjectWithCustomer[];
}

export async function getProject(
  id: string,
): Promise<ProjectWithCustomer | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("projects")
    .select(SELECT)
    .eq("id", id)
    .maybeSingle();
  if (error) {
    console.error("getProject:", error.message);
    return null;
  }
  return (data as unknown as ProjectWithCustomer) ?? null;
}

export async function getProjectsByCustomer(
  customerId: string,
): Promise<Project[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("getProjectsByCustomer:", error.message);
    return [];
  }
  return (data ?? []) as Project[];
}

export async function getProjectActivities(
  projectId: string,
): Promise<Activity[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("activities")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("getProjectActivities:", error.message);
    return [];
  }
  return (data ?? []) as Activity[];
}
