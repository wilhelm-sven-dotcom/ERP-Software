/**
 * Client-seitige Extraktion eingebetteter Bilder aus einem PDF (Datenblatt)
 * mit pdf.js. Liefert PNG-Blobs + DataURLs zur Vorschau. Best-effort:
 * Vektor-/CMYK-/maskierte Bilder können fehlen — daher Auswahl durch den Nutzer.
 * Wird ausschließlich im Browser (dynamischer Import) verwendet.
 */
export interface ExtractedImage {
  id: string;
  blob: Blob;
  dataUrl: string;
  width: number;
  height: number;
}

type PdfImage = {
  width?: number;
  height?: number;
  kind?: number; // 1=GRAYSCALE_1BPP, 2=RGB_24BPP, 3=RGBA_32BPP
  data?: Uint8ClampedArray | Uint8Array;
  bitmap?: CanvasImageSource;
};

let workerConfigured = false;

function toImageData(
  img: PdfImage,
  ctx: CanvasRenderingContext2D,
): ImageData | null {
  const w = img.width ?? 0;
  const h = img.height ?? 0;
  const data = img.data;
  if (!data || w === 0 || h === 0) return null;
  const out = ctx.createImageData(w, h);
  const dst = out.data;
  if (img.kind === 3) {
    // RGBA bereits passend
    dst.set(data.subarray(0, w * h * 4));
  } else if (img.kind === 2) {
    // RGB → RGBA
    for (let i = 0, j = 0; i < w * h; i++) {
      dst[j++] = data[i * 3];
      dst[j++] = data[i * 3 + 1];
      dst[j++] = data[i * 3 + 2];
      dst[j++] = 255;
    }
  } else if (img.kind === 1) {
    // 1-bit Graustufen (gepackt)
    const bytesPerRow = Math.ceil(w / 8);
    let p = 0;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const byte = data[y * bytesPerRow + (x >> 3)];
        const bit = (byte >> (7 - (x & 7))) & 1;
        const v = bit ? 255 : 0;
        dst[p++] = v;
        dst[p++] = v;
        dst[p++] = v;
        dst[p++] = 255;
      }
    }
  } else {
    return null;
  }
  return out;
}

async function canvasToImage(
  canvas: HTMLCanvasElement,
  id: string,
): Promise<ExtractedImage | null> {
  const blob = await new Promise<Blob | null>((res) =>
    canvas.toBlob(res, "image/png"),
  );
  if (!blob) return null;
  return {
    id,
    blob,
    dataUrl: canvas.toDataURL("image/png"),
    width: canvas.width,
    height: canvas.height,
  };
}

/** Volltext eines PDFs (alle Seiten, klein geschrieben) für die Produkterkennung. */
export async function extractTextFromPdf(
  file: File,
  maxPages = 30,
): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  if (!workerConfigured) {
    pdfjs.GlobalWorkerOptions.workerSrc = new URL(
      "pdfjs-dist/build/pdf.worker.min.mjs",
      import.meta.url,
    ).toString();
    workerConfigured = true;
  }
  try {
    const buf = await file.arrayBuffer();
    const doc = await pdfjs.getDocument({ data: buf }).promise;
    const pages = Math.min(doc.numPages, maxPages);
    const parts: string[] = [];
    for (let i = 1; i <= pages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      const text = content.items
        .map((it) => ("str" in it ? it.str : ""))
        .join(" ");
      parts.push(text);
      page.cleanup();
    }
    return parts.join("\n").toLowerCase();
  } catch (e) {
    console.error("extractTextFromPdf:", e);
    return "";
  }
}

export async function extractImagesFromPdf(
  file: File,
  opts: { minSize?: number; maxImages?: number; maxPages?: number } = {},
): Promise<ExtractedImage[]> {
  const minSize = opts.minSize ?? 150;
  const maxImages = opts.maxImages ?? 12;

  const pdfjs = await import("pdfjs-dist");
  if (!workerConfigured) {
    pdfjs.GlobalWorkerOptions.workerSrc = new URL(
      "pdfjs-dist/build/pdf.worker.min.mjs",
      import.meta.url,
    ).toString();
    workerConfigured = true;
  }

  const buf = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: buf }).promise;
  const OPS = pdfjs.OPS;
  const results: ExtractedImage[] = [];
  const seen = new Set<string>();
  const maxPages = Math.min(doc.numPages, opts.maxPages ?? 20);

  for (let i = 1; i <= maxPages && results.length < maxImages; i++) {
    const page = await doc.getPage(i);
    // Seite klein rendern, damit pdf.js die Bild-Objekte auflöst.
    const base = page.getViewport({ scale: 1 });
    const scale = Math.min(1, 1200 / Math.max(base.width, base.height));
    const vp = page.getViewport({ scale });
    const tmp = document.createElement("canvas");
    tmp.width = Math.max(1, Math.ceil(vp.width));
    tmp.height = Math.max(1, Math.ceil(vp.height));
    const tctx = tmp.getContext("2d");
    if (tctx) {
      try {
        await page.render({ canvas: tmp, canvasContext: tctx, viewport: vp }).promise;
      } catch {
        /* Render-Fehler ignorieren — Objekte sind ggf. trotzdem da. */
      }
    }

    const opList = await page.getOperatorList();
    const names: string[] = [];
    for (let j = 0; j < opList.fnArray.length; j++) {
      const fn = opList.fnArray[j];
      if (fn === OPS.paintImageXObject || fn === OPS.paintImageXObjectRepeat) {
        const arg = opList.argsArray[j]?.[0];
        if (typeof arg === "string") names.push(arg);
      }
    }

    for (const name of names) {
      if (results.length >= maxImages) break;
      let img: PdfImage | null = null;
      try {
        img = page.objs.get(name) as PdfImage;
      } catch {
        continue;
      }
      if (!img) continue;
      const w = img.width ?? 0;
      const h = img.height ?? 0;
      if (w < minSize || h < minSize) continue;

      const c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      const cctx = c.getContext("2d");
      if (!cctx) continue;
      try {
        if (img.bitmap) {
          cctx.drawImage(img.bitmap, 0, 0);
        } else if (img.data) {
          const id = toImageData(img, cctx);
          if (!id) continue;
          cctx.putImageData(id, 0, 0);
        } else {
          continue;
        }
      } catch {
        continue;
      }
      const extracted = await canvasToImage(c, `${i}-${name}`);
      if (!extracted) continue;
      const dedup = `${w}x${h}-${extracted.blob.size}`;
      if (seen.has(dedup)) continue;
      seen.add(dedup);
      results.push(extracted);
    }
    page.cleanup();
  }

  // Fallback: keine eingebetteten Bilder → erste Seite als Bild anbieten.
  if (results.length === 0 && doc.numPages > 0) {
    const page = await doc.getPage(1);
    const vp = page.getViewport({ scale: 1.5 });
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.ceil(vp.width));
    c.height = Math.max(1, Math.ceil(vp.height));
    const ctx = c.getContext("2d");
    if (ctx) {
      try {
        await page.render({ canvas: c, canvasContext: ctx, viewport: vp }).promise;
        const extracted = await canvasToImage(c, "page-1");
        if (extracted) results.push(extracted);
      } catch {
        /* ignorieren */
      }
    }
  }

  results.sort((a, b) => b.width * b.height - a.width * a.height);
  return results.slice(0, maxImages);
}
