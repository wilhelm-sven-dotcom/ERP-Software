import "server-only";

import { createAdminClient, isServiceRoleConfigured } from "@/lib/supabase/admin";

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SCOPE = "https://www.googleapis.com/auth/calendar.readonly";

export function isGoogleConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID &&
      process.env.GOOGLE_CLIENT_SECRET &&
      isServiceRoleConfigured(),
  );
}

export function redirectUri(origin: string): string {
  return process.env.GOOGLE_OAUTH_REDIRECT || `${origin}/api/google/oauth/callback`;
}

/** Consent-URL für den OAuth-Start. */
export function buildAuthUrl(origin: string, state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID ?? "",
    redirect_uri: redirectUri(origin),
    response_type: "code",
    scope: SCOPE,
    access_type: "offline",
    prompt: "consent",
    state,
  });
  return `${AUTH_URL}?${params.toString()}`;
}

interface TokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  error?: string;
}

/** Authorization-Code gegen Tokens tauschen. */
export async function exchangeCode(
  code: string,
  origin: string,
): Promise<TokenResponse> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      redirect_uri: redirectUri(origin),
      grant_type: "authorization_code",
    }),
  });
  return (await res.json()) as TokenResponse;
}

/** Integration eines Mitarbeiters speichern (Service-Role, umgeht RLS). */
export async function saveIntegration(
  employeeId: string,
  tokens: TokenResponse,
): Promise<void> {
  const admin = createAdminClient();
  const expiry = tokens.expires_in
    ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
    : null;
  // refresh_token nur überschreiben, wenn Google ein neues liefert.
  const payload: Record<string, unknown> = {
    employee_id: employeeId,
    provider: "google",
    access_token: tokens.access_token ?? null,
    token_expiry: expiry,
    connected_at: new Date().toISOString(),
  };
  if (tokens.refresh_token) payload.refresh_token = tokens.refresh_token;
  await admin
    .from("user_integrations")
    .upsert(payload, { onConflict: "employee_id,provider" });
}

export async function disconnect(employeeId: string): Promise<void> {
  const admin = createAdminClient();
  await admin
    .from("user_integrations")
    .delete()
    .eq("employee_id", employeeId)
    .eq("provider", "google");
}

export async function getIntegration(employeeId: string): Promise<{
  connected: boolean;
  connected_at: string | null;
}> {
  if (!isServiceRoleConfigured() || !employeeId)
    return { connected: false, connected_at: null };
  const admin = createAdminClient();
  const { data } = await admin
    .from("user_integrations")
    .select("connected_at, refresh_token")
    .eq("employee_id", employeeId)
    .eq("provider", "google")
    .maybeSingle();
  return {
    connected: Boolean(data?.refresh_token),
    connected_at: data?.connected_at ?? null,
  };
}

/** Gültiges Access-Token sicherstellen (ggf. per refresh_token erneuern). */
async function ensureAccessToken(employeeId: string): Promise<string | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("user_integrations")
    .select("access_token, refresh_token, token_expiry")
    .eq("employee_id", employeeId)
    .eq("provider", "google")
    .maybeSingle();
  if (!data?.refresh_token) return null;

  const stillValid =
    data.access_token &&
    data.token_expiry &&
    new Date(data.token_expiry).getTime() - 60_000 > Date.now();
  if (stillValid) return data.access_token as string;

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      refresh_token: data.refresh_token as string,
      grant_type: "refresh_token",
    }),
  });
  const json = (await res.json()) as TokenResponse;
  if (!json.access_token) return null;
  await admin
    .from("user_integrations")
    .update({
      access_token: json.access_token,
      token_expiry: json.expires_in
        ? new Date(Date.now() + json.expires_in * 1000).toISOString()
        : null,
    })
    .eq("employee_id", employeeId)
    .eq("provider", "google");
  return json.access_token;
}

export interface CalendarEvent {
  id: string;
  summary: string;
  start: string | null;
  allDay: boolean;
}

/** Termine eines Mitarbeiters in einem Zeitraum (read-only, z. B. für die Plantafel). */
export async function listEventsByRange(
  employeeId: string,
  fromISODate: string,
  toISODate: string,
  max = 100,
): Promise<CalendarEvent[]> {
  if (!isGoogleConfigured() || !employeeId) return [];
  const token = await ensureAccessToken(employeeId);
  if (!token) return [];

  const timeMin = new Date(`${fromISODate}T00:00:00`).toISOString();
  const timeMax = new Date(`${toISODate}T23:59:59`).toISOString();
  const params = new URLSearchParams({
    timeMin,
    timeMax,
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: String(max),
  });
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params.toString()}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!res.ok) return [];
  const json = (await res.json()) as {
    items?: {
      id: string;
      summary?: string;
      start?: { dateTime?: string; date?: string };
    }[];
  };
  return (json.items ?? []).map((e) => ({
    id: e.id,
    summary: e.summary ?? "(ohne Titel)",
    start: e.start?.dateTime ?? e.start?.date ?? null,
    allDay: Boolean(e.start?.date && !e.start?.dateTime),
  }));
}

/** Kommende Termine des Mitarbeiters (read-only). */
export async function listUpcomingEvents(
  employeeId: string,
  days = 14,
  max = 10,
): Promise<CalendarEvent[]> {
  if (!isGoogleConfigured() || !employeeId) return [];
  const token = await ensureAccessToken(employeeId);
  if (!token) return [];

  const timeMin = new Date().toISOString();
  const timeMax = new Date(Date.now() + days * 86400_000).toISOString();
  const params = new URLSearchParams({
    timeMin,
    timeMax,
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: String(max),
  });
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params.toString()}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!res.ok) return [];
  const json = (await res.json()) as {
    items?: {
      id: string;
      summary?: string;
      start?: { dateTime?: string; date?: string };
    }[];
  };
  return (json.items ?? []).map((e) => ({
    id: e.id,
    summary: e.summary ?? "(ohne Titel)",
    start: e.start?.dateTime ?? e.start?.date ?? null,
    allDay: Boolean(e.start?.date && !e.start?.dateTime),
  }));
}
