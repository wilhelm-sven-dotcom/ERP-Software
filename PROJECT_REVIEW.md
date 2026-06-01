# ip³ PV-Tool — Projekt-Review (Stand für externe Prüfung)

> Diese Datei ist für ein Review durch eine andere KI (z. B. ChatGPT) oder
> einen Entwickler gedacht. Sie fasst Ziel, Architektur, Umsetzungsstand und
> bekannte offene Punkte zusammen. **Bitte kritisch prüfen** — Schwerpunkte
> stehen unten unter „Review-Fragen".

## 1. Worum geht es?

Neuaufbau eines bestehenden **PV-/Speicher-Vertriebstools (CRM)** der Firma
*ip³ Energietechnik*. Das Alt-System war eine einzelne ~17.000-Zeilen-HTML-Datei
mit lokalem Browser-Speicher (IndexedDB), globalem State und Lauf­zeit-
Monkey-Patching. Ziel des Neuaufbaus: **wartbar, modular, mehrbenutzerfähig,
online (Vercel), gemeinsame Datenbank (Supabase)**.

Die Alt-Datei liegt als Referenz unter `legacy/ip3_PV_Tool_6_19.html` und enthält
die verbindliche Fachlogik (vor allem Kalkulation & Wirtschaftlichkeit). Die
Geschäftslogik wurde daraus 1:1 übernommen (siehe Abschnitt 5).

## 2. Tech-Stack

- **Next.js 16** (App Router) + **React 19** + **TypeScript (strict)**
- **Tailwind CSS v4** + **shadcn/ui**-Komponenten (manuell eingebunden)
- **Supabase**: PostgreSQL, Auth (E-Mail/Passwort), Row-Level-Security, Storage (geplant)
- **Hosting:** Vercel (Auto-Deploy). UI-Sprache **Deutsch**, Code/DB-Spalten **Englisch** (snake_case).

## 3. Architektur / Konventionen

- **Route Groups:** `(auth)` = Login ohne Shell, `(app)` = alle Module mit App-Shell
  (Sidebar mit 14 Modulen, Topbar, Theme Hell/Dunkel/System).
- **Datenzugriff:** lesend über `src/lib/data/*` (Server-Komponenten), schreibend über
  **Server Actions** je Modul (`src/app/(app)/<modul>/actions.ts`).
- **Auth/Rechte:** Supabase-Auth + **RLS in der DB als Wahrheit**; Frontend-Checks nur fürs UX.
- **Kein globaler mutabler State**, keine Doppelfunktionen, „eine Sache pro Datei".
- App läuft auch **ohne** Supabase-Keys (zeigt dann Hinweis statt Daten) — `isSupabaseConfigured()`-Guard.

## 4. Datenmodell (Postgres, 12 Tabellen)

`customers, projects, activities, products, product_groups, product_assets,
employees, offer_templates, calc_templates, calculations, settings, change_log`

- Jede Entität hat `legacy_id` (für Import des Alt-Backups; FK-Auflösung darüber).
- **RLS** auf allen Tabellen. Helfer: `is_admin()`, `is_staff()`, `current_employee_id()`.
  - Admin: voll. Mitarbeiter: lesen + anlegen + eigene/zugewiesene bearbeiten, **kein Löschen**.
  - `change_log` nur für Admin lesbar; wird per **Trigger** (`log_audit`) befüllt.
- **Auth-Bootstrap:** Trigger `handle_new_user` legt je Auth-User automatisch einen
  `employees`-Eintrag an (robust gegen Fehler, blockiert Login nie).
- SQL liegt in `supabase/migrations/*.sql` (+ `setup_all.sql` als Komplett-Skript,
  `reset.sql`, `seed.sql`). Lokal in Postgres 16 validiert: 12 Tabellen, 41 Policies.

## 5. Fachlogik (1:1 aus Legacy übernommen) — BITTE BESONDERS PRÜFEN

### 5a. Kalkulation — `src/lib/calc/engine.ts`
Nachbau der Legacy-Funktion `calculateSum`. **Nicht-kommutative Rabatt-Kaskade:**
```
1) Positionsrabatt:  vkSum         = menge * einzelpreis * (1 - rabatt/100)   (je Position)
2) Gruppenrabatt:    vkNachGroup   = vkSum * (1 - gruppenRabatt[group]/100)   (je Gruppe)
                     nettoVorPauschal = Σ vkNachGroup
3) Pauschalrabatt:   netto         = nettoVorPauschal * (1 - pauschalRabatt/100)
4) Nachlass (€):     netto         = netto - nachlass
5) MwSt:             mwstBetrag    = netto * mwstSatz/100 ; brutto = netto + mwstBetrag
6) Skonto (auf BRUTTO!): skontoBetrag = brutto * skonto/100 ; bruttoNachSkonto = brutto - skontoBetrag
7) Marge:            marge = netto - ekGesamt ; margeProzent = marge/netto*100
```
Gruppen: `PV-Anlage | Speicher | Wallbox | Sonstiges`. MwSt-Standard 19 %, PV-Nullsteuersatz = 0.
Tests: `npm run test:calc` (`src/lib/calc/engine.test.ts`).

