import type { Metadata } from "next";
import { Plus, FolderTree, Upload } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { SupabaseNotice } from "@/components/shared/supabase-notice";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ProductFormDialog } from "@/components/produkte/product-form-dialog";
import { GroupManager } from "@/components/produkte/group-manager";
import { CsvImportDialog } from "@/components/produkte/csv-import-dialog";
import {
  getProducts,
  getProductGroups,
  getAllProductAssets,
} from "@/lib/data/products";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { formatCurrency } from "@/lib/format";

export const metadata: Metadata = { title: "Produkte" };

export default async function ProduktePage() {
  const [products, groups, assetsByProduct] = await Promise.all([
    getProducts(),
    getProductGroups(),
    getAllProductAssets(),
  ]);
  const groupName = (id: string | null) =>
    groups.find((g) => g.id === id)?.name ?? "–";

  // Öffentliche URL eines Storage-Pfads (für Thumbnails in der Liste).
  const supabase = isSupabaseConfigured() ? await createClient() : null;
  const urlFor = (path: string | null | undefined): string | null =>
    path && supabase
      ? supabase.storage.from("product-assets").getPublicUrl(path).data
          .publicUrl
      : null;

  const newButton = (
    <ProductFormDialog
      groups={groups}
      trigger={
        <Button>
          <Plus className="size-4" /> Neues Produkt
        </Button>
      }
    />
  );

  return (
    <div>
      <PageHeader title="Produkte" description="Produktkatalog und Gruppen.">
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
        <div className="bg-card rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12" />
                <TableHead>Name</TableHead>
                <TableHead>Gruppe</TableHead>
                <TableHead>Hersteller</TableHead>
                <TableHead className="text-right">EK</TableHead>
                <TableHead className="text-right">VK</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((p) => {
                const assets = assetsByProduct[p.id] ?? [];
                const firstImage = assets.find((a) => a.kind === "image");
                const thumb = urlFor(firstImage?.storage_path);
                return (
                  <TableRow key={p.id}>
                    <TableCell>
                      {thumb ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={thumb}
                          alt={p.name}
                          className="size-9 rounded border object-cover"
                        />
                      ) : (
                        <div className="bg-muted size-9 rounded border" />
                      )}
                    </TableCell>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {groupName(p.group_id)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {p.manufacturer ?? "–"}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(p.price_purchase)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(p.price_sell)}
                    </TableCell>
                    <TableCell>
                      <ProductFormDialog
                        product={p}
                        groups={groups}
                        assets={assets}
                        trigger={
                          <Button variant="ghost" size="sm">
                            Bearbeiten
                          </Button>
                        }
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
