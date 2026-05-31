import { createBrowserClient } from "@supabase/ssr";

import { getSupabaseEnv } from "./config";

/** Browser-Client. Nur aufrufen, wenn `isSupabaseConfigured()` true ist. */
export function createClient() {
  const { url, anonKey } = getSupabaseEnv();
  return createBrowserClient(url, anonKey);
}
