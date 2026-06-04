-- ============================================================================
-- ip³ PV-Tool — Angebots-Textbausteine (Baukasten)
-- Konfigurierbare Textblöcke je Anlagentyp (project_type NULL = Standard).
-- Werden beim Erstellen/Anzeigen eines Angebots zusammengesetzt.
-- Idempotent. Im Supabase SQL-Editor einmal ausführen.
-- ============================================================================

create table if not exists public.offer_text_blocks (
  id            uuid primary key default gen_random_uuid(),
  project_type  text,                       -- NULL = Standard (alle Typen)
  kind          text not null,              -- intro | art_der_anlage | leistung
                                            -- | nicht_enthalten | zahlungsbedingungen
                                            -- | gewaehrleistung | gueltigkeit
                                            -- | liefertermin | optionale_leistungen | schluss
  title         text,
  body          text,
  sort          int not null default 0,
  created_by    uuid references public.employees (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists offer_text_blocks_lookup_idx
  on public.offer_text_blocks (project_type, kind, sort);

alter table public.offer_text_blocks enable row level security;

drop policy if exists "otb_select" on public.offer_text_blocks;
create policy "otb_select" on public.offer_text_blocks for select using (public.is_staff());
drop policy if exists "otb_insert" on public.offer_text_blocks;
create policy "otb_insert" on public.offer_text_blocks for insert with check (public.is_admin());
drop policy if exists "otb_update" on public.offer_text_blocks;
create policy "otb_update" on public.offer_text_blocks for update using (public.is_admin()) with check (public.is_admin());
drop policy if exists "otb_delete" on public.offer_text_blocks;
create policy "otb_delete" on public.offer_text_blocks for delete using (public.is_admin());

-- Standard-Bausteine (nur einfügen, wenn noch keine vorhanden sind).
insert into public.offer_text_blocks (project_type, kind, title, body, sort)
select * from (values
  (null, 'intro', 'Einleitung',
   'Sehr geehrte Damen und Herren,

vielen Dank für Ihr Interesse und Ihr Vertrauen. Gerne unterbreiten wir Ihnen das folgende Angebot für Ihre Photovoltaikanlage. Wir freuen uns auf die Zusammenarbeit.', 0),
  (null, 'art_der_anlage', 'Art der Anlage',
   'Schlüsselfertige Errichtung einer Photovoltaikanlage inkl. Lieferung, Montage, elektrischem Anschluss, Inbetriebnahme sowie Anmeldung beim Netzbetreiber und im Marktstammdatenregister.', 0),
  (null, 'nicht_enthalten', 'Explizit nicht enthalten',
   'Nicht im Angebot enthalten sind: Gerüst (falls erforderlich), Erd- und Tiefbauarbeiten, Anpassungen am Zählerschrank über den beschriebenen Umfang hinaus, behördliche Gebühren sowie bauseitige Leistungen.', 0),
  (null, 'zahlungsbedingungen', 'Zahlungsbedingungen',
   '30 % bei Auftragserteilung, 35 % bei Materiallieferung, 30 % bei Montagebeginn, 5 % nach Inbetriebnahme. Zahlbar ohne Abzug innerhalb von 14 Tagen nach Rechnungserhalt.', 0),
  (null, 'gewaehrleistung', 'Gewährleistung',
   'Es gelten die gesetzlichen Gewährleistungsfristen. Auf Module und Wechselrichter gewähren die Hersteller ihre jeweiligen Produkt- und Leistungsgarantien.', 0),
  (null, 'gueltigkeit', 'Gültigkeit',
   'Dieses Angebot ist freibleibend und 4 Wochen ab Angebotsdatum gültig.', 0),
  (null, 'liefertermin', 'Liefertermin',
   'Der Liefer- und Montagetermin wird nach Auftragseingang und Materialverfügbarkeit gemeinsam abgestimmt.', 0),
  (null, 'optionale_leistungen', 'Optionale Leistungen / Stundensätze',
   'Zusätzliche, nicht im Pauschalpreis enthaltene Arbeiten werden nach Aufwand abgerechnet: Monteur 69,00 €/Std., Elektromeister 89,00 €/Std. (jeweils zzgl. MwSt.).', 0),
  (null, 'schluss', 'Schlusswort',
   'Für Rückfragen stehen wir Ihnen jederzeit gerne zur Verfügung. Wir würden uns freuen, Ihr Projekt umsetzen zu dürfen.', 0)
) as v(project_type, kind, title, body, sort)
where not exists (select 1 from public.offer_text_blocks);
