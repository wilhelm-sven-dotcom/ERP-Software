"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient, isServiceRoleConfigured } from "@/lib/supabase/admin";
import { getCurrentEmployee } from "@/lib/supabase/auth";
import { ensureConfigured, fail, OK, type ActionResult } from "@/lib/actions";

function s(fd: FormData, key: string): string | null {
  const v = fd.get(key);
  if (v === null) return null;
  const t = String(v).trim();
  return t === "" ? null : t;
}

/**
 * Mitarbeiter-Stammdaten/Rolle ändern.
 * Nur Admins dürfen schreiben (Defense-in-Depth zusätzlich zur RLS).
 */
export async function saveEmployee(
  _prev: ActionResult,
  fd: FormData,
): Promise<ActionResult> {
  const guard = ensureConfigured();
  if (guard) return guard;

  const me = await getCurrentEmployee();
  if (me?.role !== "admin") {
    return fail("Nur Administratoren dürfen Mitarbeiter verwalten.");
  }

  const id = s(fd, "id");
  if (!id) return fail("Mitarbeiter fehlt.");

  const roleRaw = s(fd, "role");
  const rateRaw = s(fd, "cost_rate");
  const rate = rateRaw === null ? null : Number(rateRaw.replace(",", "."));
  // Immer aktualisierbar (in beiden Formularen vorhanden).
  const payload: Record<string, unknown> = {
    role: roleRaw === "admin" ? "admin" : "mitarbeiter",
    active: fd.get("active") === "on" || fd.get("active") === "true",
    is_sales: fd.get("is_sales") === "on" || fd.get("is_sales") === "true",
    cost_rate: rate !== null && Number.isFinite(rate) ? rate : null,
  };
  // HR-Stammdaten nur setzen, wenn das Formular sie mitschickt (das schlanke
  // Inline-Formular der Liste darf Vor-/Nachname nicht versehentlich leeren).
  if (fd.has("first_name") || fd.has("last_name")) {
    const firstName = s(fd, "first_name");
    const lastName = s(fd, "last_name");
    payload.first_name = firstName;
    payload.last_name = lastName;
    payload.name = [firstName, lastName].filter(Boolean).join(" ") || s(fd, "name");
  } else if (fd.has("name")) {
    payload.name = s(fd, "name");
  }
  for (const key of ["birth_date", "start_date", "street", "zip", "city", "phone", "mobile", "position", "emergency_contact"]) {
    if (fd.has(key)) payload[key] = s(fd, key);
  }
  if (fd.has("vacation_days_per_year")) {
    const vac = Math.round(Number((s(fd, "vacation_days_per_year") ?? "30").replace(",", ".")));
    if (Number.isFinite(vac)) payload.vacation_days_per_year = vac;
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("employees")
    .update(payload)
    .eq("id", id);
  if (error) return fail(error.message);

  revalidatePath("/mitarbeiter");
  revalidatePath(`/mitarbeiter/${id}`);
  return OK;
}

const isYmd = (v: string | null) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
const numOrNull = (v: string | null) => {
  if (v === null) return null;
  const n = Number(v.replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

/** Arbeitsvertrag anlegen/ändern (nur Admin). */
export async function saveContract(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const guard = ensureConfigured();
  if (guard) return guard;
  const me = await getCurrentEmployee();
  if (me?.role !== "admin") return fail("Nur Administratoren.");
  const employeeId = s(fd, "employee_id");
  if (!employeeId) return fail("Mitarbeiter fehlt.");
  const id = s(fd, "id");
  const payload = {
    employee_id: employeeId,
    contract_type: s(fd, "contract_type") ?? "vollzeit",
    start_date: isYmd(s(fd, "start_date")),
    end_date: isYmd(s(fd, "end_date")),
    weekly_hours: numOrNull(s(fd, "weekly_hours")),
    salary_monthly: numOrNull(s(fd, "salary_monthly")),
    hourly_rate: numOrNull(s(fd, "hourly_rate")),
    vacation_days: numOrNull(s(fd, "vacation_days")),
    notes: s(fd, "notes"),
    status: s(fd, "status") ?? "aktiv",
  };
  const supabase = await createClient();
  const { error } = id
    ? await supabase.from("employee_contracts").update(payload).eq("id", id)
    : await supabase.from("employee_contracts").insert({ ...payload, created_by: me.id });
  if (error) return fail(error.message);
  revalidatePath(`/mitarbeiter/${employeeId}`);
  return OK;
}

export async function deleteContract(fd: FormData): Promise<void> {
  if (ensureConfigured()) return;
  const me = await getCurrentEmployee();
  if (me?.role !== "admin") return;
  const id = String(fd.get("id") ?? "");
  const employeeId = String(fd.get("employee_id") ?? "");
  if (!id) return;
  const supabase = await createClient();
  await supabase.from("employee_contracts").delete().eq("id", id);
  if (employeeId) revalidatePath(`/mitarbeiter/${employeeId}`);
}

/** Abwesenheit/Urlaub beantragen oder (als Admin) direkt erfassen. */
export async function saveAbsence(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const guard = ensureConfigured();
  if (guard) return guard;
  const me = await getCurrentEmployee();
  if (!me?.id) return fail("Nicht angemeldet.");
  const employeeId = s(fd, "employee_id") ?? me.id;
  // Mitarbeiter darf nur für sich beantragen.
  if (me.role !== "admin" && employeeId !== me.id) return fail("Nur eigene Anträge möglich.");
  const start = isYmd(s(fd, "start_date"));
  const end = isYmd(s(fd, "end_date"));
  if (!start || !end) return fail("Bitte Von- und Bis-Datum angeben.");
  const days = numOrNull(s(fd, "days")) ?? workdaysBetween(start, end);
  const payload = {
    employee_id: employeeId,
    absence_type: s(fd, "absence_type") ?? "urlaub",
    start_date: start,
    end_date: end,
    days,
    notes: s(fd, "notes"),
    requested_by: me.id,
    // Admin-Eintrag direkt genehmigt, sonst Antrag.
    status: me.role === "admin" ? "approved" : "pending",
    approved_by: me.role === "admin" ? me.id : null,
  };
  const supabase = await createClient();
  const { error } = await supabase.from("employee_absences").insert(payload);
  if (error) return fail(error.message);
  revalidatePath(`/mitarbeiter/${employeeId}`);
  return OK;
}

/** Urlaubsantrag genehmigen/ablehnen (nur Admin). */
export async function decideAbsence(fd: FormData): Promise<void> {
  if (ensureConfigured()) return;
  const me = await getCurrentEmployee();
  if (me?.role !== "admin") return;
  const id = String(fd.get("id") ?? "");
  const employeeId = String(fd.get("employee_id") ?? "");
  const decision = String(fd.get("decision") ?? "");
  if (!id || (decision !== "approved" && decision !== "rejected")) return;
  const supabase = await createClient();
  await supabase
    .from("employee_absences")
    .update({ status: decision, approved_by: me.id })
    .eq("id", id);
  if (employeeId) revalidatePath(`/mitarbeiter/${employeeId}`);
}

export async function deleteAbsence(fd: FormData): Promise<void> {
  if (ensureConfigured()) return;
  const id = String(fd.get("id") ?? "");
  const employeeId = String(fd.get("employee_id") ?? "");
  if (!id) return;
  const supabase = await createClient();
  await supabase.from("employee_absences").delete().eq("id", id);
  if (employeeId) revalidatePath(`/mitarbeiter/${employeeId}`);
}

/** Arbeitstage (Mo–Fr) zwischen zwei Daten inkl. Rändern. */
function workdaysBetween(start: string, end: string): number {
  const a = new Date(start);
  const b = new Date(end);
  if (b < a) return 0;
  let n = 0;
  for (const d = new Date(a); d <= b; d.setDate(d.getDate() + 1)) {
    const wd = d.getDay();
    if (wd !== 0 && wd !== 6) n++;
  }
  return n;
}

/**
 * Neuen Mitarbeiter per E-Mail einladen (nur Admin).
 * Versendet eine Supabase-Einladungsmail (Empfänger setzt eigenes Passwort)
 * und legt/aktualisiert den employees-Eintrag mit der gewünschten Rolle.
 */
export async function inviteEmployee(
  _prev: ActionResult,
  fd: FormData,
): Promise<ActionResult> {
  const guard = ensureConfigured();
  if (guard) return guard;

  const me = await getCurrentEmployee();
  if (me?.role !== "admin") {
    return fail("Nur Administratoren dürfen Mitarbeiter einladen.");
  }
  if (!isServiceRoleConfigured()) {
    return fail(
      "SUPABASE_SERVICE_ROLE_KEY ist nicht gesetzt — Einladungen sind nicht möglich.",
    );
  }

  const email = s(fd, "email")?.toLowerCase();
  const firstName = s(fd, "first_name");
  const lastName = s(fd, "last_name");
  const name = [firstName, lastName].filter(Boolean).join(" ") || s(fd, "name");
  const role = s(fd, "role") === "admin" ? "admin" : "mitarbeiter";
  if (!email) return fail("Bitte eine E-Mail-Adresse angeben.");

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.inviteUserByEmail(email);
  if (error) {
    // Häufig: Nutzer existiert bereits → trotzdem employees-Eintrag sicherstellen
    if (!/already|registered|exists/i.test(error.message)) {
      return fail(`Einladung fehlgeschlagen: ${error.message}`);
    }
  }

  const authUserId = data?.user?.id ?? null;
  const supabase = await createClient();
  // Eintrag anlegen oder (per E-Mail) aktualisieren
  const { data: existing } = await supabase
    .from("employees")
    .select("id")
    .ilike("email", email)
    .maybeSingle();

  if (existing) {
    await supabase
      .from("employees")
      .update({ name, first_name: firstName, last_name: lastName, role, auth_user_id: authUserId ?? undefined })
      .eq("id", existing.id);
  } else {
    await supabase.from("employees").insert({
      email,
      name,
      first_name: firstName,
      last_name: lastName,
      role,
      auth_user_id: authUserId,
      active: true,
    });
  }

  revalidatePath("/mitarbeiter");
  return OK;
}
