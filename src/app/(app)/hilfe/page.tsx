import type { Metadata } from "next";

import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "Hilfe" };

const sections = [
  {
    title: "Kunden",
    body: "Kundenstamm verwalten: anlegen, bearbeiten und Aktivitäten (Logbuch) erfassen. Die Kundennummer wird automatisch fortlaufend vergeben.",
  },
  {
    title: "Projekte & Pipeline",
    body: "Projekte werden einem Kunden und einem Bearbeiter zugeordnet. Der Status steuert die Pipeline-Ansicht; er lässt sich dort per Schnellauswahl ändern.",
  },
  {
    title: "Produkte",
    body: "Produktkatalog mit Gruppen, Hersteller sowie Einkaufs- und Verkaufspreis – Grundlage für die spätere Kalkulation.",
  },
  {
    title: "Rollen",
    body: "Administratoren haben Vollzugriff. Mitarbeiter dürfen lesen, anlegen und eigene/zugewiesene Datensätze bearbeiten, aber nicht löschen.",
  },
  {
    title: "Backup",
    body: "Administratoren können alle Daten als JSON-Datei exportieren (Modul Backup).",
  },
];

export default function HilfePage() {
  return (
    <div>
      <PageHeader
        title="Hilfe"
        description="Kurzüberblick über die wichtigsten Funktionen."
      />

      <div className="grid gap-4 md:grid-cols-2">
        {sections.map((s) => (
          <Card key={s.title}>
            <CardHeader>
              <CardTitle className="text-base">{s.title}</CardTitle>
            </CardHeader>
            <CardContent className="text-muted-foreground text-sm">
              {s.body}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
