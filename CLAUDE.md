# CLAUDE.md — ip³ PV-Tool (Neuaufbau)

> Diese Datei wird von Claude Code bei jedem Start automatisch gelesen.
> Sie ist der verbindliche Kontext für das gesamte Projekt. Halte sie aktuell.

---

## 1. Ziel & Hintergrund

Wir bauen das bestehende **ip³ PV-Tool** (eine Vertriebs-/CRM-Software für
Photovoltaik- und Speicherprojekte) von einer einzelnen ~17.000-Zeilen-HTML-Datei
in eine **moderne, modulare Web-App** um.

**Warum der Neuaufbau:**
- Die alte Version ist eine einzige HTML-Datei mit globalem State, ~450 Funktionen,
  Doppel-Funktionen und Laufzeit-Monkey-Patching → jeder Fix riskierte neue Bugs.
- Neue Ziele: **wartbar, schnell editierbar, deutlich weniger Bugs, mehrbenutzerfähig
  (mehrere Kollegen greifen auf dieselben Daten zu), online über Vercel.**

**Die alte Datei liegt im Repo unter `/legacy/ip3_PV_Tool_6_19.html`.**
Das ist die wichtigste Referenz. Sie enthält die **exakte Fachlogik** (vor allem
Kalkulation und Wirtschaftlichkeit). Beim Nachbau eines Moduls **immer zuerst die
entsprechende Logik im Legacy-File lesen und 1:1 übernehmen** – Formeln und
Geschäftsregeln NICHT neu erfinden.

---

## 2. Goldene Regeln (Anti-Patterns aus der alten Version)

Diese Regeln sind nicht verhandelbar. Sie verhindern genau die Fehler, die das alte
Tool unwartbar gemacht haben.

1. **Kein globaler mutabler State.** Daten kommen aus der Datenbank (Supabase) bzw.
   aus typisierten React-States/Server-Komponenten. Kein zentrales `window.STATE`.
2. **Keine doppelten Funktionen / keine `_v`-Versionen.** Eine Funktion existiert
   genau einmal. Wenn etwas geändert wird, wird die bestehende Funktion ersetzt,
   nicht daneben eine zweite angelegt.
3. **Kein Monkey-Patching.** Nie eine bestehende Funktion zur Laufzeit „umwickeln"
   (`orig.call(...)`). Verhalten wird im Code geändert, nicht gestapelt.
4. **TypeScript strict.** `strict: true`. Keine `any` ohne sehr guten Grund.
   Datentypen werden zentral definiert und wiederverwendet.
5. **Komponenten statt String-HTML.** Kein `innerHTML = "..."`. UI = React-Komponenten.
6. **Eine Sache pro Datei.** Module, Komponenten, Hilfsfunktionen leben in eigenen,
   klar benannten Dateien. Keine Tausend-Zeilen-Dateien.
7. **Rechte gehören in die Datenbank** (Supabase Row-Level-Security), nicht (nur) ins
   Frontend. Frontend-Checks sind nur fürs UX, die DB ist die Wahrheit.
8. **Klein committen.** Pro Modul/Feature ein eigener Branch und kleine Commits.
   Erst testen lassen, dann mergen. Ein Fehler darf nie größer als ein Modul sein.

---

## 3. Tech-Stack

| Bereich        | Technologie                                  |
|----------------|----------------------------------------------|
| Framework      | **Next.js** (App Router) + **TypeScript**    |
| Styling        | **Tailwind CSS** + **shadcn/ui**             |
| Datenbank      | **Supabase** (PostgreSQL)                    |
| Auth           | **Supabase Auth** (E-Mail/Passwort)          |
| Datei-Storage  | **Supabase Storage** (Produkt-Datenblätter)  |
| Hosting        | **Vercel** (Auto-Deploy bei Git-Push)        |
| Versionierung  | **GitHub**                                   |

**Sprache:** UI-Texte auf **Deutsch** (wie im Original). Code, Variablen, Tabellen-
und Spaltennamen auf **Englisch** (Standard, snake_case in der DB).

**Dark Mode & PWA** sind Bestandteil (waren im Original vorhanden) – am Ende wieder
einbauen (Phase 4).

---

## 4. Projektstruktur (Zielbild)

