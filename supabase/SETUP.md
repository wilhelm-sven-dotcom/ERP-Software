# Supabase einrichten & verbinden

Diese Anleitung verbindet die App mit einem Supabase-Projekt und spielt das
Datenmodell ein. Danach kann jedes Modul end-to-end getestet werden.

## 1. Supabase-Projekt anlegen
1. Auf <https://supabase.com> einloggen → **New project**.
2. Projektname, DB-Passwort und Region (z. B. *Central EU (Frankfurt)*) wählen.
3. Warten, bis das Projekt bereitsteht.

## 2. Keys eintragen
Im Dashboard unter **Project Settings → API**:
- `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
- `anon public` Key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `service_role` Key (geheim!) → `SUPABASE_SERVICE_ROLE_KEY` (nur lokal für den Import)

`.env.local` aus der Vorlage erstellen und füllen:
```bash
cp .env.local.example .env.local
# danach die drei Werte eintragen
```

## 3. Datenmodell einspielen
Im Supabase-Dashboard **SQL Editor** öffnen und die Migrationen **in dieser
Reihenfolge** ausführen (Inhalt jeweils einfügen und „Run"):
1. `supabase/migrations/20260531120000_schema.sql`
2. `supabase/migrations/20260531120100_rls.sql`
3. `supabase/migrations/20260531120200_audit.sql`
4. `supabase/migrations/20260531120300_auth_bootstrap.sql`
5. `supabase/migrations/20260531120400_defaults.sql`
6. `supabase/seed.sql`

> Alternativ mit Supabase CLI: `npx supabase link` + `npx supabase db push`.

## 4. Ersten Nutzer + Admin anlegen
1. App starten (`npm run dev`) → `/login`.
2. In Supabase **Authentication → Users → Add user** einen Nutzer mit E-Mail/
   Passwort anlegen (oder Self-Signup aktivieren).
3. Der Trigger legt automatisch einen `employees`-Eintrag an. Diesen zum Admin
   machen (SQL Editor):
   ```sql
   update public.employees set role = 'admin' where email = 'DEINE@MAIL';
   ```

## 5. (Optional) Alt-Daten importieren
Backup aus dem alten Tool als `scripts/legacy-backup.json` ablegen, dann:
```bash
npm run import:legacy
```

## 6. Auf Vercel deployen
In den Vercel-Projekt-**Environment Variables** dieselben drei Keys hinterlegen
(`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`) und neu deployen.

---

# Verifikations-Checkliste (nach dem Verbinden)

- [ ] `/login`: Anmeldung mit dem angelegten Nutzer funktioniert; ohne Login
      wird auf `/login` umgeleitet (Middleware-Schutz greift).
- [ ] **Kunden**: anlegen → erscheint in Liste mit fortlaufender Nr.; bearbeiten;
      Aktivität hinzufügen → erscheint in der Timeline.
- [ ] **Produkte**: Gruppe anlegen; Produkt mit EK/VK anlegen; bearbeiten.
- [ ] **Projekte**: anlegen (Kunde/Bearbeiter/Status); Detail zeigt Logbuch;
      „Aktives Projekt" leitet auf das zuletzt bearbeitete Projekt.
- [ ] **Pipeline**: Projekt erscheint in der richtigen Status-Spalte;
      Status-Schnellwechsel verschiebt es.
- [ ] **Dashboard**: KPIs zählen korrekt; neueste Projekte gelistet.
- [ ] **Kalkulation**: Projekt wählen → Positionen erfassen; Summen live;
      0 %/19 % MwSt korrekt; speichern und erneut laden zeigt dieselben Werte.
- [ ] **Mitarbeiter**: als Admin Rolle ändern; als Mitarbeiter nur lesbar.
- [ ] **Einstellungen**: Firmendaten speichern (nur Admin).
- [ ] **Backup**: als Admin JSON-Export lädt herunter und enthält alle Stores.
- [ ] **Rollen/RLS**: Mitarbeiter kann fremde Datensätze NICHT löschen;
      `change_log` nur für Admin sichtbar.
- [ ] **Dark Mode**: Umschaltung Hell/Dunkel/System bleibt nach Reload erhalten.

## Kalkulation gegen das Altsystem abgleichen
Die Rechen-Engine (`src/lib/calc/engine.ts`) bildet die bestätigte Legacy-
Summenstruktur ab (Positionsrabatt, Gesamtrabatt, Zuschlag, MwSt inkl.
0 %-Nullsteuersatz, Deckungsbeitrag/Marge). **Vor dem Produktivgang** eine reale
Kalkulation aus dem alten Tool nachrechnen und die Summen vergleichen; bei
Abweichungen die Formeln in `engine.ts` anpassen (Tests in `engine.test.ts`
ergänzen). `npm run test:calc` prüft die Engine isoliert.

---

## Neue Migrationen (UX-Paket 5 & 6)

Im Supabase SQL-Editor **einmal** in dieser Reihenfolge ausführen (oder
`setup_all.sql` neu einspielen — alle Schritte sind idempotent):

1. `20260531121300_project_type.sql` — Projekttyp/Anlagentyp
2. `20260531121400_text_blocks.sql` — Angebots-Textbausteine (+ Standard-Seed)
3. `20260531121500_documents.sql` — Auftragsbestätigung & Lieferschein
4. `20260531121600_workflow.sql` — Ablauf-Vorlagen, Schritte, Aufgaben (+ Seed)
5. `20260531121800_time_tracking.sql` — Zeiterfassung + Stundensätze
6. `20260531121900_user_integrations.sql` — Google-OAuth-Tokens je Mitarbeiter

Danach in den **Einstellungen** das Firmenlogo hochladen und die
Textbausteine/Ablauf-Schritte je Anlagentyp prüfen. Für die Nachkalkulation
unter **Mitarbeiter** je Person den internen Stundensatz hinterlegen (oder
global `settings.labor_rate`).

## Google-Kalender anbinden (read-only, optional)

Jeder Mitarbeiter verbindet seinen eigenen Google-Kalender; gelesen wird nur
(keine Schreibzugriffe).

1. **Google-Cloud-Projekt** anlegen (console.cloud.google.com).
2. **Google Calendar API** aktivieren (APIs & Dienste → Bibliothek).
3. **OAuth-Zustimmungsbildschirm** konfigurieren (intern, falls Workspace;
   sonst „extern" + Testnutzer eintragen). Scope
   `.../auth/calendar.readonly` hinzufügen.
4. **OAuth-Client-ID** (Typ „Webanwendung") erstellen. Autorisierte
   Redirect-URI: `https://DEINE-DOMAIN/api/google/oauth/callback`
   (lokal: `http://localhost:3000/api/google/oauth/callback`).
