"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Upload, Check, X, Search, Images, Sparkles } from "lucide-react";
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
import {
  registerProductAsset,
  updateProductSpecs,
  createProductFromDatasheet,
} from "@/app/(app)/produkte/actions";
import { rankProductsForFilename, matchProductsInText } from "@/lib/asset-match";
import {
  extractImagesFromPdf,
  extractTextFromPdf,
  renderPagesToDataUrls,
  type ExtractedImage,
} from "@/lib/pdf/extract-images";
import { cn } from "@/lib/utils";
import type { Product } from "@/lib/types";

const PROJECT_BUCKET = "project-files";
const PRODUCT_BUCKET = "product-assets";
const PROJECT_KINDS = ["dokument", "datenblatt", "plan", "foto", "rechnung", "sonstiges"];

type Target = "produkt" | "projekt";
type DocMeta = {
  docType?: string;
  supplier?: string;
  invoice_number?: string;
  invoice_date?: string;
  due_date?: string;
  amount?: number | string;
  currency?: string;
};
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
  /** Extrahierter PDF-Volltext (für Inhaltssuche + KI). */
  text: string;
  /** KI-Verarbeitung läuft. */
  aiBusy: boolean;
  /** Kurze KI-Begründung der Zuordnung. */
  aiReason: string;
  /** KI-interpretierte Beleg-Felder (Rechnung/Dokument). */
  docMeta: DocMeta | null;
  /** KI-ausgelesene technische Kenndaten aus einem Datenblatt. */
  specs: Record<string, string | number> | null;
  /** Technische Kenndaten je Produkt-ID (Datenblatt mit mehreren Produkten). */
  productSpecs: Record<string, Record<string, string | number>> | null;
  /** Vorschlag für ein neu anzulegendes Produkt (wenn keins passt). */
  productSuggestion: { name?: string; manufacturer?: string; category?: string } | null;
  /** Editierbarer Name fürs Anlegen eines neuen Produkts. */
  newProductName: string;
  /** Specs beim Ablegen ins Produkt übernehmen? */
  applySpecs: boolean;
  done: boolean;
  busy: boolean;
};

let seq = 0;

/** Bilddatei als DataURL lesen (für die Vision-Auslese). */
function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

