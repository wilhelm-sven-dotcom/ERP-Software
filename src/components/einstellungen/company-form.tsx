"use client";

import * as React from "react";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { ImageIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveCompanySettings } from "@/app/(app)/einstellungen/actions";
import { createClient } from "@/lib/supabase/client";
import { type ActionResult } from "@/lib/actions";
import type { CompanySettings } from "@/lib/data/settings";

const initial: ActionResult = { ok: false };
const BUCKET = "product-assets";

export function CompanyForm({
  company,
  disabled,
}: {
  company: CompanySettings;
  disabled: boolean;
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState(saveCompanySettings, initial);
  const [logoUrl, setLogoUrl] = React.useState(company.logo_url ?? "");
  const [uploading, setUploading] = React.useState(false);

  React.useEffect(() => {
    if (state.ok) {
      toast.success("Einstellungen gespeichert");
      router.refresh();
      state.ok = false;
    } else if (state.error) {
      toast.error(state.error);
    }
  }, [state, router]);

  async function uploadLogo(file: File) {
    setUploading(true);
    try {
      const supabase = createClient();
      const ext = file.name.split(".").pop() ?? "png";
      const path = `branding/logo-${Date.now()}.${ext}`;
      const { error } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, { upsert: true });
      if (error) {
        toast.error(`Upload fehlgeschlagen: ${error.message}`);
        return;
      }
      const url = supabase.storage.from(BUCKET).getPublicUrl(path).data
        .publicUrl;
      setLogoUrl(url);
      toast.success("Logo hochgeladen — zum Übernehmen speichern.");
    } finally {
      setUploading(false);
    }
  }

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
      <div className="grid gap-2 sm:grid-cols-3">
        <div className="grid gap-2">
          <Label htmlFor="phone">Telefon</Label>
          <Input id="phone" name="phone" defaultValue={company.phone} disabled={disabled} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="fax">Fax</Label>
          <Input id="fax" name="fax" defaultValue={company.fax} disabled={disabled} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="email">E-Mail</Label>
          <Input id="email" name="email" type="email" defaultValue={company.email} disabled={disabled} />
        </div>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="website">Website</Label>
          <Input id="website" name="website" defaultValue={company.website} disabled={disabled} placeholder="www.…" />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="ceo">Geschäftsführung</Label>
          <Input id="ceo" name="ceo" defaultValue={company.ceo} disabled={disabled} placeholder="Vor- und Nachname" />
        </div>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="register">Registereintrag</Label>
          <Input id="register" name="register" defaultValue={company.register} disabled={disabled} placeholder="Amtsgericht … HRB …" />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="bank">Bankverbindung</Label>
          <Input id="bank" name="bank" defaultValue={company.bank} disabled={disabled} placeholder="IBAN / Bank" />
        </div>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="logo_url">Logo</Label>
        <div className="flex items-center gap-3">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoUrl}
              alt="Logo"
              className="h-12 max-w-40 rounded border bg-white object-contain p-1"
            />
          ) : (
            <div className="bg-muted flex h-12 w-40 items-center justify-center rounded border text-xs text-muted-foreground">
              kein Logo
            </div>
          )}
          {!disabled ? (
            <label>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                disabled={uploading}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void uploadLogo(f);
                  e.target.value = "";
                }}
              />
              <Button type="button" variant="outline" size="sm" asChild disabled={uploading}>
                <span>
                  <ImageIcon className="size-4" /> Logo hochladen
                </span>
              </Button>
            </label>
          ) : null}
        </div>
        <Input
          id="logo_url"
          name="logo_url"
          value={logoUrl}
          onChange={(e) => setLogoUrl(e.target.value)}
          placeholder="https://… (oder per Upload setzen)"
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