5. In Vercel/`.env.local` setzen: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
   (und optional `GOOGLE_OAUTH_REDIRECT`). Voraussetzung ist außerdem ein
   gesetzter `SUPABASE_SERVICE_ROLE_KEY` (Token-Speicherung).
6. In den **Einstellungen** auf „Mit Google verbinden" klicken. Die Termine
   erscheinen danach im Dashboard.

Hinweis: Bei vielen externen Nutzern verlangt Google ggf. eine App-Prüfung;
für den internen Gebrauch genügen Testnutzer bzw. der App-Typ „intern".

## ChatGPT / OpenAI (intelligente Suche, Assistent, KI-Dateiablage)

Optional. Ohne `OPENAI_API_KEY` ist die KI schlicht aus — Suche und Datei-Ablage
funktionieren wie bisher. Mit Key:

- In der globalen Suche (⌘K) und im Dashboard-Suchfeld liefert **Enter** eine
  interpretierte Antwort auf Deutsch und hebt die relevanten Treffer hervor;
  freie/allgemeine Fragen sind möglich.
- Hochgeladene PDFs werden im Volltext durchsuchbar (Datenblätter, Dokumente,
  Service-Anhänge) — dafür einmalig die Migration `20260603000100_file_text.sql`
  im SQL-Editor ausführen.
- Beim Reinziehen von Dateien schlägt die KI Ziel + Ablage-Art vor und liest bei
  Rechnungen/Dokumenten Lieferant, Nummer, Datum, Fälligkeit und Betrag aus
  (Vorschlag + 1-Klick bestätigen).

1. OpenAI-Konto + API-Key erstellen (platform.openai.com → API keys).
2. In Vercel/`.env.local` setzen: `OPENAI_API_KEY` (optional `OPENAI_MODEL`,
   Default `gpt-4o-mini`).
3. Migration `20260603000100_file_text.sql` ausführen (Volltext + Beleg-Metadaten).

Hinweis (Kosten/DSGVO): Pro Anfrage entstehen geringe Kosten (Cent-Bereich);
knappe Treffer- bzw. Dokumentdaten werden an OpenAI übermittelt. Für strengere
Anforderungen kommt später z. B. Azure-OpenAI (EU) infrage.
