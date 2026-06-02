-- ============================================================================
-- ip³ PV-Tool — Projektablauf-Tool (Workflow-Vorlagen + Aufgaben)
-- workflow_templates (je Anlagentyp) → workflow_steps (Schritte) →
-- project_tasks (instanziierte Aufgaben je Projekt, Verantwortlicher/Fälligkeit).
-- Idempotent. Im Supabase SQL-Editor einmal ausführen.
-- ============================================================================

create table if not exists public.workflow_templates (
  id            uuid primary key default gen_random_uuid(),
  project_type  text,
  name          text not null,
  active        boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table if not exists public.workflow_steps (
  id            uuid primary key default gen_random_uuid(),
  template_id   uuid not null references public.workflow_templates (id) on delete cascade,
  title         text not null,
  description   text,
  role          text,                       -- optionaler Rollen-Hinweis
  offset_days   int not null default 0,     -- Fälligkeit = Start + offset_days
  sort          int not null default 0
);
create index if not exists workflow_steps_template_idx on public.workflow_steps (template_id, sort);

create table if not exists public.project_tasks (
  id                    uuid primary key default gen_random_uuid(),
  project_id            uuid not null references public.projects (id) on delete cascade,
  title                 text not null,
  description           text,
  assignee_employee_id  uuid references public.employees (id) on delete set null,
  due_date              date,
  status                text not null default 'offen',   -- 'offen' | 'erledigt'
  sort                  int not null default 0,
  done_at               timestamptz,
  created_by            uuid references public.employees (id) on delete set null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create index if not exists project_tasks_project_idx on public.project_tasks (project_id, sort);
create index if not exists project_tasks_assignee_idx on public.project_tasks (assignee_employee_id, status, due_date);

alter table public.workflow_templates enable row level security;
alter table public.workflow_steps enable row level security;
alter table public.project_tasks enable row level security;

-- Vorlagen: alle Mitarbeiter lesen, nur Admin verwaltet.
drop policy if exists "wt_select" on public.workflow_templates;
create policy "wt_select" on public.workflow_templates for select using (public.is_staff());
drop policy if exists "wt_write" on public.workflow_templates;
create policy "wt_write" on public.workflow_templates for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "ws_select" on public.workflow_steps;
create policy "ws_select" on public.workflow_steps for select using (public.is_staff());
drop policy if exists "ws_write" on public.workflow_steps;
create policy "ws_write" on public.workflow_steps for all using (public.is_admin()) with check (public.is_admin());

-- Aufgaben: alle Mitarbeiter lesen/anlegen/aktualisieren; löschen Admin.
drop policy if exists "pt_select" on public.project_tasks;
create policy "pt_select" on public.project_tasks for select using (public.is_staff());
drop policy if exists "pt_insert" on public.project_tasks;
create policy "pt_insert" on public.project_tasks for insert with check (public.is_staff());
drop policy if exists "pt_update" on public.project_tasks;
create policy "pt_update" on public.project_tasks for update using (public.is_staff()) with check (public.is_staff());
drop policy if exists "pt_delete" on public.project_tasks;
create policy "pt_delete" on public.project_tasks for delete using (public.is_admin());

-- Standard-Vorlage je Anlagentyp (nur, wenn noch keine existiert).
insert into public.workflow_templates (project_type, name)
select t, 'Standardablauf — ' || t
from (values
  ('Dachanlage bis 10 kWp'),
  ('Dachanlage bis 100 kWp'),
  ('Dachanlage bis 300 kWp'),
  ('Große Dachanlage'),
  ('Freiflächenanlage'),
  ('Speicherprojekt')
) as v(t)
where not exists (select 1 from public.workflow_templates);

-- Standard-Schritte für jede neu angelegte Vorlage.
insert into public.workflow_steps (template_id, title, description, role, offset_days, sort)
select wt.id, s.title, s.description, s.role, s.offset_days, s.sort
from public.workflow_templates wt
cross join (values
  ('Aufmaß / Vor-Ort-Termin', 'Dach/Standort vermessen, Fotos, Zählerschrank prüfen.', 'mitarbeiter', 3, 0),
  ('Planung & Auslegung', 'Stringplan, Komponentenauswahl, Statikprüfung.', 'mitarbeiter', 7, 1),
  ('Netzanmeldung', 'Anmeldung beim Netzbetreiber einreichen.', 'mitarbeiter', 10, 2),
  ('Materialbestellung', 'Material bei Großhändler bestellen (Bestellliste).', 'mitarbeiter', 14, 3),
  ('Terminierung / Gerüst', 'Montagetermin abstimmen, ggf. Gerüst beauftragen.', 'mitarbeiter', 21, 4),
  ('Montage', 'Unterkonstruktion und Module montieren.', 'mitarbeiter', 28, 5),
  ('Elektroinstallation & Anschluss', 'Wechselrichter/Speicher anschließen, AC/DC.', 'mitarbeiter', 30, 6),
  ('Inbetriebnahme', 'Inbetriebnahmeprotokoll, Funktionsprüfung.', 'mitarbeiter', 32, 7),
  ('Marktstammdatenregister', 'Anlage im MaStR registrieren.', 'mitarbeiter', 35, 8),
  ('Dokumentation & Übergabe', 'Unterlagen zusammenstellen, Kundenübergabe.', 'mitarbeiter', 37, 9)
) as s(title, description, role, offset_days, sort)
where not exists (select 1 from public.workflow_steps);
