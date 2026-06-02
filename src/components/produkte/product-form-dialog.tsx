"use client";

import * as React from "react";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { saveProduct } from "@/app/(app)/produkte/actions";
import { type ActionResult } from "@/lib/actions";
import { AssetUpload } from "@/components/produkte/asset-upload";
import type { Product, ProductAsset, ProductGroup } from "@/lib/types";

const initial: ActionResult = { ok: false };

export function ProductFormDialog({
  product,
  groups,
  assets = [],
  trigger,
}: {
  product?: Product;
  groups: ProductGroup[];
  assets?: ProductAsset[];
  trigger: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [state, action, pending] = useActionState(saveProduct, initial);
  const isEdit = Boolean(product);

  React.useEffect(() => {
    if (state.ok && open) {
      toast.success(isEdit ? "Produkt aktualisiert" : "Produkt angelegt");
      setOpen(false);
      router.refresh();
      state.ok = false;
    } else if (state.error) {
      toast.error(state.error);
    }
  }, [state, open, isEdit, router]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Produkt bearbeiten" : "Neues Produkt"}
          </DialogTitle>
          <DialogDescription>
            Produktdaten für Katalog und Kalkulation.
          </DialogDescription>
        </DialogHeader>

        <form action={action} className="grid gap-4">
          {product ? <input type="hidden" name="id" value={product.id} /> : null}

          <div className="grid gap-2">
            <Label htmlFor="name">Name *</Label>
            <Input
              id="name"
              name="name"
              defaultValue={product?.name ?? ""}
              required
            />
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="group_id">Gruppe</Label>
              <Select
                name="group_id"
                defaultValue={product?.group_id ?? undefined}
              >
                <SelectTrigger id="group_id" className="w-full">
                  <SelectValue placeholder="Keine Gruppe" />
                </SelectTrigger>
                <SelectContent>
                  {groups.map((g) => (
                    <SelectItem key={g.id} value={g.id}>
                      {g.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="manufacturer">Hersteller</Label>
              <Input
                id="manufacturer"
                name="manufacturer"
                defaultValue={product?.manufacturer ?? ""}
              />
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-3">
            <div className="grid gap-2">
              <Label htmlFor="category">Kategorie</Label>
              <Input
                id="category"
                name="category"
                defaultValue={product?.category ?? ""}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="sku">Artikelnr.</Label>
              <Input id="sku" name="sku" defaultValue={product?.sku ?? ""} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="unit">Einheit</Label>
              <Input
                id="unit"
                name="unit"
                defaultValue={product?.unit ?? ""}
                placeholder="Stk"
              />
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="price_purchase">EK-Preis (€)</Label>
              <Input
                id="price_purchase"
                name="price_purchase"
                type="number"
                step="0.01"
                defaultValue={product?.price_purchase ?? ""}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="price_sell">VK-Preis (€)</Label>
              <Input
                id="price_sell"
                name="price_sell"
                type="number"
                step="0.01"
                defaultValue={product?.price_sell ?? ""}
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="split_pv_pct">Hybrid – Anteil PV (%)</Label>
            <Input
              id="split_pv_pct"
              name="split_pv_pct"
              type="number"
              step="1"
              min={0}
              max={100}
              defaultValue={
                typeof product?.specs?.split_pv_pct === "number"
                  ? (product.specs.split_pv_pct as number)
                  : ""
              }
              placeholder="leer = normaler Artikel"
            />
            <p className="text-muted-foreground text-xs">
              Nur für Hybrid-Wechselrichter: Anteil des Preises, der der PV-Anlage
              zugerechnet wird (Rest = Speicher). Z. B. 50 für 50 % / 50 %.
            </p>
          </div>

          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Speichern …" : "Speichern"}
            </Button>
          </DialogFooter>
        </form>

        {isEdit && product ? (
          <div className="border-t pt-4">
            <p className="mb-2 text-sm font-medium">Bilder &amp; Datenblätter</p>
            <AssetUpload productId={product.id} assets={assets} />
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
