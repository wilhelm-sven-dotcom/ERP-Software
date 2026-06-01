import "server-only";

import { createClient } from "@supabase/supabase-js";

import { getSupabaseEnv } from "./config";

/**
 * Admin-Client mit Service-Role-Key — umgeht RLS und kann Auth-User verwalten.
 * NUR serverseitig verwenden (server-only erzwingt das). Erfordert
 * SUPABASE_SERVICE_ROLE_KEY in der Umgebung.
 */
export function createAdminClient() {
  const { url } = getSupabaseEnv();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY fehlt — für Mitarbeiter-Einladungen nötig.",
    );
  }
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export function isServiceRoleConfigured(): boolean {
  return Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
}
