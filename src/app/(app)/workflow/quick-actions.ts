"use server";

import { getCurrentEmployee } from "@/lib/supabase/auth";
import { getEmployees } from "@/lib/data/employees";
import { getProjects } from "@/lib/data/projects";

/** Daten für die Schnellaufgabe im Header (Kollegen ohne mich + Projekte). */
export async function getQuickTaskData(): Promise<{
  employees: { id: string; name: string }[];
  projects: { id: string; title: string }[];
}> {
  const [me, employees, projects] = await Promise.all([
    getCurrentEmployee(),
    getEmployees(),
    getProjects(),
  ]);
  return {
    employees: employees
      .filter((e) => e.active && e.id !== me?.id)
      .map((e) => ({ id: e.id, name: e.name ?? e.email ?? "Mitarbeiter" })),
    projects: projects.map((p) => ({ id: p.id, title: p.title ?? "Ohne Titel" })),
  };
}