```
/
├── CLAUDE.md                  ← diese Datei
├── legacy/
│   └── ip3_PV_Tool_6_19.html  ← alte Version als Referenz (NICHT verändern)
├── src/
│   ├── app/                   ← Next.js App Router (Seiten = Module)
│   │   ├── (auth)/login/
│   │   ├── dashboard/
│   │   ├── projekte/
│   │   ├── kunden/
│   │   ├── kalkulation/
│   │   ├── angebot/
│   │   ├── wirtschaft/
│   │   ├── pipeline/
│   │   ├── produkte/
│   │   ├── vorlagen/
│   │   ├── mitarbeiter/
│   │   ├── einstellungen/
│   │   └── layout.tsx          ← Sidebar + Topbar (App-Shell)
│   ├── components/            ← wiederverwendbare UI-Komponenten
│   │   └── ui/                ← shadcn-Komponenten
│   ├── lib/
│   │   ├── supabase/          ← Supabase-Client (server & client)
│   │   ├── types.ts           ← zentrale TypeScript-Typen
│   │   └── calc/              ← Kalkulations-/Wirtschaftlichkeits-Logik
│   └── hooks/                 ← React-Hooks (Datenzugriff etc.)
├── supabase/
│   ├── migrations/            ← SQL-Migrationen (Tabellen, RLS-Policies)
│   └── seed.sql               ← Standard-Daten / Test-Daten
├── scripts/
│   └── import-legacy.ts       ← Import des alten JSON-Backups → Supabase
└── .env.local                 ← Supabase-Keys (NICHT committen)
```

---

## 5. Datenmodell

Die alte App nutzte IndexedDB (`DB_NAME = 'ip3_pv_tool_v6'`) mit **12 Stores**.
Diese werden zu Postgres-Tabellen. **Baseline unten – die exakten Felder beim Bauen
gegen `/legacy` prüfen und ergänzen.**

| Alt-Store (IndexedDB) | Neue Tabelle (Postgres) | Zweck                                  |
|-----------------------|-------------------------|----------------------------------------|
| `customers`           | `customers`             | Kunden (mit fortlaufender Kundennr.)   |
| `projects`            | `projects`              | Projekte (Kern-Entität)                |
| `activities`          | `activities`            | Aktivitäten/Logbuch (Timeline)         |
| `products`            | `products`              | Produktkatalog                         |
| `productGroups`       | `product_groups`        | Produktgruppen/-kategorien             |
| `productAssets`       | `product_assets`        | Datenblätter/Bilder (→ Storage)        |
| `employees`           | `employees`             | Mitarbeiter (verknüpft mit Auth+Rolle) |
| `templates`           | `offer_templates`       | Angebotsvorlagen                       |
| `calcTemplates`       | `calc_templates`        | Kalkulationsvorlagen                   |
| `calc`                | `calculations`          | Kalkulation je Projekt                 |
| `settings`            | `settings`              | Firmendaten, Logo, Defaults (key/value)|
| `changeLog`           | `change_log`            | Audit-Log (Änderungsverlauf)           |

**Vorgeschlagene Kernspalten (Baseline, gegen Legacy verifizieren):**

```sql
-- customers
id uuid pk, customer_nr int unique, kind text,            -- 'privat' | 'gewerbe'
company text, salutation text, first_name text, last_name text,
email text, phone text, mobile text,
street text, zip text, city text, notes text,
created_by uuid, created_at timestamptz, updated_at timestamptz

-- projects
id uuid pk, customer_id uuid fk->customers,
title text, status text,                                   -- Pipeline-Stufe
assigned_employee_id uuid fk->employees,
street text, zip text, city text,
system_size_kwp numeric, notes text,
created_by uuid, created_at timestamptz, updated_at timestamptz

-- activities  (Logbuch / Timeline)
id uuid pk, project_id uuid fk->projects, customer_id uuid fk->customers,
type text, title text, body text,
employee_id uuid fk->employees, created_at timestamptz

-- products
id uuid pk, group_id uuid fk->product_groups,
name text, manufacturer text, category text, sku text,
price_purchase numeric, price_sell numeric, unit text,
specs jsonb,                                               -- techn. Daten flexibel
created_at timestamptz, updated_at timestamptz

-- product_groups
id uuid pk, name text, parent_id uuid, sort int

-- product_assets
id uuid pk, product_id uuid fk->products,
kind text,                                                 -- 'datasheet' | 'image'
name text, storage_path text, created_at timestamptz

-- employees
id uuid pk, auth_user_id uuid fk->auth.users,
name text, email text,
role text not null default 'mitarbeiter',                  -- 'admin' | 'mitarbeiter'
active boolean default true

-- offer_templates
id uuid pk, name text, kind text, content jsonb, created_at timestamptz

-- calc_templates
id uuid pk, name text, positions jsonb, defaults jsonb, created_at timestamptz

-- calculations  (je Projekt)
id uuid pk, project_id uuid fk->projects,
positions jsonb, totals jsonb, margin numeric,
created_at timestamptz, updated_at timestamptz

-- settings  (key/value)
key text pk, value jsonb

-- change_log  (Audit)
id uuid pk, entity_type text, entity_id uuid, action text, -- 'create'|'update'|'delete'
before jsonb, after jsonb, employee_id uuid, created_at timestamptz
```

