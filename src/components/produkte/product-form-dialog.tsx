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
import { ProductWholesalerManager } from "@/components/produkte/product-wholesaler-manager";
import { ListSelect } from "@/components/produkte/list-select";
import { DEFAULT_CATEGORIES, DEFAULT_UNITS } from "@/lib/constants";
import type {
  Product,
  ProductAsset,
  ProductGroup,
  ProductWholesaler,
  Wholesaler,
} from "@/lib/types";

const initial: ActionResult = { ok: false };

export function ProductFormDialog({
  product,
  groups,
  assets = [],
  wholesalers = [],
  productWholesalers = [],
  units = DEFAULT_UNITS,
  categories = DEFAULT_CATEGORIES,
  trigger,
}: {
  product?: Product;
  groups: ProductGroup[];
  assets?: ProductAsset[];
  wholesalers?: Wholesaler[];
  productWholesalers?: ProductWholesaler[];
  units?: string[];
  categories?: string[];
  trigger: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [state, action, pending] = useActionState(saveProduct, initial);
  const isEdit = Boolean(product);

  const pricing = (product?.specs?.pricing ?? null) as {
    base?: number;
    tiers?: { upToKwp: number | null; perKwp: number }[];
  } | null;
  const tierAt = (bound: number | null) =>
    pricing?.tiers?.find((t) => t.upToKwp === bound)?.perKwp ?? "";
  const [isService, setIsService] = React.useState(
    Boolean(product?.specs?.is_service),
  );

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
              <Label>Kategorie</Label>
              <ListSelect
                name="category"
                kind="categories"
                options={categories}
                defaultValue={product?.category ?? null}
                placeholder="Kategorie wählen"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="sku">Artikelnr.</Label>
              <Input id="sku" name="sku" defaultValue={product?.sku ?? ""} />
            </div>
            <div className="grid gap-2">
              <Label>Einheit</Label>
              <ListSelect
                name="unit"
                kind="units"
                options={units}
                defaultValue={product?.unit ?? null}
                placeholder="Einheit wählen"
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

          <div className="grid gap-2 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="module_wp">Modulleistung (Wp)</Label>
              <Input
                id="module_wp"
                name="module_wp"
                type="number"
                step="1"
                min={0}
                defaultValue={
                  typeof product?.specs?.module_wp === "number"
                    ? (product.specs.module_wp as number)
                    : ""
                }
                placeholder="z. B. 445"
              />
              <p className="text-muted-foreground text-xs">
                Nur PV-Module: Leistung je Stück → zählt zur kWp der Kalkulation.
              </p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="storage_kwh">Speicher (kWh je Einheit)</Label>
              <Input
                id="storage_kwh"
                name="storage_kwh"
                type="number"
                step="0.01"
                min={0}
                defaultValue={
                  typeof product?.specs?.storage_kwh === "number"
                    ? (product.specs.storage_kwh as number)
                    : ""
                }
                placeholder="z. B. 5.12"
              />
              <p className="text-muted-foreground text-xs">
                Nur Speicher: Kapazität je Stück → zählt zur kWh der Kalkulation.
              </p>
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

          <div className="grid gap-2 rounded-md border p-3">
            <label className="flex items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                name="is_service"
                checked={isService}
                onChange={(e) => setIsService(e.target.checked)}
                className="size-4"
              />
              Dienstleistung – Preis nach Anlagengröße (€/kWp, gestaffelt)
            </label>
            {isService ? (
              <>
                <p className="text-muted-foreground text-xs">
                  Marginal gestaffelt: jeder kWp wird mit dem Satz seines Brackets
                  bewertet und aufsummiert. Satz 0 = konstant. Optionaler
                  Sockelbetrag.
                </p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                  <div className="grid gap-1">
                    <Label htmlFor="svc_base" className="text-xs">
                      Sockel €
                    </Label>
                    <Input
                      id="svc_base"
                      name="svc_base"
                      type="number"
                      step="0.01"
                      defaultValue={pricing?.base ?? ""}
                    />
                  </div>
                  <div className="grid gap-1">
                    <Label htmlFor="svc_t10" className="text-xs">
                      ≤10 €/kWp
                    </Label>
                    <Input id="svc_t10" name="svc_t10" type="number" step="0.01" defaultValue={tierAt(10)} />
                  </div>
                  <div className="grid gap-1">
                    <Label htmlFor="svc_t30" className="text-xs">
                      ≤30 €/kWp
                    </Label>
                    <Input id="svc_t30" name="svc_t30" type="number" step="0.01" defaultValue={tierAt(30)} />
                  </div>
                  <div className="grid gap-1">
                    <Label htmlFor="svc_t135" className="text-xs">
                      ≤135 €/kWp
                    </Label>
                    <Input id="svc_t135" name="svc_t135" type="number" step="0.01" defaultValue={tierAt(135)} />
                  </div>
                  <div className="grid gap-1">
                    <Label htmlFor="svc_tmax" className="text-xs">
                      &gt;135 €/kWp
                    </Label>
                    <Input id="svc_tmax" name="svc_tmax" type="number" step="0.01" defaultValue={tierAt(null)} />
                  </div>
                </div>
              </>
            ) : null}
          </div>

          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Speichern …" : "Speichern"}
            </Button>
          </DialogFooter>
        </form>

        {isEdit && product ? (
          <>
            <div className="border-t pt-4">
              <p className="mb-2 text-sm font-medium">
                Großhändler &amp; Bestellnummern
              </p>
              <ProductWholesalerManager
                productId={product.id}
                links={productWholesalers}
                wholesalers={wholesalers}
              />
            </div>
            <div className="border-t pt-4">
              <p className="mb-2 text-sm font-medium">Bilder &amp; Datenblätter</p>
              <AssetUpload productId={product.id} assets={assets} />
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
