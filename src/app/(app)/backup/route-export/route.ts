import { NextResponse } from "next/server";

import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { getCurrentEmployee } from "@/lib/supabase/auth";

/** Vollständiger JSON-Export aller Tabellen (nur Admin). */
const TABLES = [
  "customers",
  "projects",
  "activities",
  "products",
  "product_groups",
  "product_assets",
  "employees",
  "offer_templates",
  "calc_templates",
  "calculations",
  "settings",
] as const;

export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Supabase nicht konfiguriert" },
      { status: 503 },
    );
  }

  const me = await getCurrentEmployee();
  if (me?.role !== "admin") {
    return NextResponse.json(
      { error: "Nur Administratoren dürfen Backups exportieren." },
      { status: 403 },
    );
  }

  const supabase = await createClient();
  const stores: Record<string, unknown[]> = {};
  for (const table of TABLES) {
    const { data, error } = await supabase.from(table).select("*");
    if (error) {
      return NextResponse.json(
        { error: `${table}: ${error.message}` },
        { status: 500 },
      );
    }
    stores[table] = data ?? [];
  }

  const backup = {
    app: "ip3-pv-tool",
    version: 1,
    exported_at: new Date().toISOString(),
    stores,
  };

  const date = new Date().toISOString().slice(0, 10);
  return new NextResponse(JSON.stringify(backup, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="ip3-backup-${date}.json"`,
    },
  });
}
