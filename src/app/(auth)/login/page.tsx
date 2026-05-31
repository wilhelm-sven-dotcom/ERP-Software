import type { Metadata } from "next";

import { BrandLogo } from "@/components/brand-logo";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Anmelden",
};

export default function LoginPage() {
  const configured = isSupabaseConfigured();

  return (
    <div className="flex min-h-svh items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center text-center">
          <BrandLogo className="justify-center" />
          <CardTitle className="pt-2">Anmelden</CardTitle>
          <CardDescription>
            Bitte mit deinem Konto anmelden.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!configured ? (
            <div className="rounded-md border border-[var(--warning)]/40 bg-[var(--warning)]/10 p-3 text-sm">
              <strong className="text-foreground">
                Supabase nicht konfiguriert.
              </strong>{" "}
              Lege <code>.env.local</code> mit{" "}
              <code>NEXT_PUBLIC_SUPABASE_URL</code> und{" "}
              <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> an, um die Anmeldung zu
              aktivieren.
            </div>
          ) : null}
          <LoginForm disabled={!configured} />
        </CardContent>
      </Card>
    </div>
  );
}