> Das Audit-Log (`change_log`) bildet die alte `dbPutWithAudit`/`dbDelWithAudit`-Logik
> nach. Es wird per Datenbank-Trigger oder zentralem Schreib-Helper befüllt – nicht in
> jeder Funktion einzeln.

---

## 6. Auth & Rollen (Admin / Mitarbeiter)

Ersetzt die alte Frontend-Logik `canView` / `canEdit` / `canDelete` durch
**Supabase Row-Level-Security (RLS)**.

- **Auth:** Supabase Auth (E-Mail/Passwort). Jeder `employees`-Eintrag ist über
  `auth_user_id` mit einem Auth-User verknüpft.
- **Rollen:** Spalte `employees.role` = `'admin'` oder `'mitarbeiter'`.
- **RLS auf JEDER Tabelle aktivieren.** Grundregeln:
  - **Admin:** voller Lese-/Schreib-/Löschzugriff auf alles.
  - **Mitarbeiter:** darf alles **lesen**, darf **anlegen** und **eigene/zugewiesene**
    Datensätze **bearbeiten**; **kein Löschen** (anpassbar).
- Helfer-Funktion in SQL: aktuelle Rolle über `auth.uid()` → `employees.role` auflösen
  und in den Policies verwenden.
- **Mitarbeiter-Modul:** Admin legt Mitarbeiter an, vergibt Rollen, lädt per E-Mail ein.

> Die genaue Rechte-Granularität pro Tabelle beim Bauen mit Sven abstimmen. Default oben
> ist bewusst eher restriktiv für Mitarbeiter.

---

## 7. Module & Build-Reihenfolge

Die alte App hatte **14 Navigationspunkte**. Reihenfolge bewusst nach Abhängigkeit –
jedes Modul baut auf dem vorigen auf. **Pro Modul: bauen → testen → Daten importieren →
nächstes.**

1. **Fundament** (App-Shell: Sidebar, Topbar, Navigation, Login, Theme-Grundgerüst)
2. **Datenmodell + RLS** (alle Tabellen, Policies, Import-Skript)
3. **Kunden** (`kunden`) — Liste, Detail, Anlegen/Bearbeiten, Aktivitäten-Timeline
4. **Produkte** (`produkte`) — Katalog, Gruppen, Datenblatt-Assets (Storage)
5. **Projekte / Aktives Projekt** (`projekte`, `projekt-detail`) — Kern-Entität, Logbuch
6. **Kalkulation** (`kalkulation`) — ⚠️ Fachlogik aus `/legacy` übernehmen
7. **Angebot** (`angebot`) — baut auf Kalkulation auf, Druck/Export
8. **Wirtschaftlichkeit** (`wirtschaft`) — ⚠️ Fachlogik aus `/legacy` übernehmen
9. **Pipeline** (`pipeline`) — Ansicht/Filter über Projekte nach Status
10. **Dashboard** (`dashboard`) — Kennzahlen, aggregiert über alles
11. **Vorlagen** (`vorlagen`) — Angebots-/Kalkulationsvorlagen
12. **Einstellungen** (`settings`) — Firmendaten, Logo, Defaults
13. **Backup** (`backup`) — Export/Import (jetzt aus Supabase)
14. **Hilfe** (`hilfe`)

**Pro Modul abhaken:**
- [ ] Relevante Logik im `/legacy`-File gelesen
- [ ] Datentypen in `src/lib/types.ts` definiert
- [ ] Tabelle(n) + RLS vorhanden und getestet
- [ ] UI-Komponente(n) gebaut (shadcn/ui, deutsch)
- [ ] CRUD funktioniert (anlegen/lesen/ändern/löschen je nach Rolle)
- [ ] Alte Daten importiert und geprüft
- [ ] Auf Vercel deployt und im Browser getestet
- [ ] Commit + Merge

---

## 8. Roadmap / Schritte

