"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Upload, Check, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createClient } from "@/lib/supabase/client";
import { registerProjectFile } from "@/app/(app)/projekte/actions";
import { registerProductAsset } from "@/app/(app)/produkte/actions";
import { rankProductsForFilename } from "@/lib/asset-match";
import { cn } from "@/lib/utils";
import type { Product } from "@/lib/types";

const PROJECT_BUCKET = "project-files";
const PRODUCT_BUCKET = "product-assets";
const PROJECT_KINDS = ["dokument", "datenblatt", "plan", "foto", "rechnung", "sonstiges"];

type Target = "produkt" | "projekt";
type Row = {
  uid: string;
  file: File;
  target: Target;
  productId: string;
  projectId: string;
  kind: string;
  done: boolean;
  busy: boolean;
};

let seq = 0;

export function GlobalFileDrop({
  projects,
  products,
}: {
  projects: { id: string; title: string }[];
  products: Product[];
}) {
  const router = useRouter();
  const [rows, setRows] = React.useState<Row[]>([]);
  const [over, setOver] = React.useState(false);

  function addFiles(list: FileList | File[]) {
    const arr = Array.from(list);
    const next: Row[] = arr.map((file) => {
      const ranked = rankProductsForFilename(file.name, products);
      const strong = ranked[0] && ranked[0].score >= 5;
      const isPdf = /pdf$/i.test(file.type) || /\.pdf$/i.test(file.name);
      return {
        uid: `f${++seq}`,
        file,
        target: strong ? "produkt" : "projekt",
        productId: strong ? ranked[0].product.id : "",
        projectId: "",
        kind: strong ? (isPdf ? "datasheet" : "image") : isPdf ? "datenblatt" : "dokument",
        done: false,
        busy: false,
      };
    });
    setRows((r) => [...r, ...next]);
  }

  function patch(uid: string, p: Partial<Row>) {
    setRows((r) => r.map((x) => (x.uid === uid ? { ...x, ...p } : x)));
  }
  function removeRow(uid: string) {
    setRows((r) => r.filter((x) => x.uid !== uid));
  }

  async function commit(row: Row) {
    if (row.target === "produkt" && !row.productId) {
      toast.error("Bitte ein Produkt wählen.");
      return;
    }
    if (row.target === "projekt" && !row.projectId) {
      toast.error("Bitte ein Projekt wählen.");
      return;
    }
    patch(row.uid, { busy: true });
    const supabase = createClient();
    const ext = row.file.name.split(".").pop() ?? "bin";
    const rand = Math.random().toString(36).slice(2, 7);

    if (row.target === "produkt") {
      const path = `${row.productId}/${Date.now()}-${rand}.${ext}`;
      const { error } = await supabase.storage.from(PRODUCT_BUCKET).upload(path, row.file);
      if (error) {
        toast.error(`Upload fehlgeschlagen: ${error.message}`);
        patch(row.uid, { busy: false });
        return;
      }
      const res = await registerProductAsset({
        productId: row.productId,
        kind: row.kind === "image" ? "image" : "datasheet",
        name: row.file.name,
        storagePath: path,
        mime: row.file.type || null,
      });
      if (!res.ok) {
        toast.error(res.error ?? "Konnte nicht zuordnen.");
        patch(row.uid, { busy: false });
        return;
      }
    } else {
      const path = `${row.projectId}/${Date.now()}-${rand}.${ext}`;
      const { error } = await supabase.storage.from(PROJECT_BUCKET).upload(path, row.file);
      if (error) {
        toast.error(`Upload fehlgeschlagen: ${error.message}`);
        patch(row.uid, { busy: false });
        return;
      }
      const res = await registerProjectFile({
        projectId: row.projectId,
        name: row.file.name,
        storagePath: path,
        mime: row.file.type || null,
        size: row.file.size,
        kind: row.kind,
      });
      if (!res.ok) {
        toast.error(res.error ?? "Konnte nicht zuordnen.");
        patch(row.uid, { busy: false });
        return;
      }
    }
    patch(row.uid, { busy: false, done: true });
    toast.success(`„${row.file.name}" abgelegt`);
    router.refresh();
  }

  async function commitAll() {
    for (const row of rows.filter((r) => !r.done)) {
      // eslint-disable-next-line no-await-in-loop
      await commit(row);
    }
  }

  const pending = rows.filter((r) => !r.done);

  return (
    <div className="space-y-3">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          addFiles(e.dataTransfer.files);
        }}
        className={cn(
          "rounded-lg border border-dashed p-5 text-center text-sm transition-colors",
          over ? "border-primary bg-primary/5" : "border-muted-foreground/30",
        )}
      >
        <Upload className="text-muted-foreground mx-auto mb-2 size-6" />
        <p className="text-muted-foreground">
          PDFs/Bilder hierher ziehen oder
          <label className="text-primary mx-1 cursor-pointer underline">
            auswählen
            <input
              type="file"
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files) addFiles(e.target.files);
                e.target.value = "";
              }}
            />
          </label>
          — wir schlagen Produkt oder Projekt vor.
        </p>
      </div>

      {rows.length > 0 ? (
        <div className="space-y-2">
          {rows.map((row) => (
            <div
              key={row.uid}
              className={cn(
                "flex flex-wrap items-center gap-2 rounded-lg border p-2 text-sm",
                row.done && "opacity-60",
              )}
            >
              <span className="min-w-40 flex-1 truncate font-medium">{row.file.name}</span>

              <Select value={row.target} onValueChange={(v) => patch(row.uid, { target: v as Target })}>
                <SelectTrigger size="sm" className="h-8 w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="produkt">Produkt</SelectItem>
                  <SelectItem value="projekt">Projekt</SelectItem>
                </SelectContent>
              </Select>

              {row.target === "produkt" ? (
                <>
                  <Select value={row.productId} onValueChange={(v) => patch(row.uid, { productId: v })}>
                    <SelectTrigger size="sm" className="h-8 w-52">
                      <SelectValue placeholder="Produkt wählen" />
                    </SelectTrigger>
                    <SelectContent>
                      {products.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                          {p.sku ? ` · ${p.sku}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={row.kind} onValueChange={(v) => patch(row.uid, { kind: v })}>
                    <SelectTrigger size="sm" className="h-8 w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="datasheet">Datenblatt</SelectItem>
                      <SelectItem value="image">Bild</SelectItem>
                    </SelectContent>
                  </Select>
                </>
              ) : (
                <>
                  <Select value={row.projectId} onValueChange={(v) => patch(row.uid, { projectId: v })}>
                    <SelectTrigger size="sm" className="h-8 w-52">
                      <SelectValue placeholder="Projekt wählen" />
                    </SelectTrigger>
                    <SelectContent>
                      {projects.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={row.kind} onValueChange={(v) => patch(row.uid, { kind: v })}>
                    <SelectTrigger size="sm" className="h-8 w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PROJECT_KINDS.map((k) => (
                        <SelectItem key={k} value={k} className="capitalize">
                          {k}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </>
              )}

              {row.done ? (
                <span className="text-success inline-flex items-center gap-1 text-xs">
                  <Check className="size-4" /> abgelegt
                </span>
              ) : (
                <Button size="sm" disabled={row.busy} onClick={() => commit(row)}>
                  {row.busy ? "…" : "Ablegen"}
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="size-8"
                title="Entfernen"
                onClick={() => removeRow(row.uid)}
              >
                <X className="size-4" />
              </Button>
            </div>
          ))}

          {pending.length > 1 ? (
            <Button variant="outline" size="sm" onClick={commitAll}>
              Alle ablegen ({pending.length})
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
