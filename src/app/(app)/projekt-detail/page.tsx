import { redirect } from "next/navigation";

import { getProjects } from "@/lib/data/projects";

/**
 * „Aktives Projekt" (Legacy-Navigationspunkt): leitet auf das zuletzt
 * bearbeitete Projekt weiter, sonst auf die Projektliste.
 */
export default async function AktivesProjektPage() {
  const projects = await getProjects();
  if (projects.length > 0) {
    redirect(`/projekte/${projects[0].id}`);
  }
  redirect("/projekte");
}
