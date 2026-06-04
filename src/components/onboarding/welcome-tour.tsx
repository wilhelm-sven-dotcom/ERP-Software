"use client";

import * as React from "react";
import Link from "next/link";
import { Calculator, FileText, Sparkles, HelpCircle, Rocket } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const STORAGE_KEY = "ip3-onboarding-v1";

interface Step {
  icon: React.ReactNode;
  title: string;
  body: string;
}

const STEPS: Step[] = [
  {
    icon: <Rocket className="size-6" />,
    title: "Willkommen im ip³ PV-Tool",
    body:
      "Hier verwaltest du Kunden, Projekte, Kalkulationen und Angebote an einem Ort. " +
      "Diese kurze Einführung zeigt dir die wichtigsten Schritte — du kannst sie jederzeit überspringen.",
  },
  {
    icon: <Calculator className="size-6" />,
    title: "So läuft ein Projekt",
    body:
      "Der Ablauf ist immer gleich: Kalkulation → Angebot → Auftrag → Lieferschein → Rechnung. " +
      "Im Projekt zeigt dir die Leiste »Nächster Schritt« jederzeit, was als Nächstes dran ist — ein Klick genügt.",
  },
  {
    icon: <FileText className="size-6" />,
    title: "Kalkulation & Angebot",
    body:
      "In der Kalkulation kannst du mit »Schnell-Konfiguration« aus Anlagengröße + Speicher automatisch eine " +
      "komplette Kalkulation erzeugen. Unten führt »Speichern & Angebot erstellen« direkt zum fertigen Angebot.",
  },
  {
    icon: <Sparkles className="size-6" />,
    title: "KI hilft dir",
    body:
      "Zieh Datenblätter oder Rechnungen einfach in die Ablage — die KI erkennt Art und Ziel und schlägt die " +
      "Zuordnung vor. Fehlende technische Daten zu Produkten kannst du »aus dem Netz ziehen« lassen.",
  },
  {
    icon: <HelpCircle className="size-6" />,
    title: "Hilfe ist immer da",
    body:
      "Überall im Programm findest du kleine (i)-Symbole mit Kurzerklärungen. Eine ausführliche Übersicht " +
      "mit Glossar gibt es jederzeit unter »Hilfe« in der Seitenleiste.",
  },
];

/**
 * Einmalige Einführungstour beim ersten Login (pro Browser gemerkt). Erklärt
 * Ablauf, Kalkulation/Angebot, KI und das Hilfesystem. Lässt sich überspringen.
 */
export function WelcomeTour() {
  const [open, setOpen] = React.useState(false);
  const [i, setI] = React.useState(0);

  React.useEffect(() => {
    // Nach dem Mount prüfen (nicht synchron im Effekt) → kein Hydration-Mismatch.
    const id = window.setTimeout(() => {
      try {
        if (!localStorage.getItem(STORAGE_KEY)) setOpen(true);
      } catch {
        /* localStorage nicht verfügbar → Tour einfach nicht zeigen */
      }
    }, 0);
    return () => window.clearTimeout(id);
  }, []);

  function finish() {
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* ignorieren */
    }
    setOpen(false);
  }

  const step = STEPS[i];
  const last = i === STEPS.length - 1;

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : finish())}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="bg-primary/10 text-primary mb-2 flex size-12 items-center justify-center rounded-xl">
            {step.icon}
          </div>
          <DialogTitle>{step.title}</DialogTitle>
          <DialogDescription className="leading-relaxed">{step.body}</DialogDescription>
        </DialogHeader>

        {/* Fortschritts-Punkte */}
        <div className="flex justify-center gap-1.5 py-1">
          {STEPS.map((_, idx) => (
            <span
              key={idx}
              className={
                "size-1.5 rounded-full transition-colors " +
                (idx === i ? "bg-primary" : "bg-muted-foreground/30")
              }
            />
          ))}
        </div>

        <DialogFooter className="flex-row items-center justify-between gap-2 sm:justify-between">
          <Button variant="ghost" size="sm" onClick={finish}>
            Überspringen
          </Button>
          <div className="flex gap-2">
            {i > 0 ? (
              <Button variant="outline" size="sm" onClick={() => setI((n) => n - 1)}>
                Zurück
              </Button>
            ) : null}
            {last ? (
              <Button size="sm" asChild onClick={finish}>
                <Link href="/hilfe">Los geht&apos;s</Link>
              </Button>
            ) : (
              <Button size="sm" onClick={() => setI((n) => n + 1)}>
                Weiter
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
