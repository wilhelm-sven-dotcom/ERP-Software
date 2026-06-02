import type { Metadata } from "next";
import { Plus, FolderTree, Upload } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { SupabaseNotice } from "@/components/shared/supabase-notice";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { ProductFormDialog } from "@/components/produkte/product-form-dialog";
import { ProductBoard } from "@/components/produkte/product-board";
import { GroupManager } from "@/components/produkte/group-manager";
import { CsvImportDialog } from "@/components/produkte/csv-import-dialog";
import {
  getProducts,
  getProductGroups,
  getAllProductAssets,
} from "@/lib/data/products";
import {
  getWholesalers,
  getAllProductWholesalers,
} from "@/lib/data/wholesalers";
import { getList } from "@/lib/data/settings";
import { DEFAULT_CATEGORIES, DEFAULT_UNITS } from "@/lib/constants";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import type { Product } from "@/lib/types";

export const metadata: Metadata = { title: "Produkte" };

const NONE = "__none__";

export default async function ProduktePage() {
  const [
    products,
    groups,
    assetsByProduct,
    wholesalers,
    wholesalersByProduct,
    units,
    categories,
  ] = await Promise.all([
    getProducts(),
    getProductGroups(),
    getAllProductAssets(),
    getWholesalers(),
    getAllProductWholesalers(),
    getList("units", DEFAULT_UNITS),
    getList("categories", DEFAULT_CATEGORIES),
  ]);

  // Gruppen-Reihenfolge nach `sort`, dann Name (alle Gruppen = Drop-Ziele).
  const sortedGroups = [...groups].sort(
    (a, b) => a.sort - b.sort || a.name.localeCompare(b.name),
  );
  const groupOrder = sortedGroups.map((g) => g.id);

  // Produkte je Container; innerhalb der Gruppe nach Kategorie gegliedert
  // (Kategorie → manuelle Sortierung → Name), damit das Board Unterabschnitte zeigt.
  const items: Record<string, Product[]> = {};
  for (const id of groupOrder) items[id] = [];
  items[NONE] = [];
  for (const p of products) {
    const key = p.group_id && items[p.group_id] ? p.group_id : NONE;
    items[key].push(p);
  }
  const catKey = (p: Product) => p.category?.trim() || "￿"; // ohne Kategorie ans Ende
  for (const key of Object.keys(items)) {
    items[key].sort(
      (a, b) =>
        catKey(a).localeCompare(catKey(b)) ||
        a.sort - b.sort ||
        a.name.localeCompare(b.name),
    );
  }

  // Öffentliche URLs der Thumbnails serverseitig auflösen.
  const supabase = isSupabaseConfigured() ? await createClient() : null;
  const urlFor = (path: string | null | undefined): string | null =>
    path && supabase
      ? supabase.storage.from("product-assets").getPublicUrl(path).data
          .publicUrl
      : null;
  const thumbs: Record<string, string | null> = {};
  for (const p of products) {
    const img = (assetsByProduct[p.id] ?? []).find((a) => a.kind === "image");
    thumbs[p.id] = urlFor(img?.storage_path);
  }

  const newButton = (
    <ProductFormDialog
      groups={groups}
      units={units}
      categories={categories}
      trigger={
        <Button>
          <Plus className="size-4" /> Neues Produkt
        </Button>
      }
    />
  );

  return (
    <div>
      <PageHeader
        title="Produkte"
        description="Produktkatalog — per Drag &amp; Drop ordnen."
      >
        <CsvImportDialog
          trigger={
            <Button variant="outline">
              <Upload className="size-4" /> CSV-Import
            </Button>
          }
        />
        <GroupManager
          groups={groups}
          trigger={
            <Button variant="outline">
              <FolderTree className="size-4" /> Gruppen
            </Button>
          }
        />
        {newButton}
      </PageHeader>

      <SupabaseNotice />

      {products.length === 0 ? (
        <EmptyState
          title="Noch keine Produkte"
          description="Lege Produkte an, um sie in Kalkulationen zu verwenden."
        >
          {newButton}
        </EmptyState>
      ) : (
        <ProductBoard
          groups={groups}
          initialGroupOrder={groupOrder}
          initialItems={items}
          thumbs={thumbs}
          assetsByProduct={assetsByProduct}
          wholesalers={wholesalers}
          wholesalersByProduct={wholesalersByProduct}
          units={units}
          categories={categories}
        />
      )}
    </div>
  );
}