### 5b. Wirtschaftlichkeit — `src/lib/calc/wirtschaft.ts`
Nachbau von `computeWirtschaft`/`defaultWirtschaft`.
```
ertragJahr1            = kwp * ertragKwhProKwp            (Default 950 kWh/kWp)
eigenverbrauchProzent  = eigenverbrauchsAnteil (30); falls Speicher>0: min(80, +25)
je Jahr y (1..laufzeit, Default 25):
  eigen = ertrag * eigenverbrauchProzent/100
  einsp = ertrag - eigen
  cf    = eigen*kostenSatz + einsp*einspeiseverguetung
  cumCF += cf   (Start: -investBrutto; Amortisation = erstes Jahr cumCF>=0)
  ertrag    *= (1 - degradation/100)          (Default 0,5 %/J)
  kostenSatz*= (1 + strompreissteigerung/100) (Default 3 %/J; Einspeisung konstant)
renditeProzent = ((summeErloese - invest)/invest*100) / laufzeit   (einfacher Schnitt, KEIN IRR/NPV)
```
Defaults: Strompreis 0,32 €/kWh, Einspeisung 0,0786 €/kWh. Investition = Brutto aus Kalkulation.
Bewusst NICHT enthalten (wie im Original): IRR/NPV-Diskontierung, Betriebskosten, Steuern/AfA,
Speicher-Wirkungsgradverluste. Tests: `npm run test:wirtschaft`.

## 6. Module (alle 14 umgesetzt)

Dashboard · Projekte · Aktives Projekt · Pipeline · Kunden · Kalkulation · Angebot ·
Wirtschaftlichkeit · Vorlagen · Produkte · Mitarbeiter · Einstellungen · Backup · Hilfe.

- **Kunden/Produkte/Projekte:** Liste, Detail, CRUD (Dialoge), Aktivitäten-Timeline.
- **Pipeline:** Status-Spalten + Schnellwechsel. **Dashboard:** KPIs + neueste Projekte.
- **Kalkulation:** Live-Editor mit Positionen, Produktübernahme, Rabatten, Summen → speichert je Projekt.
- **Angebot:** druckbares Dokument aus Kalkulation + Firmendaten (Browser-Druck → PDF).
- **Wirtschaftlichkeit:** interaktiver Rechner + Cashflow-Tabelle.
- **Mitarbeiter/Einstellungen:** Admin-geschützt. **Backup:** JSON-Export (Admin) via Route Handler.

## 7. Qualitätsstand

- `npm run build` grün, `npm run lint` 0 Errors.
- Engine-Unit-Tests grün (`test:calc`, `test:wirtschaft`).
- SQL in lokaler Postgres-16 validiert.
- **Login + DB-Verbindung produktiv auf Vercel verifiziert.**

## 8. ⚠️ Offene Punkte / noch NICHT erledigt (ehrlich)

1. **End-to-End mit echten Daten** gerade erst gestartet — die einzelnen Module wurden
   noch nicht systematisch mit realen Datensätzen durchgeklickt (Verifikations-Checkliste in `supabase/SETUP.md`).
2. **Kalkulations-Summen** sollten gegen eine **echte Alt-Kalkulation** gegengerechnet werden
   (Formeln aus minifiziertem Legacy-Code abgeleitet — plausibel & getestet, aber nicht
   gegen Echtbeleg verifiziert). Edge-Cases (Rundung pro Position vs. Summe) prüfen.
3. **Alt-Daten-Import** (`scripts/import-legacy.ts`) noch nicht mit echtem Backup gelaufen;
   Feld-Mapping (deutsch/englisch gemischt) ggf. nachschärfen.
4. **Produkt-Datenblätter/Bilder** (Supabase Storage) noch nicht angebunden.
5. **PWA & Dark-Mode-Politur** (Phase 4) offen.
6. **Vorlagen** aktuell nur Anzeige (kein Editor); **Angebote** werden nicht als eigene
   Entität gespeichert (Dokument wird live aus der Kalkulation erzeugt).
7. **Pipeline-Status-Werte**: aus Legacy abgeleitet (`Anfrage/Angebot/Auftrag/Entwurf/gewonnen/verloren`) — mit Fachseite abgleichen.
8. Kein E2E-Test-Framework (Playwright o. Ä.); nur Unit-Tests der Rechen-Engines.

## 9. Review-Fragen (worauf ich Feedback suche)

- **Korrektheit der Kalkulations-Kaskade** (Abschnitt 5a): Reihenfolge, Rundung, Skonto auf Brutto — sinnvoll/branchenüblich?
- **Wirtschaftlichkeit** (5b): Ist die einfache Durchschnittsrendite vertretbar, oder sollte IRR/NPV ergänzt werden? Eigenverbrauchs-Heuristik (+25/max 80) ok?
- **RLS-Policies:** Lücken? Sollten Mitarbeiter wirklich nicht löschen dürfen? `change_log` nur Admin — passt das?
- **Datenmodell:** Fehlen Felder/Beziehungen? `calculations` 1:n je Projekt (Varianten) sinnvoll abgebildet?
- **Sicherheit:** Server Actions prüfen Rollen zusätzlich zur RLS — ausreichend? `service_role`-Key nur serverseitig (Backup/Import) — korrekt isoliert?
- **Architektur:** Next-App-Router-Nutzung (Server Components + Actions) idiomatisch?

## 10. Wichtige Dateien zum Reinschauen

- Fachlogik: `src/lib/calc/engine.ts`, `src/lib/calc/wirtschaft.ts` (+ `*.test.ts`)
- Datenmodell/Rechte: `supabase/migrations/*.sql`, `supabase/setup_all.sql`
- Datenzugriff: `src/lib/data/*.ts`; Schreiben: `src/app/(app)/*/actions.ts`
- Auth/Guards: `src/lib/supabase/*.ts`, `middleware.ts`
- Projektkontext/Regeln: `CLAUDE.md`

**Repo:** `wilhelm-sven-dotcom/ERP-Software`, Branch `claude/awesome-darwin-F4Gzq`
(inhaltsgleich auf `main`). ~7.000 Zeilen TypeScript in ~100 Dateien.
