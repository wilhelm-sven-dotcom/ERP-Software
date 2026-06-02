import { NextResponse } from "next/server";

import { getCurrentEmployee } from "@/lib/supabase/auth";
import { buildAuthUrl, isGoogleConfigured } from "@/lib/google/calendar";

/** Startet den Google-OAuth-Flow (read-only Kalender) für den aktuellen Mitarbeiter. */
export async function GET(request: Request) {
  const origin = new URL(request.url).origin;
  if (!isGoogleConfigured()) {
    return NextResponse.redirect(`${origin}/einstellungen?google=not_configured`);
  }
  const me = await getCurrentEmployee();
  if (!me?.id) {
    return NextResponse.redirect(`${origin}/login`);
  }
  return NextResponse.redirect(buildAuthUrl(origin, me.id));
}