### Phase 0 — Setup (manuell, einmalig)
- Accounts anlegen: **GitHub**, **Vercel**, **Supabase**.
- **Node.js LTS** installieren (für Next.js).
- Neues GitHub-Repo erstellen, lokal klonen.
- Altes Backup im jetzigen Tool exportieren (Backup-Modul → JSON) und unter
  `scripts/legacy-backup.json` ablegen.
- Alte HTML-Datei nach `/legacy/ip3_PV_Tool_6_19.html` kopieren.

### Phase 1 — Fundament
- Next.js + TypeScript + Tailwind + shadcn/ui initialisieren.
- Supabase-Projekt verbinden (`.env.local`), Supabase-Clients (server/client) anlegen.
- Login-Seite + Auth (Supabase Auth).
- App-Shell: Sidebar mit den 14 Modulen, Topbar, Routing.
- **Einmal komplett auf Vercel deployen und testen, BEVOR Features kommen.**
  → Pipeline GitHub → Vercel muss nachweislich laufen.

### Phase 2 — Datenmodell + Rechte
- Alle Tabellen aus Abschnitt 5 als Migration anlegen.
- RLS auf allen Tabellen aktivieren, Admin/Mitarbeiter-Policies (Abschnitt 6).
- `change_log` per Trigger/Helper befüllen.
- Import-Skript `scripts/import-legacy.ts`: `legacy-backup.json` → Supabase-Tabellen.

### Phase 3 — Module
- Reihenfolge aus Abschnitt 7, Modul für Modul, je mit Checkliste.

### Phase 4 — Politur & Umstieg
- Dark Mode + PWA wieder einbauen.
- Rollen mit echten Test-Logins (Admin + Mitarbeiter) durchspielen.
- Team umstellen; altes Tool als Notfall-Backup behalten, bis das Neue rund läuft.

---

## 9. Git-Workflow

- `main` = immer deploybar/grün.
- Pro Modul/Feature ein Branch: `feat/kunden`, `feat/kalkulation`, …
- Kleine, häufige Commits mit klarer Nachricht (z.B. `feat(kunden): Detailansicht + Timeline`).
- Vor dem Merge: lokal testen, Build prüfen.
- Vercel deployt `main` automatisch; Branches als Preview-Deployments.

---

## 10. Befehle (Cheat-Sheet)

```bash
# Projekt starten (Phase 1)
npx create-next-app@latest . --typescript --tailwind --app

# shadcn/ui einrichten
npx shadcn@latest init
npx shadcn@latest add button input table dialog ...   # Komponenten nach Bedarf

# Entwicklung
npm run dev            # lokaler Dev-Server
npm run build          # Produktions-Build prüfen

# Supabase (lokal/CLI, optional)
npx supabase init
npx supabase migration new <name>
npx supabase db push
```

> Genaue/aktuelle Befehle ggf. in den offiziellen Docs prüfen
> (Next.js, shadcn/ui, Supabase) – Versionen ändern sich.

---

## 11. So fährst du Claude Code

- **Pro Modul eine fokussierte Session.** Nicht versuchen, alles auf einmal zu bauen.
- **Immer auf das Legacy-File verweisen**, wenn Fachlogik gefragt ist.
- **Erst Plan, dann Code.** Claude Code soll bei größeren Schritten erst den Plan
  zeigen, dann umsetzen.
- Diese `CLAUDE.md` aktuell halten, wenn sich Entscheidungen ändern.

**Erster Befehl für Claude Code (nach Phase 0):**

> „Lies CLAUDE.md. Wir starten mit Phase 1 (Fundament). Richte ein Next.js-Projekt mit
> TypeScript, Tailwind und shadcn/ui ein, baue die App-Shell (Sidebar mit den 14 Modulen
> aus Abschnitt 7, Topbar, Routing) und eine Login-Seite mit Supabase Auth. Zeig mir
> zuerst den Plan, dann setz es um. Ziel: lauffähig und auf Vercel deploybar, noch ohne
> Fachfunktionen."

**Muster-Befehl pro Fachmodul (Beispiel Kalkulation):**

> „Wir bauen das Modul Kalkulation. Lies zuerst die Kalkulations-Logik in
> `/legacy/ip3_PV_Tool_6_19.html` (Funktionen rund um `renderKalkulation`,
> `getActiveCalculation`, Positionen/Summen) und übernimm die Formeln 1:1. Definiere die
> Typen in `src/lib/types.ts`, lege/prüfe Tabelle `calculations`, baue die UI mit
> shadcn/ui. Zeig mir den Plan, dann umsetzen."
