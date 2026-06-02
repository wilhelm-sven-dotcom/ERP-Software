-- ============================================================================
-- ip³ PV-Tool — Vertriebsprozess + Ablauf-Abhängigkeiten (UX-Paket 9)
--   • employees.is_sales  → Mitarbeiter als „Vertrieb" kennzeichnen
--   • projects.source      → Quelle der Anfrage (Telefon/Web/Empfehlung …)
--   • workflow_templates.phase ('vertrieb' | 'projekt')
--   • workflow_steps.group_label → Phase für die Aufgaben-Gruppierung
--   • workflow_step_deps / project_task_deps → Vorgänger (Abhängigkeiten)
--   • project_tasks.status erweitert um 'wartet' (reine Logik, kein CHECK)
--   • Seed: Vertriebsablauf-Vorlage + Vorgänger der Standard-Projektvorlagen
-- Idempotent. Im Supabase SQL-Editor einmal ausführen.
-- ============================================================================

-- 1. Vertriebs-Kennzeichen je Mitarbeiter
alter table public.employees add column if not exists is_sales boolean not null default false;

-- 2. Quelle der Anfrage am Projekt
alter table public.projects add column if not exists source text;

-- 3. Phase der Vorlage: 'projekt' (Standard) oder 'vertrieb'
alter table public.workflow_templates add column if not exists phase text not null default 'projekt';

-- 4. Phasen-Label je Vorlagen-Schritt (gruppiert die Aufgaben in der Ansicht)
alter table public.workflow_steps add column if not exists group_label text;

-- 5. project_tasks.status kennt zusätzlich 'wartet' (blockiert durch Vorgänger).
--    Bleibt text — keine Schema-Änderung nötig.

-- 6. Abhängigkeiten zwischen Vorlagen-Schritten (Vorgänger)
create table if not exists public.workflow_step_deps (
  step_id             uuid not null references public.workflow_steps (id) on delete cascade,
  depends_on_step_id  uuid not null references public.workflow_steps (id) on delete cascade,
  primary key (step_id, depends_on_step_id)
);

-- 7. Abhängigkeiten zwischen konkreten Aufgaben (je Projekt)
create table if not exists public.project_task_deps (
  task_id             uuid not null references public.project_tasks (id) on delete cascade,
  depends_on_task_id  uuid not null references public.project_tasks (id) on delete cascade,
  primary key (task_id, depends_on_task_id)
);
create index if not exists project_task_deps_dep_idx on public.project_task_deps (depends_on_task_id);

alter table public.workflow_step_deps enable row level security;
alter table public.project_task_deps enable row level security;

-- Vorlagen-Abhängigkeiten: Personal liest, Admin verwaltet.
drop policy if exists "wsd_select" on public.workflow_step_deps;
create policy "wsd_select" on public.workflow_step_deps for select using (public.is_staff());
drop policy if exists "wsd_write" on public.workflow_step_deps;
create policy "wsd_write" on public.workflow_step_deps for all using (public.is_admin()) with check (public.is_admin());

-- Aufgaben-Abhängigkeiten: Personal liest/schreibt (entstehen beim Ablauf-Start).
drop policy if exists "ptd_select" on public.project_task_deps;
create policy "ptd_select" on public.project_task_deps for select using (public.is_staff());
drop policy if exists "ptd_write" on public.project_task_deps;
create policy "ptd_write" on public.project_task_deps for all using (public.is_staff()) with check (public.is_staff());

-- ── Seed: Vertriebsablauf-Vorlage (nur, wenn noch keine 'vertrieb'-Vorlage da) ──
insert into public.workflow_templates (project_type, name, phase)
select null, 'Vertriebsablauf — Standard', 'vertrieb'
where not exists (select 1 from public.workflow_templates where phase = 'vertrieb');