export function GlobalFileDrop({
  projects,
  products,
  aiEnabled = false,
}: {
  projects: { id: string; title: string }[];
  products: Product[];
  aiEnabled?: boolean;
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
        text: "",
        aiBusy: false,
        aiReason: "",
        docMeta: null,
        specs: null,
        productSpecs: null,
        productSuggestion: null,
        newProductName: "",
        applySpecs: true,
        done: false,
        busy: false,
      };
    });
    // Dubletten (gleicher Name + Größe) vermeiden — sowohl im Batch als auch
    // gegenüber bereits vorhandenen Zeilen.
    setRows((r) => {
      const seen = new Set(r.map((x) => `${x.file.name}:${x.file.size}`));
      const filtered = next.filter((x) => {
        const key = `${x.file.name}:${x.file.size}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      return [...r, ...filtered];
    });
    // PDFs: Text auslesen (für Suche), Produkte erkennen, dann KI-Vorschlag.
    for (const row of next) {
      if (row.isPdf) void detectProductsFromText(row.uid, row.file);
      else if (aiEnabled) void runAiSuggest(row.uid, row.file, "");
    }
  }

  async function detectProductsFromText(uid: string, file: File) {
    patch(uid, { detecting: true });
    let text = "";
    try {
      text = await extractTextFromPdf(file);
      const matched = matchProductsInText(text, products);
      setRows((r) =>
        r.map((x) => {
          if (x.uid !== uid) return x;
          const base = { ...x, text, detecting: false };
          if (matched.length === 0) return base;
          const suggestedIds = Array.from(new Set([...x.suggestedIds, ...matched]));
          const productIds = Array.from(new Set([...x.productIds, ...matched]));
          return {
            ...base,
            target: "produkt",
            suggestedIds,
            productIds,
            textMatchCount: matched.length,
          };
        }),
      );
    } catch {
      patch(uid, { detecting: false });
    }
    // Nach der Textanalyse die KI um einen Zuordnungs-/Beleg-Vorschlag bitten.
    if (aiEnabled) void runAiSuggest(uid, file, text);
  }

  /** KI fragen, wohin die Datei gehört + Beleg-Felder interpretieren. */
  async function runAiSuggest(uid: string, file: File, text: string) {
    patch(uid, { aiBusy: true });
    try {
      // Bild der Datei für die Vision-Auslese: PDF → erste Seite(n) rendern,
      // Bilddatei → direkt als DataURL (funktioniert auch bei Scans).
      let images: string[] = [];
      try {
        if (/pdf$/i.test(file.type) || /\.pdf$/i.test(file.name)) {
          images = await renderPagesToDataUrls(file, { maxPages: 2 });
        } else if (/^image\//.test(file.type)) {
          images = [await fileToDataUrl(file)];
        }
      } catch {
        images = [];
      }
      // Produkte nach Relevanz zum Dateinamen + Text vorsortieren, damit die
      // passenden Kandidaten (richtiger Hersteller!) sicher im Limit landen —
      // sonst „rät" die KI an artverwandten Produkten anderer Marken.
      const hay = `${file.name} ${text.slice(0, 4000)}`.toLowerCase();
      const tok = (s: string) =>
        s.toLowerCase().replace(/[_\-.]+/g, " ").split(/\s+/).filter((t) => t.length >= 3);
      const hayTokens = new Set(tok(hay));
      const scoreOf = (p: Product) => {
        let s = 0;
        const sku = p.sku?.toLowerCase().trim();
        if (sku && sku.length >= 4 && hay.includes(sku)) s += 100;
        for (const t of tok(p.name ?? "")) if (hayTokens.has(t)) s += 3;
        for (const t of tok(p.manufacturer ?? "")) if (hayTokens.has(t)) s += 4;
        return s;
      };
      const rankedProducts = [...products]
        .map((p) => ({ p, s: scoreOf(p) }))
        .sort((a, b) => b.s - a.s)
        .slice(0, 140)
        .map(({ p }) => ({ id: p.id, name: p.name, sku: p.sku, manufacturer: p.manufacturer }));
      const res = await fetch("/api/files/classify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: file.name,
          text,
          images,
          projects,
          products: rankedProducts,
        }),
      });
      const data = (await res.json()) as {
        enabled?: boolean;
        result?: {
          target: Target;
          productIds: string[];
          projectId: string | null;
          kind: string;
          confidence: number;
          reason: string;
          document?: DocMeta | null;
          specs?: Record<string, string | number> | null;
          productSpecs?: Record<string, Record<string, string | number>> | null;
          product_suggestion?: { name?: string; manufacturer?: string; category?: string } | null;
        } | null;
      };
      const r = data.result;
      if (!r) {
        patch(uid, { aiBusy: false });
        return;
      }
      const validProductIds = r.productIds.filter((id) => productById.has(id));
      const validProjectId = projects.some((p) => p.id === r.projectId) ? r.projectId! : "";
      // Per-Produkt-Specs nur für gültige IDs übernehmen.
      const productSpecs: Record<string, Record<string, string | number>> = {};
      if (r.productSpecs) {
        for (const [pid, sp] of Object.entries(r.productSpecs)) {
          if (productById.has(pid) && sp && typeof sp === "object") productSpecs[pid] = sp;
        }
      }
      setRows((rows) =>
        rows.map((x) => {
          if (x.uid !== uid) return x;
          if (r.target === "produkt") {
            return {
              ...x,
              target: "produkt",
              aiBusy: false,
              aiReason: r.reason,
              // ALLE erkannten Produkte vormarkieren (Datenblatt kann mehrere abdecken).
              productIds:
                validProductIds.length > 0 ? validProductIds : x.productIds,
              suggestedIds: Array.from(new Set([...x.suggestedIds, ...validProductIds])),
              kind: r.kind === "image" ? "image" : "datasheet",
              docMeta: r.document ?? null,
              specs: r.specs ?? null,
              productSpecs: Object.keys(productSpecs).length > 0 ? productSpecs : null,
              productSuggestion: r.product_suggestion ?? null,
            };
          }
          return {
            ...x,
            target: "projekt",
            aiBusy: false,
            aiReason: r.reason,
            projectId: validProjectId || x.projectId,
            kind: PROJECT_KINDS.includes(r.kind) ? r.kind : x.kind,
            docMeta: r.document ?? null,
          };
        }),
      );
    } catch {
      patch(uid, { aiBusy: false });
    }
  }

  function patch(uid: string, p: Partial<Row>) {
    setRows((r) => r.map((x) => (x.uid === uid ? { ...x, ...p } : x)));
  }

  /** Neues Produkt aus dem Datenblatt anlegen und der Datei zuordnen. */
  async function createNewProduct(row: Row) {
    const name = (row.newProductName || row.productSuggestion?.name || row.file.name.replace(/\.[^.]+$/, "")).trim();
    if (!name) {
      toast.error("Bitte einen Produktnamen angeben.");
      return;
    }
    patch(row.uid, { busy: true });
    const res = await createProductFromDatasheet({
      name,
      manufacturer: row.productSuggestion?.manufacturer ?? null,
      category: row.productSuggestion?.category ?? null,
      specs: row.specs ?? null,
    });
    patch(row.uid, { busy: false });
    if (res.ok && res.id) {
      const newId = res.id;
      setRows((rows) =>
        rows.map((x) =>
          x.uid === row.uid
            ? { ...x, productIds: Array.from(new Set([...x.productIds, newId])), productSuggestion: null }
            : x,
        ),
      );
      toast.success(`Produkt „${name}" angelegt und zugeordnet`);
    } else {
      toast.error(res.error ?? "Konnte Produkt nicht anlegen.");
    }
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
          textContent: row.kind === "image" ? null : row.text || null,
        });
        if (res.ok) ok += 1;
      }
      if (ok === 0) {
        toast.error("Konnte nicht zuordnen.");
        patch(row.uid, { busy: false });
        return;
      }

      // Technische Kenndaten ins Produkt übernehmen — je Produkt die spezifischen
      // (productSpecs), sonst die allgemeinen Specs.
      let specsApplied = 0;
      if (row.applySpecs) {
        for (const productId of row.productIds) {
          const sp = row.productSpecs?.[productId] ?? row.specs;
          if (sp && Object.keys(sp).length > 0) {
            const r = await updateProductSpecs(productId, sp);
            if (r.ok) specsApplied += 1;
          }
        }
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
        }${specsApplied > 0 ? ` · Kenndaten übernommen` : ""}`,
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
        textContent: row.text || null,
        docMeta: row.docMeta ?? null,
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
            {aiEnabled && !row.done ? (
              <Button
                variant="outline"
                size="sm"
                disabled={row.aiBusy}
                title="KI-Vorschlag für Ablage & Beleg-Felder"
                onClick={() => runAiSuggest(row.uid, row.file, row.text)}
              >
                <Sparkles className="size-4" />
                {row.aiBusy ? "…" : "KI-Vorschlag"}
              </Button>
            ) : null}
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

          {!row.done && (row.aiBusy || row.aiReason || row.docMeta || row.specs) ? (
            <div className="border-primary/30 bg-primary/5 mt-2 rounded-md border p-2 text-xs">
              <p className="text-primary flex items-center gap-1 font-medium">
                <Sparkles className="size-3" />
                {row.aiBusy ? "KI analysiert die Datei …" : "KI-Vorschlag"}
              </p>
              {row.aiReason ? <p className="mt-1">{row.aiReason}</p> : null}
              {row.specs && Object.keys(row.specs).length > 0 ? (
                <div className="mt-2 border-t pt-2">
                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      className="size-4"
                      checked={row.applySpecs}
                      onChange={(e) => patch(row.uid, { applySpecs: e.target.checked })}
                    />
                    <span className="font-medium">
                      Technische Daten ins Produkt übernehmen ({Object.keys(row.specs).length} Felder)
                    </span>
                  </label>
                  <div className="text-muted-foreground mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                    {Object.entries(row.specs).slice(0, 8).map(([k, v]) => (
                      <span key={k}>
                        {k.replace(/_/g, " ")}: <span className="text-foreground">{String(v)}</span>
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
              {row.docMeta ? (
                <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-muted-foreground">
                  {row.docMeta.docType ? <span>Art: {row.docMeta.docType}</span> : null}
                  {row.docMeta.supplier ? <span>Lieferant: {row.docMeta.supplier}</span> : null}
                  {row.docMeta.invoice_number ? <span>Nr.: {row.docMeta.invoice_number}</span> : null}
                  {row.docMeta.invoice_date ? <span>Datum: {row.docMeta.invoice_date}</span> : null}
                  {row.docMeta.due_date ? <span>Fällig: {row.docMeta.due_date}</span> : null}
                  {row.docMeta.amount != null && row.docMeta.amount !== "" ? (
                    <span>
                      Betrag: {row.docMeta.amount} {row.docMeta.currency ?? ""}
                    </span>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}

          {row.done ? null : row.target === "produkt" ? (
            <>
              {row.detecting ? (
                <p className="text-muted-foreground mt-2 text-xs">
                  Produkte im Datenblatt werden erkannt …
                </p>
              ) : row.productIds.length > 0 ? (
                <p className="text-primary mt-2 text-xs font-medium">
                  {row.productIds.length} Produkt(e) erkannt und vormarkiert.
                </p>
              ) : null}

              {/* Nichts zugeordnet → immer das Anlegen anbieten (Name vorbefüllt:
                  KI-Vorschlag, sonst aus dem Dateinamen). So bleibt man nie hängen. */}
              {!row.aiBusy && !row.detecting && row.productIds.length === 0 ? (
                <div className="border-primary/40 bg-primary/5 mt-2 rounded-md border p-2">
                  <p className="text-xs font-medium">
                    Kein passendes Produkt im Katalog — neu anlegen?
                  </p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    <Input
                      value={
                        row.newProductName ||
                        row.productSuggestion?.name ||
                        row.file.name.replace(/\.[^.]+$/, "").replace(/[_]+/g, " ").trim()
                      }
                      onChange={(e) => patch(row.uid, { newProductName: e.target.value })}
                      placeholder="Produktname"
                      className="h-8 flex-1 min-w-48"
                    />
                    <Button size="sm" disabled={row.busy} onClick={() => createNewProduct(row)}>
                      Anlegen &amp; zuordnen
                    </Button>
                  </div>
                  {row.productSuggestion?.manufacturer ? (
                    <p className="text-muted-foreground mt-1 text-xs">
                      Hersteller: {row.productSuggestion.manufacturer}
                    </p>
                  ) : null}
                </div>
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
