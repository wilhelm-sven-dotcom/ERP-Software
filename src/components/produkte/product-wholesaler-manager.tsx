"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  deleteProductWholesaler,
  saveProductWholesaler,
} from "@/app/(app)/produkte/actions";
import { formatCurrency } from "@/lib/format";
import type { ProductWholesaler, Wholesaler } from "@/lib/types";

/**
 * Verwaltet die Großhändler-Verknüpfungen eines Produkts (Bestellnr. + EK je
 * Händler). Eigene Server-Actions, da es separate Datensätze sind.
 */
export function ProductWholesalerManager({
  productId,
  links,
  wholesalers,
}: {
  productId: string;
  links: ProductWholesaler[];
  wholesalers: Wholesaler[];
}) {
  const router = useRouter();
  const [wholesalerId, setWholesalerId] = React.useState<string>("");
  const [orderNumber, setOrderNumber] = React.useState("");
  const [ek, setEk] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  async function add() {
    if (!wholesalerId) {
      toast.error("Bitte einen Großhändler wählen.");
      return;
    }
    setBusy(true);
    const fd = new FormData();
    fd.set("product_id", productId);
    fd.set("wholesaler_id", wholesalerId);
    if (orderNumber) fd.set("order_number", orderNumber);
    if (ek) fd.set("price_purchase", ek);
    const res = await saveProductWholesaler({ ok: false }, fd);
    setBusy(false);
    if (res.ok) {
      setWholesalerId("");
      setOrderNumber("");
      setEk("");
      router.refresh();
    } else {
      toast.error(res.error ?? "Konnte nicht gespeichert werden");
    }
  }

  return (
    <div className="space-y-2">
      {links.length > 0 ? (
        <ul className="divide-y rounded-md border">
          {links.map((l) => (
            <li
              key={l.id}
              className="flex items-center justify-between gap-2 px-3 py-1.5 text-sm"
            >
              <div className="min-w-0">
                <span className="font-medium">
                  {l.wholesaler?.name ?? "Großhändler"}
                </span>
                <span className="text-muted-foreground">
                  {l.order_number ? ` · Best.-Nr. ${l.order_number}` : ""}
                  {l.price_purchase != null
                    ? ` · EK ${formatCurrency(l.price_purchase)}`
                    : ""}
                </span>
              </div>
              <form action={deleteProductWholesaler}>
                <input type="hidden" name="id" value={l.id} />
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  type="submit"
                  title="Verknüpfung entfernen"
                >
                  <Trash2 className="size-4" />
                </Button>
              </form>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground text-xs">
          Noch keine Großhändler verknüpft.
        </p>
      )}

      {wholesalers.length === 0 ? (
        <p className="text-muted-foreground text-xs">
          Lege zuerst im Menü Großhändler Lieferanten an.
        </p>
      ) : (
        <div className="flex flex-wrap items-end gap-2">
          <Select value={wholesalerId} onValueChange={setWholesalerId}>
            <SelectTrigger size="sm" className="min-w-40 flex-1">
              <SelectValue placeholder="Großhändler …" />
            </SelectTrigger>
            <SelectContent>
              {wholesalers.map((w) => (
                <SelectItem key={w.id} value={w.id}>
                  {w.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            value={orderNumber}
            onChange={(e) => setOrderNumber(e.target.value)}
            placeholder="Bestellnr."
            className="h-8 w-28"
          />
          <Input
            value={ek}
            onChange={(e) => setEk(e.target.value)}
            type="number"
            step="0.01"
            placeholder="EK €"
            className="h-8 w-24"
          />
          <Button type="button" size="sm" onClick={add} disabled={busy}>
            <Plus className="size-4" /> Hinzufügen
          </Button>
        </div>
      )}
    </div>
  );
}