insert into public.workflow_steps (template_id, title, description, role, offset_days, sort, group_label)
select wt.id, s.title, s.description, 'vertrieb', s.offset_days, s.sort, 'Vertrieb'
from public.workflow_templates wt
cross join (values
  ('Kontaktaufnahme',          'Erstkontakt herstellen (Anruf/E-Mail).',                 0, 0),
  ('2. Kontaktaufnahme',       'Nachfassen, falls kein Erstkontakt zustande kam.',       3, 1),
  ('Telefongespräch',          'Bedarf und Eckdaten telefonisch klären.',                5, 2),
  ('Bedarf / Qualifizierung',  'Anlagengröße, Budget und Zeithorizont qualifizieren.',   7, 3),
  ('Vor-Ort-Termin',           'Beratung / Aufnahme vor Ort.',                          10, 4),
  ('Angebot vorbereiten',      'Kalkulation und Angebot erstellen.',                    14, 5),
  ('Nachfassen',               'Angebot nachverfolgen.',                                21, 6),
  ('Abschluss / Auftrag',      'Auftrag gewinnen oder Absage dokumentieren.',           28, 7)
) as s(title, description, offset_days, sort)
where wt.phase = 'vertrieb'
  and not exists (select 1 from public.workflow_steps ws where ws.template_id = wt.id);

-- Vertriebsschritte laufen sequenziell: jeder hängt am vorigen.
insert into public.workflow_step_deps (step_id, depends_on_step_id)
select cur.id, prev.id
from public.workflow_templates wt
join public.workflow_steps cur  on cur.template_id  = wt.id
join public.workflow_steps prev on prev.template_id = wt.id and prev.sort = cur.sort - 1
where wt.phase = 'vertrieb'
on conflict do nothing;

-- ── Seed: Phasen-Labels für die Standard-Projektschritte (nur wo noch leer) ──
update public.workflow_steps ws
set group_label = m.grp
from (values
  ('Aufmaß / Vor-Ort-Termin',         'Planung'),
  ('Planung & Auslegung',             'Planung'),
  ('Netzanmeldung',                   'Vorbereitung'),
  ('Materialbestellung',              'Vorbereitung'),
  ('Terminierung / Gerüst',           'Vorbereitung'),
  ('Montage',                         'Umsetzung'),
  ('Elektroinstallation & Anschluss', 'Umsetzung'),
  ('Inbetriebnahme',                  'Abschluss'),
  ('Marktstammdatenregister',         'Abschluss'),
  ('Dokumentation & Übergabe',        'Abschluss')
) as m(title, grp)
join public.workflow_templates wt on wt.id = ws.template_id and wt.phase = 'projekt'
where ws.title = m.title and ws.group_label is null;

-- ── Seed: Vorgänger der Standard-Projektschritte (Titel-Matching je Vorlage) ──
-- Ergibt eine Mischung aus Reihenfolge und Parallelität, z. B. nach „Planung"
-- laufen Netzanmeldung und Materialbestellung parallel. (project_task_deps wird
-- erst je Projekt beim Ablauf-Start aus diesen Schritt-Vorgängern erzeugt.)
insert into public.workflow_step_deps (step_id, depends_on_step_id)
select cur.id, prev.id
from public.workflow_templates wt
join public.workflow_steps cur  on cur.template_id  = wt.id
join public.workflow_steps prev on prev.template_id = wt.id
join (values
  ('Planung & Auslegung',             'Aufmaß / Vor-Ort-Termin'),
  ('Netzanmeldung',                   'Planung & Auslegung'),
  ('Materialbestellung',              'Planung & Auslegung'),
  ('Terminierung / Gerüst',           'Materialbestellung'),
  ('Montage',                         'Terminierung / Gerüst'),
  ('Elektroinstallation & Anschluss', 'Montage'),
  ('Inbetriebnahme',                  'Elektroinstallation & Anschluss'),
  ('Marktstammdatenregister',         'Inbetriebnahme'),
  ('Marktstammdatenregister',         'Netzanmeldung'),
  ('Dokumentation & Übergabe',        'Inbetriebnahme')
) as e(child, parent) on cur.title = e.child and prev.title = e.parent
where wt.phase = 'projekt'
on conflict do nothing;
