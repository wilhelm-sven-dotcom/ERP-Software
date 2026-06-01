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
  const payload = {
    name: s(fd, "name"),
    role: roleRaw === "admin" ? "admin" : "mitarbeiter",
    active: fd.get("active") === "on" || fd.get("active") === "true",
  };

  const supabase = await createClient();
  const { error } = await supabase
    .from("employees")
    .update(payload)
    .eq("id", id);
  if (error) return fail(error.message);

  revalidatePath("/mitarbeiter");
  return OK;
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
  const name = s(fd, "name");
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
      .update({ name, role, auth_user_id: authUserId ?? undefined })
      .eq("id", existing.id);
  } else {
    await supabase.from("employees").insert({
      email,
      name,
      role,
      auth_user_id: authUserId,
      active: true,
    });
  }

  revalidatePath("/mitarbeiter");
  return OK;
}
