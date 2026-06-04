import { NextResponse } from "next/server";

import { getCurrentEmployee } from "@/lib/supabase/auth";
import {
  exchangeCode,
  isGoogleConfigured,
  saveIntegration,
} from "@/lib/google/calendar";

/** OAuth-Callback: Code gegen Tokens tauschen und Integration speichern. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = url.origin;
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  if (!isGoogleConfigured()) {
    return NextResponse.redirect(`${origin}/einstellungen?google=not_configured`);
  }

  const me = await getCurrentEmployee();
  // state trägt die employee_id des Starts; gegen den aktuellen Login prüfen.
  if (!code || !me?.id || (state && state !== me.id)) {
    return NextResponse.redirect(`${origin}/einstellungen?google=error`);
  }

  const tokens = await exchangeCode(code, origin);
  if (tokens.error || !tokens.refresh_token) {
    return NextResponse.redirect(`${origin}/einstellungen?google=error`);
  }
  await saveIntegration(me.id, tokens);
  return NextResponse.redirect(`${origin}/einstellungen?google=connected`);
}
