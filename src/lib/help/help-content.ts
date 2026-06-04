/**
 * Zentrale Hilfe-/Glossar-Inhalte. EINE Quelle für die kleinen (i)-Tooltips
 * (`HelpTip`) UND die Hilfe-/Glossar-Seite. So bleiben Erklärungen konsistent
 * und sind an einer Stelle pflegbar.
 */

export interface HelpEntry {
  id: string;
  /** Kurzer Titel/Begriff. */
  term: string;
  /** Ein-Satz-Erklärung (für den Tooltip). */
  short: string;
  /** Ausführlichere Erklärung (für die Hilfe-Seite). Optional. */
  long?: string;
  /** Themengruppe für die Hilfe-Seite. */
  category: "Grundlagen" | "Kalkulation" | "Angebot & Belege" | "Vertrieb" | "KI & Dokumente" | "Team & Rollen";
}

export const HELP_ENTRIES: HelpEntry[] = [
  // — Grundlagen / Workflow —
  {
    id: "workflow",
    term: "Ablauf eines Projekts",
    short: "Reihenfolge: Kalkulation → Angebot → Auftrag → Lieferschein → Rechnung.",
    long:
      "Ein Vorgang läuft immer in dieser Reihenfolge: Zuerst wird im Projekt eine Kalkulation erstellt " +
      "(Positionen, Preise, Anlagengröße). Aus der Kalkulation entsteht per Klick ein Angebot. Wird das " +
      "Angebot angenommen, erzeugt man daraus eine Auftragsbestätigung, danach Lieferschein und " +
      "Rechnung. Im Projekt zeigt die Leiste »Nächster Schritt« jederzeit, was als Nächstes dran ist.",
    category: "Grundlagen",
  },
  {
    id: "next-step",
    term: "Nächster Schritt",
    short: "Der hervorgehobene Knopf führt dich automatisch zum jeweils fälligen Arbeitsschritt.",
    long:
      "Oben im Projekt siehst du den Fortschritt als Kette. Der blaue Knopf »Nächster Schritt« macht " +
      "genau das, was als Nächstes nötig ist — z. B. »Angebot erstellen« oder »Rechnung erstellen« — " +
      "ohne dass du die Seite wechseln musst.",
    category: "Grundlagen",
  },
  {
    id: "pipeline",
    term: "Vertrieb (Funnel)",
    short: "Nur Leads/Anfragen: Neu → Kontaktiert → Qualifiziert → Termin → Angebot. Per Drag & Drop weiterziehen.",
    long:
      "Das Vertriebs-Board zeigt ausschließlich Leads/Anfragen im Funnel. Eine Karte zieht man in die " +
      "nächste Stufe. »Gewonnen« macht aus dem Lead ein aktives Projekt (es erscheint dann unter " +
      "Projekte); »Verloren« schließt den Lead. Aktive/abgeschlossene Projekte erscheinen nicht mehr im " +
      "Vertrieb.",
    category: "Vertrieb",
  },

  {
    id: "kunden",
    term: "Kunden",
    short: "Kundenstamm mit fortlaufender Kundennummer; je Kunde Projekte und ein Aktivitäten-Logbuch.",
    category: "Grundlagen",
  },
  {
    id: "produkte",
    term: "Produkte",
    short: "Katalog mit Gruppen, Preisen und technischen Daten — Grundlage für Kalkulation & Auslegung.",
    long:
      "Pflege je Produkt Einkauf/Verkauf und die Kerndaten (Modul-Wp, Speicher-kWh, WR-Leistung). " +
      "Weitere technische Daten kommen automatisch aus Datenblättern (Upload) oder »aus dem Netz« und " +
      "werden in der Technische-Daten-Liste gespeichert.",
    category: "Grundlagen",
  },
  {
    id: "dashboard",
    term: "Dashboard",
    short: "Kennzahlen und To-dos auf einen Blick; Admins können die Sicht einzelner Mitarbeiter öffnen.",
    category: "Grundlagen",
  },

  // — Kalkulation —
  {
    id: "calc-kwp",
    term: "Anlagengröße (kWp) / Speicher (kWh)",
    short: "Wird automatisch aus den Positionen berechnet (Modul-Wp × Anzahl bzw. Speicher-kWh × Anzahl).",
    long:
      "Die Anlagengröße ergibt sich aus den hinterlegten Modulleistungen (Wp je Modul) mal Stückzahl; " +
      "die Speichergröße aus der kWh je Speicher mal Stückzahl. Pflege diese Werte am Produkt, dann " +
      "stimmen kWp/kWh und die spezifischen Preise automatisch.",
    category: "Kalkulation",
  },
  {
    id: "calc-schnellkonfig",
    term: "Schnell-Konfiguration",
    short: "Aus kWp + Speicher + Wunsch-Hersteller stellt das Tool automatisch eine komplette Kalkulation zusammen.",
    long:
      "Statt jede Position einzeln zu wählen: Anlagengröße, Speichergröße und bevorzugte Hersteller " +
      "angeben — das Tool wählt passende Module, Wechselrichter, Speicher, Material und Dienstleistungen " +
      "(passend zur Größenklasse). Danach ist alles normal anpassbar.",
    category: "Kalkulation",
  },
  {
    id: "calc-vat-group",
    term: "MwSt je Gruppe (§ 12 Abs. 3 UStG)",
    short: "PV-Anlage und Speicher 0 %, Wallbox/Sonstiges i. d. R. 19 % — je Gruppe getrennt.",
    long:
      "Für Wohn-PV gilt der Nullsteuersatz auf PV-Anlage und Speicher. Andere Leistungen (z. B. Wallbox) " +
      "bleiben bei 19 %. Die Sätze sind je Gruppe getrennt einstellbar; die Summenbox weist die MwSt je " +
      "Satz aus.",
    category: "Kalkulation",
  },
  {
    id: "calc-pauschal",
    term: "Pauschalrabatt / Nachlass / Skonto",
    short: "Pauschalrabatt = % auf die Nettosumme, Nachlass = fester €-Betrag, Skonto = % bei schneller Zahlung.",
    category: "Kalkulation",
  },
  {
    id: "calc-marge",
    term: "Marge (DB)",
    short: "Deckungsbeitrag = Verkauf (netto) − Einkauf. Zeigt, was nach Materialkosten übrig bleibt.",
    long:
      "Die Marge (Deckungsbeitrag) ist die Differenz zwischen Netto-Verkaufssumme und Einkaufssumme " +
      "(EK). Sie zeigt den Rohertrag des Vorgangs vor Lohn-/Fremdkosten. Die Prozentangabe bezieht sich " +
      "auf den Netto-Verkauf.",
    category: "Kalkulation",
  },
  {
    id: "calc-spezifisch",
    term: "Spezifischer Preis (€/kWp, €/kWh)",
    short: "Preis je Kilowatt-Peak bzw. je Kilowattstunde Speicher — zum schnellen Vergleich von Angeboten.",
    category: "Kalkulation",
  },
  {
    id: "calc-hybrid",
    term: "Hybrid-Aufteilung",
    short: "Ein Hybrid-Wechselrichter zählt anteilig zu PV und Speicher (Anteil PV % je Position).",
    long:
      "Ein Hybrid-Wechselrichter gehört technisch zu PV und Speicher. Statt ihn doppelt zu pflegen, gibt " +
      "es einen Anteil »PV %« je Position — der Betrag wird automatisch auf die Töpfe PV-Anlage und " +
      "Speicher verteilt (wichtig für die spezifischen Preise).",
    category: "Kalkulation",
  },
  {
    id: "calc-variant",
    term: "Variante",
    short: "Mehrere Kalkulationen je Projekt (z. B. mit/ohne Speicher). Eine ist als ausgewählt markiert.",
    category: "Kalkulation",
  },

  // — Angebot & Belege —
  {
    id: "offer",
    term: "Angebot",
    short: "Eingefrorene Kalkulation mit Nummer und Status — als PDF druckbar.",
    long:
      "Beim »Angebot erstellen« werden Positionen und Preise eingefroren und mit einer fortlaufenden " +
      "Nummer gespeichert. Status: Entwurf → Versendet → Angenommen/Abgelehnt. Druck über die " +
      "Druckansicht.",
    category: "Angebot & Belege",
  },
  {
    id: "doc-chain",
    term: "Belegkette",
    short: "Auftragsbestätigung → Lieferschein → Rechnung entstehen jeweils aus dem vorigen Beleg.",
    category: "Angebot & Belege",
  },
  {
    id: "abschlag",
    term: "Abschlags-/Schlussrechnung",
    short: "Teilrechnungen (z. B. 30/35/30/5 %); die Schlussrechnung zieht bereits gestellte Abschläge ab.",
    category: "Angebot & Belege",
  },
  {
    id: "open-items",
    term: "Offene Posten / Mahnwesen",
    short: "Unbezahlte/überfällige Rechnungen mit Mahnstufe; »bezahlt« oder »Mahnung« je Zeile.",
    category: "Angebot & Belege",
  },

  // — Vertrieb —
  {
    id: "lead",
    term: "Anfrage / Lead",
    short: "Schnelle Erfassung einer Anfrage als Projekt im Status »Anfrage« mit Vertriebs-Ablauf.",
    category: "Vertrieb",
  },
  {
    id: "task-offer",
    term: "Aufgabe anbieten / annehmen",
    short: "Eine Aufgabe mehreren anbieten — wer zuerst annimmt, bekommt sie (Claim).",
    category: "Vertrieb",
  },

  // — KI & Dokumente —
  {
    id: "ai-classify",
    term: "KI-Dateizuordnung",
    short: "Beim Hochladen erkennt die KI Art und Ziel (Produkt/Projekt) und schlägt die Ablage vor.",
    long:
      "Ziehst du ein PDF/Bild in die Ablage, liest die KI das Dokument (auch Scans, per Bilderkennung), " +
      "bestimmt die Art (Datenblatt, Rechnung, Plan …) und schlägt das Ziel vor (Produkt[e] oder " +
      "Projekt). Du bestätigst mit einem Klick.",
    category: "KI & Dokumente",
  },
  {
    id: "ai-enrich",
    term: "Daten aus dem Netz ziehen",
    short: "Sucht das echte Datenblatt im Web und liest die technischen Daten per KI aus (bitte prüfen).",
    long:
      "Im Produkt kannst du fehlende technische Daten automatisch ergänzen lassen: Das Tool sucht das " +
      "Datenblatt im Internet, die KI extrahiert die Kenndaten und du übernimmst die gewünschten Felder. " +
      "Die Werte immer kurz prüfen (Quellen werden angezeigt).",
    category: "KI & Dokumente",
  },
  {
    id: "ai-assistant",
    term: "KI-Assistent",
    short: "Fragen in natürlicher Sprache zu deinen Daten stellen und Aktionen vorschlagen lassen.",
    category: "KI & Dokumente",
  },

  // — Team & Rollen —
  {
    id: "roles",
    term: "Rollen (Admin / Mitarbeiter)",
    short: "Admin hat Vollzugriff; Mitarbeiter dürfen lesen, anlegen und Eigenes bearbeiten, nicht löschen.",
    category: "Team & Rollen",
  },
  {
    id: "team-view",
    term: "Mitarbeiter-Sicht",
    short: "Admins können die Sicht/Aufgaben eines Mitarbeiters einsehen (nur lesend).",
    category: "Team & Rollen",
  },
];

const BY_ID = new Map(HELP_ENTRIES.map((e) => [e.id, e]));

/** Hilfetext zu einer ID holen (für `HelpTip`). */
export function helpEntry(id: string): HelpEntry | undefined {
  return BY_ID.get(id);
}
