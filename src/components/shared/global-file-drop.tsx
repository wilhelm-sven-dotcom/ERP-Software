"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Upload, Check, X, Search, Images } from "lucide-react";
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
import { createClient } from "@/lib/supabase/client";
import { registerProjectFile } from "@/app/(app)/projekte/actions";
import { registerProductAsset } from "@/app/(app)/produkte/actions";
import { rankProductsForFilename, matchProductsInText } from "@/lib/asset-match";
import {
  extractImagesFromPdf,
  extractTextFromPdf,
  type ExtractedImage,
} from "@/lib/pdf/extract-images";
import { cn } from "@/lib/utils";
import type { Product } from "@/lib/types";

const PROJECT_BUCKET = "project-files";
const PRODUCT_BUCKET = "product-assets";
const PROJECT_KINDS = ["dokument", "datenblatt", "plan", "foto", "rechnung", "sonstiges"];

type Target = "produkt" | "projekt";
type Row = {
  uid: string;
  file: File;
  isPdf: boolean;
  target: Target;
  productIds: string[];
  suggestedIds: string[];
  projectId: string;
  kind: string;
  extracted: ExtractedImage[];
  selectedImageIds: string[];
  extracting: boolean;
  extractDone: boolean;
  detecting: boolean;
  textMatchCount: number;
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
  const productById = React.useMemo(
    () => new Map(products.map((p) => [p.id, p])),
    [products],
  );

  function addFiles(list: FileList | File[]) {
    const arr = Array.from(list);
    const next: Row[] = arr.map((file) => {
      const ranked = rankProductsForFilename(file.name, products);
      const strong = ranked.filter((r) => r.score >= 5).map((r) => r.product.id);
      const isPdf = /pdf$/i.test(file.type) || /\.pdf$/i.test(file.name);
      return {
        uid: `f${++seq}`,
        file,
        isPdf,
        target: strong.length > 0 ? "produkt" : "projekt",
        // Bei PDFs kommt die Vorauswahl AUSSCHLIESSLICH aus dem präzisen
        // Text-Matcher (siehe detectProductsFromText) — der Dateiname bestimmt
        // nur das Ziel, markiert aber nicht massenhaft vor. Bilder: Top-1.
        productIds: !isPdf && strong.length > 0 ? [strong[0]] : [],
        suggestedIds: isPdf ? [] : strong,
        projectId: "",
        kind: strong.length > 0 ? (isPdf ? "datasheet" : "image") : isPdf ? "datenblatt" : "dokument",
        extracted: [],
        selectedImageIds: [],
        extracting: false,
        extractDone: false,
        detecting: false,
        textMatchCount: 0,
        done: false,
        busy: false,
      };
    });
    setRows((r) => [...r, ...next]);
    // PDFs: Produkte aus dem Datenblatt-Text erkennen und vormarkieren.
    for (const row of next) {
      if (row.isPdf) void detectProductsFromText(row.uid, row.file);
    }
  }

  async function detectProductsFromText(uid: string, file: File) {
    patch(uid, { detecting: true });
    try {
      const text = await extractTextFromPdf(file);
      const matched = matchProductsInText(text, products);
      setRows((r) =>
        r.map((x) => {
          if (x.uid !== uid) return x;
          if (matched.length === 0) return { ...x, detecting: false };
          const suggestedIds = Array.from(new Set([...x.suggestedIds, ...matched]));
          const productIds = Array.from(new Set([...x.productIds, ...matched]));
          return {
            ...x,
            target: "produkt",
            suggestedIds,
            productIds,
            textMatchCount: matched.length,
            detecting: false,
          };
        }),
      );
    } catch {
      patch(uid, { detecting: false });
    }
  }

  function patch(uid: string, p: Partial<Row>) {
    setRows((r) => r.map((x) => (x.uid === uid ? { ...x, ...p } : x)));
  }
  function removeRow(uid: string) {
    setRows((r) => r.filter((x) => x.uid !== uid));
  }
  function toggleProduct(uid: string, productId: string) {
    setRows((r) =>
      r.map((x) => {
        if (x.uid !== uid) return x;
        const has = x.productIds.includes(productId);
        return {
          ...x,
          productIds: has
            ? x.productIds.filter((id) => id !== productId)
            : [...x.productIds, productId],
        };
      }),
    );
  }

  async function extractImages(row: Row) {
    patch(row.uid, { extracting: true });
    try {
      const imgs = await extractImagesFromPdf(row.file);
      patch(row.uid, {
        extracted: imgs,
        // größtes Bild vorausgewählt (Liste ist nach Fläche sortiert)
        selectedImageIds: imgs.length > 0 ? [imgs[0].id] : [],
        extracting: false,
        extractDone: true,
      });
      if (imgs.length === 0) toast.info("Keine extrahierbaren Bilder gefunden.");
    } catch (e) {
      console.error(e);
      patch(row.uid, { extracting: false, extractDone: true });
      toast.error("Bilder konnten nicht extrahiert werden.");
    }
  }

  function toggleImage(uid: string, imgId: string) {
    setRows((r) =>
      r.map((x) => {
        if (x.uid !== uid) return x;
        const has = x.selectedImageIds.includes(imgId);
        return {
          ...x,
          selectedImageIds: has
            ? x.selectedImageIds.filter((id) => id !== imgId)
            : [...x.selectedImageIds, imgId],
        };
      }),
    );
  }

  async function commit(row: Row) {
    if (row.target === "produkt" && row.productIds.length === 0) {
      toast.error("Bitte mindestens ein Produkt wählen.");
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
      // Datei einmal hochladen, dann allen gewählten Produkten zuordnen.
      const path = `shared/${Date.now()}-${rand}.${ext}`;
      const { error } = await supabase.storage.from(PRODUCT_BUCKET).upload(path, row.file);
      if (error) {
        toast.error(`Upload fehlgeschlagen: ${error.message}`);
        patch(row.uid, { busy: false });
        return;
      }
      let ok = 0;
      for (const productId of row.productIds) {
        const res = await registerProductAsset({
          productId,
          kind: row.kind === "image" ? "image" : "datasheet",
          name: row.file.name,
          storagePath: path,
          mime: row.file.type || null,
        });
        if (res.ok) ok += 1;
      }
      if (ok === 0) {
        toast.error("Konnte nicht zuordnen.");
        patch(row.uid, { busy: false });
        return;
      }

      // Aus dem PDF ausgewählte Bilder als Produktbild(er) mit ablegen.
      const chosenImages = row.extracted.filter((img) => row.selectedImageIds.includes(img.id));
      const baseName = row.file.name.replace(/\.pdf$/i, "");
      for (const img of chosenImages) {
        const imgPath = `shared/${Date.now()}-${Math.random().toString(36).slice(2, 7)}.png`;
        const up = await supabase.storage
          .from(PRODUCT_BUCKET)
          .upload(imgPath, img.blob, { contentType: "image/png" });
        if (up.error) continue;
        for (const productId of row.productIds) {
          await registerProductAsset({
            productId,
            kind: "image",
            name: `${baseName} (Bild)`,
            storagePath: imgPath,
            mime: "image/png",
          });
        }
      }

      toast.success(
        `„${row.file.name}" ${ok} Produkt(en) zugeordnet${
          chosenImages.length > 0 ? ` · ${chosenImages.length} Bild(er) übernommen` : ""
        }`,
      );
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
      toast.success(`„${row.file.name}" abgelegt`);
    }
    patch(row.uid, { busy: false, done: true });
    router.refresh();
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
          — wir fragen, wohin die Datei soll, bevor sie abgelegt wird.
        </p>
      </div>

      {rows.map((row) => (
        <div
          key={row.uid}
          className={cn("rounded-lg border p-3 text-sm", row.done && "opacity-60")}
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className="min-w-40 flex-1 truncate font-medium">{row.file.name}</span>
            <Select value={row.target} onValueChange={(v) => patch(row.uid, { target: v as Target })}>
              <SelectTrigger size="sm" className="h-8 w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="produkt">Produkt(e)</SelectItem>
                <SelectItem value="projekt">Projekt</SelectItem>
              </SelectContent>
            </Select>
            {row.done ? (
              <span className="text-success inline-flex items-center gap-1 text-xs">
                <Check className="size-4" /> abgelegt
              </span>
            ) : (
              <Button size="sm" disabled={row.busy} onClick={() => commit(row)}>
                {row.busy
                  ? "…"
                  : row.target === "produkt"
                    ? `${row.productIds.length} zuordnen`
                    : "Ablegen"}
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

          {row.done ? null : row.target === "produkt" ? (
            <>
              {row.detecting ? (
                <p className="text-muted-foreground mt-2 text-xs">
                  Produkte im Datenblatt werden erkannt …
                </p>
              ) : row.textMatchCount > 0 ? (
                <p className="text-primary mt-2 text-xs font-medium">
                  {row.textMatchCount} Produkt(e) im Datenblatt erkannt und vormarkiert.
                </p>
              ) : null}
              <ProductChooser
                products={products}
                suggestedIds={row.suggestedIds}
                selectedIds={row.productIds}
                kind={row.kind}
                onToggle={(id) => toggleProduct(row.uid, id)}
                onKind={(k) => patch(row.uid, { kind: k })}
                productById={productById}
                onClearSuggest={() => patch(row.uid, { productIds: row.suggestedIds })}
              />
              {row.isPdf ? (
                <div className="mt-2 border-t pt-2">
                  {!row.extractDone ? (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={row.extracting}
                      onClick={() => extractImages(row)}
                    >
                      <Images className="size-4" />
                      {row.extracting ? "Bilder werden gelesen …" : "Bilder aus PDF extrahieren"}
                    </Button>
                  ) : row.extracted.length === 0 ? (
                    <p className="text-muted-foreground text-xs">
                      Keine extrahierbaren Bilder im PDF gefunden.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-muted-foreground text-xs">
                        Bilder fürs Produktbild auswählen ({row.selectedImageIds.length} gewählt) —
                        größtes ist vorausgewählt.
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {row.extracted.map((img) => {
                          const sel = row.selectedImageIds.includes(img.id);
                          return (
                            <button
                              key={img.id}
                              type="button"
                              onClick={() => toggleImage(row.uid, img.id)}
                              className={cn(
                                "relative overflow-hidden rounded-md border-2 transition-colors",
                                sel ? "border-primary" : "border-transparent hover:border-muted-foreground/40",
                              )}
                              title={`${img.width}×${img.height}`}
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={img.dataUrl} alt="" className="size-20 bg-white object-contain" />
                              {sel ? (
                                <span className="bg-primary text-primary-foreground absolute top-0.5 right-0.5 rounded-full p-0.5">
                                  <Check className="size-3" />
                                </span>
                              ) : null}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              ) : null}
            </>
          ) : (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Select value={row.projectId} onValueChange={(v) => patch(row.uid, { projectId: v })}>
                <SelectTrigger size="sm" className="h-8 w-64">
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
                <SelectTrigger size="sm" className="h-8 w-36">
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
            </div>
          )}
        </div>
      ))}

      {pending.length > 1 ? (
        <Button
          variant="outline"
          size="sm"
          onClick={async () => {
            for (const row of rows.filter((r) => !r.done)) {
              await commit(row);
            }
          }}
        >
          Alle ablegen ({pending.length})
        </Button>
      ) : null}
    </div>
  );
}

/** Mehrfachauswahl der Produkte für ein Datenblatt (mit Vorschlägen + Suche). */
function ProductChooser({
  products,
  suggestedIds,
  selectedIds,
  kind,
  onToggle,
  onKind,
  productById,
  onClearSuggest,
}: {
  products: Product[];
  suggestedIds: string[];
  selectedIds: string[];
  kind: string;
  onToggle: (id: string) => void;
  onKind: (k: string) => void;
  productById: Map<string, Product>;
  onClearSuggest: () => void;
}) {
  const [query, setQuery] = React.useState("");
  const q = query.trim().toLowerCase();
  const suggestSet = new Set(suggestedIds);

  const list = React.useMemo(() => {
    const base = q
      ? products.filter(
          (p) =>
            p.name.toLowerCase().includes(q) ||
            (p.sku ?? "").toLowerCase().includes(q) ||
            (p.manufacturer ?? "").toLowerCase().includes(q),
        )
      : products;
    // Vorschläge zuerst, dann alphabetisch.
    return [...base].sort((a, b) => {
      const sa = suggestSet.has(a.id) ? 0 : 1;
      const sb = suggestSet.has(b.id) ? 0 : 1;
      return sa - sb || a.name.localeCompare(b.name);
    });
  }, [products, q, suggestedIds]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="mt-2 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={kind} onValueChange={onKind}>
          <SelectTrigger size="sm" className="h-8 w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="datasheet">Datenblatt</SelectItem>
            <SelectItem value="image">Bild</SelectItem>
          </SelectContent>
        </Select>
        {suggestedIds.length > 1 ? (
          <Button variant="outline" size="sm" onClick={onClearSuggest}>
            Alle {suggestedIds.length} Vorschläge wählen
          </Button>
        ) : null}
        <span className="text-muted-foreground text-xs">
          {selectedIds.length} ausgewählt
        </span>
      </div>

      {selectedIds.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {selectedIds.map((id) => (
            <span
              key={id}
              className="bg-primary/10 text-primary inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs"
            >
              {productById.get(id)?.name ?? id}
              <button type="button" onClick={() => onToggle(id)} title="Entfernen">
                <X className="size-3" />
              </button>
            </span>
          ))}
        </div>
      ) : (
        <p className="text-muted-foreground text-xs">
          Noch kein Produkt gewählt — Vorschläge sind oben markiert.
        </p>
      )}

      <div className="relative">
        <Search className="text-muted-foreground absolute top-2 left-2 size-4" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Produkt suchen (Name, Hersteller, Artikelnr.) …"
          className="h-8 pl-8"
        />
      </div>
      <div className="max-h-44 space-y-0.5 overflow-y-auto rounded-md border p-1">
        {list.slice(0, 60).map((p) => {
          const checked = selectedIds.includes(p.id);
          const suggested = suggestSet.has(p.id);
          return (
            <label
              key={p.id}
              className="hover:bg-muted flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-sm"
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => onToggle(p.id)}
                className="size-4"
              />
              <span className="min-w-0 flex-1 truncate">
                {p.name}
                {p.sku ? <span className="text-muted-foreground"> · {p.sku}</span> : null}
              </span>
              {suggested ? (
                <span className="bg-primary/10 text-primary rounded px-1 text-[10px]">Vorschlag</span>
              ) : null}
            </label>
          );
        })}
        {list.length === 0 ? (
          <p className="text-muted-foreground px-2 py-2 text-xs">Keine Treffer.</p>
        ) : null}
      </div>
    </div>
  );
}
