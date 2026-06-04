"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { getCurrentEmployee } from "@/lib/supabase/auth";
import { logActivity } from "@/lib/data/activities";
import { instantiateWorkflowForProject } from "@/app/(app)/workflow/actions";
import { ensureConfigured, fail, OK, type ActionResult } from "@/lib/actions";

function s(fd: FormData, key: string): string | null {
  const v = fd.get(key);
  if (v === null) return null;
  const t = String(v).trim();
  return t === "" ? null : t;
}

/**
 * Anfrage-Schnellerfassung (Lead-Intake): legt Kunde + Projekt (Status
 * „Anfrage") an, startet den Vertriebsablauf und weist/bietet die erste
 * Aufgabe den gewählten Vertriebs-Mitarbeitern an (Claim bei mehreren).
 */
export async function createLead(
  _prev: ActionResult,
  fd: FormData,
): Promise<ActionResult> {
  const guard = ensureConfigured();
  if (guard) return guard;

  const kindRaw = s(fd, "kind");
  const customer = {
    kind: kindRaw === "gewerbe" ? "gewerbe" : "privat",
    company: s(fd, "company"),
    salutation: s(fd, "salutation"),
    first_name: s(fd, "first_name"),
    last_name: s(fd, "last_name"),
    email: s(fd, "email"),
    phone: s(fd, "phone"),
    mobile: s(fd, "mobile"),
    street: s(fd, "street"),
    zip: s(fd, "zip"),
    city: s(fd, "city"),
    notes: s(fd, "notes"),
  };
  if (!customer.last_name && !customer.company) {
    return fail("Bitte mindestens Nachname oder Firma angeben.");
  }

  const source = s(fd, "source");
  const salesIds = String(fd.get("employee_ids") ?? "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);

  const supabase = await createClient();
  const me = await getCurrentEmployee();

  // 1. Kunde anlegen (fortlaufende Kundennummer).
  const { data: maxRow } = await supabase
    .from("customers")
    .select("customer_nr")
    .order("customer_nr", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();
  const nextNr = (maxRow?.customer_nr ?? 1000) + 1;
  const { data: cust, error: custErr } = await supabase
    .from("customers")
    .insert({ ...customer, customer_nr: nextNr })
    .select("id")
    .single();
  if (custErr || !cust) return fail(custErr?.message ?? "Kunde konnte nicht angelegt werden.");

  // 2. Projekt (Anfrage) anlegen.
  const displayName =
    customer.company ||
    [customer.first_name, customer.last_name].filter(Boolean).join(" ") ||
    "Neue Anfrage";
  const { data: proj, error: projErr } = await supabase
    .from("projects")
    .insert({
      customer_id: cust.id,
      title: `Anfrage ${displayName}`,
      status: "Anfrage",
      source,
      assigned_employee_id: salesIds.length === 1 ? salesIds[0] : null,
      street: customer.street,
      zip: customer.zip,
      city: customer.city,
      notes: customer.notes,
      created_by: me?.id ?? null,
    })
    .select("id")
    .single();
  if (projErr || !proj) return fail(projErr?.message ?? "Anfrage konnte nicht angelegt werden.");

  // 3. Vertriebsablauf starten.
  const { rootTaskIds, count } = await instantiateWorkflowForProject(proj.id, "vertrieb");

  // 4. Erste(n) Vertriebsschritt(e) mehreren anbieten (Claim) — bei genau einem
  //    Vertriebler ist die Aufgabe bereits über das Projekt zugewiesen.
  if (salesIds.length > 1 && rootTaskIds.length > 0) {
    for (const taskId of rootTaskIds) {
      await supabase
        .from("project_tasks")
        .update({ status: "angeboten", assignee_employee_id: null })
        .eq("id", taskId);
      await supabase
        .from("task_candidates")
        .insert(salesIds.map((employee_id) => ({ task_id: taskId, employee_id })));
      await supabase.from("task_messages").insert({
        task_id: taskId,
        author_employee_id: me?.id ?? null,
        body: `Anfrage an ${salesIds.length} Vertriebler angeboten`,
        kind: "event",
      });
    }
  }

  await logActivity({
    customerId: cust.id,
    projectId: proj.id,
    type: "vertrieb",
    title: `Anfrage erfasst${source ? ` (Quelle: ${source})` : ""}`,
  });

  revalidatePath("/pipeline");
  revalidatePath("/projekte");
  revalidatePath("/kunden");
  revalidatePath("/dashboard");
  revalidatePath(`/projekte/${proj.id}`);
  return { ...OK, warning: count === 0 ? "Hinweis: keine Vertriebsvorlage gefunden — bitte unter Ablauf-Vorlagen anlegen." : undefined };
}
