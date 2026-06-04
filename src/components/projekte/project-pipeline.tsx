import Link from "next/link";
import { Check, ArrowRight, Calculator } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { HelpTip } from "@/components/shared/help-tip";
import { cn } from "@/lib/utils";
import { createOfferFromCalculation, setOfferStatus } from "@/app/(app)/angebot/actions";
import { createOrderConfirmation, createDeliveryNote, createInvoice } from "@/app/(app)/dokumente/actions";
import type { Calculation, Offer, DocumentRecord } from "@/lib/types";

interface Step {
  key: string;
  label: string;
  done: boolean;
  /** Ziel-Tab (URL-Hash) zum Anspringen. */
  tab: string;
  /** Kurzinfo (Anzahl/Status) für den Tooltip. */
  info: string;
}

/**
 * Geführter Vorgang im Projekt: zeigt den Fortschritt (Kalkulation → Angebot →
 * Auftrag → Lieferschein → Rechnung) und EINEN primären „Nächster Schritt"-
 * Button, der die fällige Aktion ausführt — ohne die Seite zu verlassen
 * (die Actions revalidieren das Projekt statt zu redirecten).
 */
export function ProjectPipeline({
  projectId,
  variants,
  offers,
  auftraege,
  lieferscheine,
  rechnungen,
}: {
  projectId: string;
  variants: Calculation[];
  offers: Offer[];
  auftraege: DocumentRecord[];
  lieferscheine: DocumentRecord[];
  rechnungen: DocumentRecord[];
}) {
  const selectedCalc = variants.find((v) => v.is_selected) ?? variants[0] ?? null;
  const acceptedOffer = offers.find((o) => o.status === "Angenommen") ?? null;
  const latestOffer = offers[0] ?? null;
  const ab = auftraege[0] ?? null;

  const steps: Step[] = [
    {
      key: "kalkulation",
      label: "Kalkulation",
      done: variants.length > 0,
      tab: "kalkulation",
      info: variants.length > 0 ? `${variants.length} Variante(n)` : "offen",
    },
    {
      key: "angebot",
      label: "Angebot",
      done: offers.length > 0,
      tab: "angebot",
      info: acceptedOffer ? "angenommen" : offers.length > 0 ? `${offers.length} Angebot(e)` : "offen",
    },
    {
      key: "auftrag",
      label: "Auftrag",
      done: auftraege.length > 0,
      tab: "belege",
      info: auftraege.length > 0 ? `${auftraege.length} AB` : "offen",
    },
    {
      key: "lieferschein",
      label: "Lieferschein",
      done: lieferscheine.length > 0,
      tab: "belege",
      info: lieferscheine.length > 0 ? `${lieferscheine.length} Lieferschein(e)` : "offen",
    },
    {
      key: "rechnung",
      label: "Rechnung",
      done: rechnungen.length > 0,
      tab: "belege",
      info: rechnungen.length > 0 ? `${rechnungen.length} Rechnung(en)` : "offen",
    },
  ];

  // Den ersten offenen Schritt als primäre Aktion bestimmen.
  let primary: React.ReactNode = null;
  let hint: string | null = null;

  if (variants.length === 0) {
    primary = (
      <Button asChild>
        <Link href={`/kalkulation/${projectId}`}>
          <Calculator className="size-4" /> Kalkulation anlegen
        </Link>
      </Button>
    );
    hint = "Lege zuerst eine Kalkulation an — daraus entsteht das Angebot.";
  } else if (offers.length === 0) {
    primary = (
      <form action={createOfferFromCalculation}>
        <input type="hidden" name="calc_id" value={selectedCalc?.id ?? ""} />
        <input type="hidden" name="project_id" value={projectId} />
        <Button type="submit">
          Angebot aus Kalkulation erstellen <ArrowRight className="size-4" />
        </Button>
      </form>
    );
    hint = `Aus „${selectedCalc?.name ?? "Variante"}" ein Angebot erzeugen.`;
  } else if (!acceptedOffer) {
    primary = (
      <div className="flex flex-wrap items-center gap-2">
        <form action={setOfferStatus}>
          <input type="hidden" name="id" value={latestOffer?.id ?? ""} />
          <input type="hidden" name="status" value="Angenommen" />
          <Button type="submit">
            <Check className="size-4" /> Angebot als angenommen markieren
          </Button>
        </form>
        {latestOffer ? (
          <Button variant="outline" asChild>
            <Link href={`/angebot/${latestOffer.id}`}>Angebot öffnen/bearbeiten</Link>
          </Button>
        ) : null}
      </div>
    );
    hint = "Sobald das Angebot angenommen ist, kann die Auftragsbestätigung erstellt werden.";
  } else if (auftraege.length === 0) {
    primary = (
      <form action={createOrderConfirmation}>
        <input type="hidden" name="offer_id" value={acceptedOffer.id} />
        <Button type="submit">
          Auftragsbestätigung erstellen <ArrowRight className="size-4" />
        </Button>
      </form>
    );
    hint = "Angebot ist angenommen — jetzt die Auftragsbestätigung erzeugen.";
  } else if (lieferscheine.length === 0) {
    primary = (
      <form action={createDeliveryNote}>
        <input type="hidden" name="document_id" value={ab?.id ?? ""} />
        <Button type="submit">
          Lieferschein erstellen <ArrowRight className="size-4" />
        </Button>
      </form>
    );
    hint = "Lieferschein zur Auftragsbestätigung erzeugen.";
  } else if (rechnungen.length === 0) {
    primary = (
      <form action={createInvoice}>
        <input type="hidden" name="source_id" value={ab?.id ?? ""} />
        <input type="hidden" name="invoice_type" value="voll" />
        <Button type="submit">
          Rechnung erstellen <ArrowRight className="size-4" />
        </Button>
      </form>
    );
    hint = "Vollrechnung erstellen (Abschlagsrechnungen im Tab „Auftrag & Belege“).";
  } else {
    hint = "Vorgang vollständig — Angebot, Auftrag, Lieferschein und Rechnung liegen vor.";
  }

  return (
    <Card className="mb-4">
      <CardContent className="flex flex-col gap-3 py-4 lg:flex-row lg:items-center lg:justify-between">
        <ol className="flex flex-1 flex-wrap items-center gap-1.5">
          {steps.map((s, i) => (
            <li key={s.key} className="flex items-center gap-1.5">
              {/* Anklickbar: springt per URL-Hash zum jeweiligen Tab. */}
              <a
                href={`#${s.tab}`}
                title={`${s.label}: ${s.info} — zum Tab springen`}
                className={cn(
                  "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-colors hover:ring-2 hover:ring-primary/40",
                  s.done
                    ? "bg-primary/10 text-primary"
                    : "bg-muted text-muted-foreground hover:text-foreground",
                )}
              >
                {s.done ? <Check className="size-3" /> : <span className="opacity-60">{i + 1}</span>}
                {s.label}
              </a>
              {i < steps.length - 1 ? (
                <ArrowRight className="text-muted-foreground/50 size-3" />
              ) : null}
            </li>
          ))}
        </ol>
        <div className="flex flex-col items-start gap-1 lg:items-end">
          {primary}
          {hint ? (
            <p className="text-muted-foreground text-xs">
              {hint} <HelpTip id="next-step" />
            </p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
