import { cache } from "react";

import { isSupabaseConfigured } from "./config";
import { createClient } from "./server";
import type { CurrentUser, Role } from "@/lib/types";

/**
 * Aktuellen Auth-User EINMAL pro Request laden (React.cache dedupliziert
 * identische Aufrufe innerhalb derselben Server-Anfrage → spart Roundtrips).
 */
const getUser = cache(async () => {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

/** E-Mail des aktuell angemeldeten Nutzers (oder null). */
export async function getCurrentUserEmail(): Promise<string | null> {
  const user = await getUser();
  return user?.email ?? null;
}

/**
 * Aktueller Mitarbeiter inkl. Rolle (verknüpft Auth-User → employees).
 * Ebenfalls pro Request gecacht.
 */
export const getCurrentEmployee = cache(
  async (): Promise<CurrentUser | null> => {
    const user = await getUser();
    if (!user) return null;

    const supabase = await createClient();
    const { data } = await supabase
      .from("employees")
      .select("id, name, email, role, is_sales")
      .eq("auth_user_id", user.id)
      .maybeSingle();

    if (!data) {
      return {
        id: "",
        name: null,
        email: user.email ?? "",
        role: "mitarbeiter",
        is_sales: false,
      };
    }
    return {
      id: data.id,
      name: data.name,
      email: data.email ?? user.email ?? "",
      role: (data.role as Role) ?? "mitarbeiter",
      is_sales: Boolean(data.is_sales),
    };
  },
);

export function isAdmin(user: CurrentUser | null): boolean {
  return user?.role === "admin";
}
