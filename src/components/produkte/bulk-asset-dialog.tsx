"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, Upload, X } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createClient } from "@/lib/supabase/client";
import { registerProductAsset } from "@/app/(app)/produkte/actions";
import { extractTextFromPdf } from "@/lib/pdf/extract-images";
import { rankProductsForFilename } from "@/lib/asset-match";
import type { Product } from "@/lib/types";

const BUCKET = "product-assets";
const NONE = "__none__";

interface Row {
  id: string;
  file: File;
  productId: string;
  kind: "image" | "datasheet";
  candidates: { id: string; label: string; score: number }[];
  status: "pending" | "uploading" | "done" | "error";
}

export function BulkAssetDialog({
  products,
  trigger,
}: {
  products: Product[];
  trigger: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [rows, setRows] = React.useState<Row[]>([]);
  const [busy, setBusy] = React.useState(false);

  function addFiles(files: FileList | null) {
    if (!files) return;
    const next: Row[] = [];
    for (const file of Array.from(files)) {
      const ranked = rankProductsForFilename(file.name, products);
      const isImage = file.type.startsWith("image/");
      next.push({
        id: `${file.name}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        file,
        productId: ranked[0]?.product.id ?? NONE,
        kind: isImage ? "image" : "datasheet",
        candidates: ranked.map((c) => ({
          id: c.product.id,
          label: [c.product.name, c.product.sku].filter(Boolean).join(" · "),
          score: c.score,
        })),
        status: "pending",
      });
    }
    setRows((prev) => [...prev, ...next]);
  }

  function update(id: string, patch: Partial<Row>) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }
  function removeRow(id: string) {
    setRows((prev) => prev.filter((r) => r.id !== id));
  }

  async function uploadAll() {
    const toUpload = rows.filter(
      (r) => r.status !== "done" && r.productId !== NONE,
    );
    if (toUpload.length === 0) {
      toast.error("Bitte mindestens einer Datei ein Produkt zuordnen.");
      return;
    }
    setBusy(true);
    const supabase = createClient();
    let ok = 0;
    for (const r of toUpload) {
      update(r.id, { status: "uploading" });
      try {
        const ext = r.file.name.split(".").pop() ?? "bin";
        const path = `${r.productId}/${r.kind}-${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from(BUCKET)
          .upload(path, r.file, { upsert: false });
        if (upErr) {
          update(r.id, { status: "error" });
          continue;
        }
        let text: string | null = null;
        if (r.kind === "datasheet" && /\.pdf$/i.test(r.file.name)) {
          try {
            text = await extractTextFromPdf(r.file);
          } catch {
            text = null;
          }
        }
        const res = await registerProductAsset({
          productId: r.productId,
          kind: r.kind,
          name: r.file.name,
          storagePath: path,
          mime: r.file.type || null,
          textContent: text,
        });
        update(r.id, { status: res.ok ? "done" : "error" });
        if (res.ok) ok += 1;
      } catch {
        update(r.id, { status: "error" });
      }
    }
    setBusy(false);
    if (ok > 0) {
      toast.success(`${ok} Datei(en) zugeordnet.`);
      router.refresh();
    }
  }

  const productName = (id: string) =>
    id === NONE
      ? "— Produkt wählen —"
      : products.find((p) => p.id === id)?.name ?? "—";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Datenblätter hochladen</DialogTitle>
          <DialogDescription>
            Mehrere Dateien wählen — wir schlagen anhand des Dateinamens das
            passende Produkt vor. Vor dem Hochladen prüfen und bestätigen.
          </DialogDescription>
        </DialogHeader>

        <label className="border-muted-foreground/30 hover:bg-muted/40 flex cursor-pointer flex-col items-center gap-2 rounded-lg border border-dashed p-6 text-center">
          <Upload className="text-muted-foreground size-6" />
          <span className="text-sm">Dateien auswählen (PDF, Bilder)</span>
          <input
            type="file"
            multiple
            accept="application/pdf,image/*"
            className="hidden"
            onChange={(e) => {
              addFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </label>

        {rows.length > 0 ? (
          <div className="space-y-2">
            {rows.map((r) => (
              <div
                key={r.id}
                className="flex flex-wrap items-center gap-2 rounded-md border px-3 py-2 text-sm"
              >
                <div className="min-w-40 flex-1">
                  <p className="truncate font-medium">{r.file.name}</p>
                  <p className="text-muted-foreground text-xs">
                    {r.candidates.length > 0
                      ? `Vorschlag: ${productName(r.productId)}`
                      : "Kein Vorschlag — bitte wählen"}
                  </p>
                </div>
                <Select
                  value={r.productId}
                  onValueChange={(v) => update(r.id, { productId: v })}
                >
                  <SelectTrigger size="sm" className="h-8 w-56">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>— Produkt wählen —</SelectItem>
                    {/* Erst die Kandidaten, dann alle Produkte. */}
                    {r.candidates.map((c) => (
                      <SelectItem key={`c-${c.id}`} value={c.id}>
                        ★ {c.label}
                      </SelectItem>
                    ))}
                    {products.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {[p.name, p.sku].filter(Boolean).join(" · ")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={r.kind}
                  onValueChange={(v) => update(r.id, { kind: v as Row["kind"] })}
                >
                  <SelectTrigger size="sm" className="h-8 w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="datasheet">Datenblatt</SelectItem>
                    <SelectItem value="image">Bild</SelectItem>
                  </SelectContent>
                </Select>
                <span className="w-6 text-center">
                  {r.status === "done" ? (
                    <CheckCircle2 className="text-primary size-4" />
                  ) : r.status === "uploading" ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : r.status === "error" ? (
                    <X className="text-destructive size-4" />
                  ) : (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-6"
                      onClick={() => removeRow(r.id)}
                      title="Entfernen"
                    >
                      <X className="size-3.5" />
                    </Button>
                  )}
                </span>
              </div>
            ))}
          </div>
        ) : null}

        <DialogFooter>
          <Button onClick={uploadAll} disabled={busy || rows.length === 0}>
            {busy ? "Lädt …" : "Bestätigen & hochladen"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
