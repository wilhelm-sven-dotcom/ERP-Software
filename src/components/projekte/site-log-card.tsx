"use client";

import * as React from "react";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Camera, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabase/client";
import { addSiteLogEntry, deleteSiteLogEntry } from "@/app/(app)/bautagebuch/actions";
import { registerProjectFile } from "@/app/(app)/projekte/actions";
import { type ActionResult } from "@/lib/actions";
import { formatDate } from "@/lib/format";
import type { SiteLogEntry } from "@/lib/types";

const initial: ActionResult = { ok: false };
const BUCKET = "project-files";

export function SiteLogCard({
  projectId,
  entries,
}: {
  projectId: string;
  entries: SiteLogEntry[];
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState(addSiteLogEntry, initial);
  const [adding, setAdding] = React.useState(false);
  const [analyzing, setAnalyzing] = React.useState(false);
  // Kontrollierte Felder, damit der KI-Vorschlag sie befüllen kann.
  const [logDate, setLogDate] = React.useState(() => new Date().toISOString().slice(0, 10));
  const [weather, setWeather] = React.useState("");
  const [crew, setCrew] = React.useState("");
  const [workDone, setWorkDone] = React.useState("");
  const [note, setNote] = React.useState("");
  const [photoIds, setPhotoIds] = React.useState<string[]>([]);
  const [aiGenerated, setAiGenerated] = React.useState(false);
  const seen = React.useRef<ActionResult | null>(null);

  function resetForm() {
    setWeather("");
    setCrew("");
    setWorkDone("");
    setNote("");
    setPhotoIds([]);
    setAiGenerated(false);
    setLogDate(new Date().toISOString().slice(0, 10));
  }

  React.useEffect(() => {
    if (seen.current === state) return;
    seen.current = state;
    if (state.ok) {
      toast.success("Eintrag gespeichert");
      setAdding(false);
      resetForm();
      router.refresh();
    } else if (state.error) {
      toast.error(state.error);
    }
  }, [state, router]);

  async function onPhoto(file: File) {
    setAnalyzing(true);
    setAdding(true);
    try {
      // 1) Foto in die Projekt-Dateien hochladen (kind=foto).
      const supabase = createClient();
      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `${projectId}/${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`;
      const up = await supabase.storage.from(BUCKET).upload(path, file);
      if (!up.error) {
        const reg = await registerProjectFile({
          projectId,
          name: file.name,
          storagePath: path,
          mime: file.type || null,
          size: file.size,
          kind: "foto",
        });
        if (reg.ok && reg.id) setPhotoIds((ids) => [...ids, reg.id!]);
      }
      // 2) Foto an die KI schicken → Entwurf für den Eintrag.
      const dataUrl = await new Promise<string>((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(String(r.result));
        r.onerror = rej;
        r.readAsDataURL(file);
      });
      const resp = await fetch("/api/site-log/from-photo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: dataUrl }),
      });
      const data = (await resp.json()) as {
        enabled?: boolean;
        draft?: { work_done?: string; weather?: string; crew?: string; note?: string } | null;
      };
      if (data.draft) {
        if (data.draft.work_done) setWorkDone(data.draft.work_done);
        if (data.draft.weather) setWeather(data.draft.weather);
        if (data.draft.note) setNote(data.draft.note);
        setAiGenerated(true);
        toast.success("KI-Entwurf erstellt — bitte prüfen.");
      } else if (data.enabled === false) {
        toast.error("KI ist nicht aktiviert.");
      }
    } catch {
      toast.error("Foto konnte nicht verarbeitet werden.");
    } finally {
      setAnalyzing(false);
    }
  }

  return (
    <div className="space-y-4">
      {entries.length === 0 ? (
        <p className="text-muted-foreground text-sm">Noch keine Bautagebuch-Einträge.</p>
      ) : (
        <ul className="space-y-3">
          {entries.map((e) => (
            <li key={e.id} className="rounded-lg border p-3 text-sm">
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="font-medium">{formatDate(e.log_date)}</span>
                <div className="flex items-center gap-2">
                  {e.weather ? (
                    <span className="text-muted-foreground text-xs">{e.weather}</span>
                  ) : null}
                  <form action={deleteSiteLogEntry}>
                    <input type="hidden" name="id" value={e.id} />
                    <input type="hidden" name="project_id" value={projectId} />
                    <Button variant="ghost" size="icon" className="size-7" type="submit" title="Löschen">
                      <Trash2 className="size-3.5" />
                    </Button>
                  </form>
                </div>
              </div>
              {e.crew ? (
                <p className="text-muted-foreground text-xs">Mannschaft: {e.crew}</p>
              ) : null}
              <p className="mt-1 whitespace-pre-wrap">{e.work_done}</p>
              {e.note ? (
                <p className="text-muted-foreground mt-1 text-xs whitespace-pre-wrap">{e.note}</p>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {adding ? (
        <form action={action} className="grid gap-2 rounded-lg border p-3">
          <input type="hidden" name="project_id" value={projectId} />
          <input type="hidden" name="photo_ids" value={JSON.stringify(photoIds)} />
          <input type="hidden" name="ai_generated" value={String(aiGenerated)} />
          {aiGenerated ? (
            <p className="text-primary flex items-center gap-1 text-xs font-medium">
              <Sparkles className="size-3" /> KI-Entwurf aus Foto — bitte prüfen/ergänzen.
            </p>
          ) : null}
          <div className="grid gap-2 sm:grid-cols-3">
            <Input name="log_date" type="date" value={logDate} onChange={(e) => setLogDate(e.target.value)} className="h-9" />
            <Input name="weather" placeholder="Wetter" value={weather} onChange={(e) => setWeather(e.target.value)} className="h-9" />
            <Input name="crew" placeholder="Mannschaft" value={crew} onChange={(e) => setCrew(e.target.value)} className="h-9" />
          </div>
          <Textarea name="work_done" placeholder="Durchgeführte Arbeiten" rows={3} required value={workDone} onChange={(e) => setWorkDone(e.target.value)} />
          <Textarea name="note" placeholder="Bemerkungen (optional)" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
          {photoIds.length > 0 ? (
            <p className="text-muted-foreground text-xs">{photoIds.length} Foto(s) verknüpft.</p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" size="sm" disabled={pending}>
              {pending ? "Speichern …" : "Eintrag speichern"}
            </Button>
            <PhotoButton onPhoto={onPhoto} analyzing={analyzing} label="Weiteres Foto" />
            <Button type="button" size="sm" variant="ghost" onClick={() => { setAdding(false); resetForm(); }}>
              Abbrechen
            </Button>
          </div>
        </form>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => setAdding(true)}>
            <Plus className="size-4" /> Eintrag
          </Button>
          <PhotoButton onPhoto={onPhoto} analyzing={analyzing} label="Foto → Eintrag (KI)" />
        </div>
      )}
    </div>
  );
}

function PhotoButton({
  onPhoto,
  analyzing,
  label,
}: {
  onPhoto: (file: File) => void;
  analyzing: boolean;
  label: string;
}) {
  return (
    <label className="bg-background hover:bg-muted inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md border px-3 text-sm">
      {analyzing ? <Loader2 className="size-4 animate-spin" /> : <Camera className="size-4" />}
      {analyzing ? "Analysiere …" : label}
      <input
        type="file"
        accept="image/*"
        className="hidden"
        disabled={analyzing}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onPhoto(f);
          e.target.value = "";
        }}
      />
    </label>
  );
}
