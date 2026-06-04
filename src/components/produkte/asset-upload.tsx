"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { FileText, ImageIcon, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import {
  registerProductAsset,
  deleteProductAsset,
} from "@/app/(app)/produkte/actions";
import { extractTextFromPdf } from "@/lib/pdf/extract-images";
import type { ProductAsset } from "@/lib/types";

const BUCKET = "product-assets";

export function AssetUpload({
  productId,
  assets,
}: {
  productId: string;
  assets: ProductAsset[];
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);

  async function upload(file: File, kind: "image" | "datasheet") {
    setBusy(true);
    try {
      const supabase = createClient();
      const ext = file.name.split(".").pop() ?? "bin";
      const path = `${productId}/${kind}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, { upsert: false });
      if (upErr) {
        toast.error(`Upload fehlgeschlagen: ${upErr.message}`);
        return;
      }
      // Datenblatt-Volltext für die Inhaltssuche ablegen (best-effort).
      let text: string | null = null;
      if (kind === "datasheet" && /\.pdf$/i.test(file.name)) {
        try {
          text = await extractTextFromPdf(file);
        } catch {
          text = null;
        }
      }
      const res = await registerProductAsset({
        productId,
        kind,
        name: file.name,
        storagePath: path,
        mime: file.type || null,
        textContent: text,
      });
      if (res.ok) {
        toast.success("Datei hochgeladen");
        router.refresh();
      } else {
        toast.error(res.error ?? "Fehler beim Speichern");
      }
    } finally {
      setBusy(false);
    }
  }

  function publicUrl(path: string | null): string {
    if (!path) return "#";
    const supabase = createClient();
    return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
  }

  const images = assets.filter((a) => a.kind === "image");
  const datasheets = assets.filter((a) => a.kind !== "image");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <label>
          <input
            type="file"
            accept="image/*"
            className="hidden"
            disabled={busy}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void upload(f, "image");
              e.target.value = "";
            }}
          />
          <Button type="button" variant="outline" size="sm" asChild disabled={busy}>
            <span>
              <ImageIcon className="size-4" /> Bild hochladen
            </span>
          </Button>
        </label>
        <label>
          <input
            type="file"
            accept="application/pdf"
            className="hidden"
            disabled={busy}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void upload(f, "datasheet");
              e.target.value = "";
            }}
          />
          <Button type="button" variant="outline" size="sm" asChild disabled={busy}>
            <span>
              <Upload className="size-4" /> Datenblatt (PDF)
            </span>
          </Button>
        </label>
      </div>

      {images.length > 0 ? (
        <div className="flex flex-wrap gap-3">
          {images.map((a) => (
            <div key={a.id} className="group relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={publicUrl(a.storage_path)}
                alt={a.name ?? "Produktbild"}
                className="size-24 rounded-md border object-cover"
              />
              <DeleteAssetButton id={a.id} path={a.storage_path} />
            </div>
          ))}
        </div>
      ) : null}

      {datasheets.length > 0 ? (
        <ul className="space-y-1">
          {datasheets.map((a) => (
            <li
              key={a.id}
              className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm"
            >
              <a
                href={publicUrl(a.storage_path)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 hover:underline"
              >
                <FileText className="size-4" /> {a.name ?? "Datenblatt"}
              </a>
              <DeleteAssetButton id={a.id} path={a.storage_path} />
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function DeleteAssetButton({ id, path }: { id: string; path: string | null }) {
  return (
    <form action={deleteProductAsset} className="inline">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="path" value={path ?? ""} />
      <Button
        type="submit"
        variant="ghost"
        size="icon"
        className="size-7"
        title="Entfernen"
      >
        <Trash2 className="size-3.5" />
      </Button>
    </form>
  );
}
