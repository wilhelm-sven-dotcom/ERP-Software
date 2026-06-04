"use client";

import * as React from "react";
import { Sparkles, Loader2, Copy } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

/**
 * Wiederverwendbarer KI-Text-Dialog: erzeugt beim Öffnen einen Text (Mahnung,
 * E-Mail, …) über /api/ai/text, editierbar + kopierbar.
 */
export function AiTextDialog({
  label,
  title,
  prompt,
  context,
  size = "sm",
  variant = "outline",
}: {
  label: string;
  title: string;
  prompt: string;
  context?: string;
  size?: "sm" | "default" | "icon";
  variant?: "outline" | "ghost" | "default";
}) {
  const [open, setOpen] = React.useState(false);
  const [text, setText] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const started = React.useRef(false);

  const generate = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/ai/text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, context }),
      });
      const data = (await res.json()) as { enabled?: boolean; text?: string | null };
      if (data.enabled === false) toast.error("KI ist nicht aktiviert.");
      else setText(data.text ?? "");
    } catch {
      toast.error("Generierung fehlgeschlagen.");
    } finally {
      setLoading(false);
    }
  }, [prompt, context]);

  React.useEffect(() => {
    if (open && !started.current) {
      started.current = true;
      void generate();
    }
    if (!open) started.current = false;
  }, [open, generate]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={variant} size={size}>
          <Sparkles className="size-4" /> {label}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <Textarea
          value={loading ? "Wird erstellt …" : text}
          onChange={(e) => setText(e.target.value)}
          rows={10}
          readOnly={loading}
        />
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => void generate()} disabled={loading}>
            {loading ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
            Neu generieren
          </Button>
          <Button
            size="sm"
            disabled={loading || !text}
            onClick={() => {
              void navigator.clipboard.writeText(text);
              toast.success("In die Zwischenablage kopiert");
            }}
          >
            <Copy className="size-4" /> Kopieren
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
