"use client";

import * as React from "react";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveCompanySettings } from "@/app/(app)/einstellungen/actions";
import { type ActionResult } from "@/lib/actions";
import type { CompanySettings } from "@/lib/data/settings";

const initial: ActionResult = { ok: false };

export function CompanyForm({
  company,
  disabled,
}: {
  company: CompanySettings;
  disabled: boolean;
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState(
    saveCompanySettings,
    initial,
  );

  React.useEffect(() => {
    if (state.ok) {
      toast.success("Einstellungen gespeichert");
      router.refresh();
      state.ok = false;
    } else if (state.error) {
      toast.error(state.error);
    }
  }, [state, router]);

  return (
    <form action={action} className="grid max-w-2xl gap-4">
      <div className="grid gap-2">
        <Label htmlFor="name">Firmenname</Label>
        <Input id="name" name="name" defaultValue={company.name} disabled={disabled} />
      </div>
      <div className="grid gap-2 sm:grid-cols-[2fr_1fr_2fr]">
        <div className="grid gap-2">
          <Label htmlFor="street">Straße</Label>
          <Input id="street" name="street" defaultValue={company.street} disabled={disabled} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="zip">PLZ</Label>
          <Input id="zip" name="zip" defaultValue={company.zip} disabled={disabled} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="city">Ort</Label>
          <Input id="city" name="city" defaultValue={company.city} disabled={disabled} />
        </div>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="phone">Telefon</Label>
          <Input id="phone" name="phone" defaultValue={company.phone} disabled={disabled} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="email">E-Mail</Label>
          <Input id="email" name="email" type="email" defaultValue={company.email} disabled={disabled} />
        </div>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="logo_url">Logo-URL</Label>
        <Input
          id="logo_url"
          name="logo_url"
          defaultValue={company.logo_url ?? ""}
          placeholder="https://…"
          disabled={disabled}
        />
      </div>
      <div>
        <Button type="submit" disabled={disabled || pending}>
          {pending ? "Speichern …" : "Speichern"}
        </Button>
      </div>
    </form>
  );
}
