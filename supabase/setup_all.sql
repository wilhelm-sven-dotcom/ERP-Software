-- ============================================================================
-- ip³ PV-Tool — Komplett-Setup (alle Migrationen + Seed in EINEM Skript)
-- Im Supabase SQL Editor einfügen und EINMAL ausführen (Run).
-- Reihenfolge: schema -> rls -> audit -> auth_bootstrap -> defaults -> seed
-- Generiert aus supabase/migrations/*.sql + supabase/seed.sql — nicht abtippen.
-- ============================================================================


-- ============================================================================
-- >>> supabase/migrations/20260531120000_schema.sql
-- ============================================================================
-- ============================================================================
-- ip³ PV-Tool — Schema (Phase 2)
-- Tabellen gemäß CLAUDE.md §5. Spaltennamen englisch, snake_case.
-- Jede Entität hat `legacy_id` für den Import des alten IndexedDB-Backups
-- (Beziehungen werden beim Import über legacy_id aufgelöst).
-- ============================================================================

-- gen_random_uuid() ist in Supabase/Postgres verfügbar (pgcrypto / core).

-- ---------------------------------------------------------------------------
-- product_groups (Produktgruppen, selbstreferenzierend)
-- ---------------------------------------------------------------------------
create table public.product_groups (
  id          uuid primary key default gen_random_uuid(),
  legacy_id   text unique,
  name        text not null,
  parent_id   uuid references public.product_groups (id) on delete set null,
  sort        int not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- employees (Mitarbeiter, verknüpft mit Supabase Auth + Rolle)
-- ---------------------------------------------------------------------------
create table public.employees (
  id            uuid primary key default gen_random_uuid(),
  legacy_id     text unique,
  auth_user_id  uuid unique references auth.users (id) on delete set null,
  name          text,
  email         text unique,
  role          text not null default 'mitarbeiter'
                  check (role in ('admin', 'mitarbeiter')),
  active        boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- customers (Kunden mit fortlaufender Kundennummer)
-- ---------------------------------------------------------------------------
create table public.customers (
  id             uuid primary key default gen_random_uuid(),
  legacy_id      text unique,
  customer_nr    int unique,
  kind           text check (kind in ('privat', 'gewerbe')),
  company        text,
  salutation     text,
  academic_title text,
  first_name     text,
  last_name      text,
  email          text,
  phone          text,
  mobile         text,
  street         text,
  zip            text,
  city           text,
  notes          text,
  created_by     uuid references public.employees (id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- projects (Kern-Entität)
-- status = Pipeline-Stufe; Legacy-Werte (aus /legacy verifiziert):
--   'Anfrage' | 'Angebot' | 'Auftrag' | 'Entwurf' | 'gewonnen' | 'verloren'
-- (bewusst ohne harten CHECK, um den Import nicht zu blockieren)
-- ---------------------------------------------------------------------------
create table public.projects (
  id                   uuid primary key default gen_random_uuid(),
  legacy_id            text unique,
  customer_id          uuid references public.customers (id) on delete cascade,
  title                text,
  status               text default 'Anfrage',
  assigned_employee_id uuid references public.employees (id) on delete set null,
  street               text,
  zip                  text,
  city                 text,
  system_size_kwp      numeric,
  notes                text,
  details              jsonb not null default '{}'::jsonb, -- techn. Zusatzdaten (Dach, Wallbox, Speicher …)
  created_by           uuid references public.employees (id) on delete set null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- activities (Logbuch / Timeline)
-- ---------------------------------------------------------------------------
create table public.activities (
  id           uuid primary key default gen_random_uuid(),
  legacy_id    text unique,
  project_id   uuid references public.projects (id) on delete cascade,
  customer_id  uuid references public.customers (id) on delete cascade,
  type         text,
  title        text,
  body         text,
  employee_id  uuid references public.employees (id) on delete set null,
  occurred_at  timestamptz,
  created_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- products (Produktkatalog)
-- ---------------------------------------------------------------------------
create table public.products (
  id              uuid primary key default gen_random_uuid(),
  legacy_id       text unique,
  group_id        uuid references public.product_groups (id) on delete set null,
  name            text not null,
  manufacturer    text,
  category        text,
  sku             text,
  price_purchase  numeric,
  price_sell      numeric,
  unit            text,
  specs           jsonb not null default '{}'::jsonb,
  created_by      uuid references public.employees (id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- product_assets (Datenblätter/Bilder → Supabase Storage)
-- Binärdaten liegen in Storage; hier nur Metadaten + storage_path.
-- ---------------------------------------------------------------------------
create table public.product_assets (
  id            uuid primary key default gen_random_uuid(),
  legacy_id     text unique,
  product_id    uuid references public.products (id) on delete cascade,
  kind          text, -- 'datasheet' | 'image'
  name          text,
  storage_path  text,
  mime          text,
  created_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- offer_templates (Angebotsvorlagen)
-- ---------------------------------------------------------------------------
create table public.offer_templates (
  id          uuid primary key default gen_random_uuid(),
  legacy_id   text unique,
  name        text not null,
  kind        text,
  is_default  boolean not null default false,
  content     jsonb not null default '{}'::jsonb,
  created_by  uuid references public.employees (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- calc_templates (Kalkulationsvorlagen)
-- ---------------------------------------------------------------------------
create table public.calc_templates (
  id          uuid primary key default gen_random_uuid(),
  legacy_id   text unique,
  name        text not null,
  is_default  boolean not null default false,
  positions   jsonb not null default '[]'::jsonb,
  defaults    jsonb not null default '{}'::jsonb,
  created_by  uuid references public.employees (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- calculations (Kalkulation je Projekt)
-- ---------------------------------------------------------------------------
create table public.calculations (
  id          uuid primary key default gen_random_uuid(),
  legacy_id   text unique,
  project_id  uuid references public.projects (id) on delete cascade,
  positions   jsonb not null default '[]'::jsonb,
  totals      jsonb not null default '{}'::jsonb,
  margin      numeric,
  created_by  uuid references public.employees (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- settings (key/value — Firmendaten, Logo, Defaults)
-- ---------------------------------------------------------------------------
create table public.settings (
  key         text primary key,
  value       jsonb,
  updated_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- change_log (Audit-Log) — wird per Trigger befüllt (siehe 0003_audit.sql)
-- ---------------------------------------------------------------------------
create table public.change_log (
  id           uuid primary key default gen_random_uuid(),
  entity_type  text not null,
  entity_id    uuid,
  action       text not null check (action in ('create', 'update', 'delete')),
  before       jsonb,
  after        jsonb,
  employee_id  uuid references public.employees (id) on delete set null,
  created_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Indizes (Fremdschlüssel & häufige Filter)
-- ---------------------------------------------------------------------------
create index on public.product_groups (parent_id);
create index on public.customers (customer_nr);
create index on public.customers (created_by);
create index on public.projects (customer_id);
create index on public.projects (assigned_employee_id);
create index on public.projects (status);
create index on public.activities (project_id);
create index on public.activities (customer_id);
create index on public.activities (employee_id);
create index on public.products (group_id);
create index on public.product_assets (product_id);
create index on public.calculations (project_id);
create index on public.employees (auth_user_id);
create index on public.change_log (entity_type, entity_id);

-- ---------------------------------------------------------------------------
-- updated_at automatisch pflegen
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'product_groups', 'employees', 'customers', 'projects',
    'products', 'offer_templates', 'calc_templates', 'calculations', 'settings'
  ]
  loop
    execute format(
      'create trigger set_updated_at before update on public.%I
         for each row execute function public.set_updated_at();', t);
  end loop;
end;
$$;


-- ============================================================================
-- >>> supabase/migrations/20260531120100_rls.sql
-- ============================================================================
-- ============================================================================
-- ip³ PV-Tool — Row-Level-Security (Phase 2)
-- Ersetzt die alte Frontend-Logik canView/canEdit/canDelete (CLAUDE.md §6).
--
-- Grundregeln:
--   * Admin:       voller Lese-/Schreib-/Löschzugriff auf alles.
--   * Mitarbeiter: darf alles LESEN, darf ANLEGEN, darf EIGENE/ZUGEWIESENE
--                  Datensätze BEARBEITEN; KEIN Löschen.
-- Die DB ist die Wahrheit; Frontend-Checks sind nur fürs UX.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Helfer-Funktionen (SECURITY DEFINER → umgehen RLS, verhindern Rekursion
-- in den employees-Policies). Rolle wird über auth.uid() aufgelöst.
-- ---------------------------------------------------------------------------
create or replace function public.current_employee_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.employees where auth_user_id = auth.uid() limit 1;
$$;

create or replace function public.auth_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.employees where auth_user_id = auth.uid() limit 1;
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
as $$ select coalesce(public.auth_role() = 'admin', false); $$;

create or replace function public.is_staff()
returns boolean
language sql
stable
as $$ select coalesce(public.auth_role() in ('admin', 'mitarbeiter'), false); $$;

-- ---------------------------------------------------------------------------
-- RLS auf JEDER Tabelle aktivieren.
-- ---------------------------------------------------------------------------
alter table public.product_groups  enable row level security;
alter table public.employees       enable row level security;
alter table public.customers       enable row level security;
alter table public.projects        enable row level security;
alter table public.activities      enable row level security;
alter table public.products        enable row level security;
alter table public.product_assets  enable row level security;
alter table public.offer_templates enable row level security;
alter table public.calc_templates  enable row level security;
alter table public.calculations    enable row level security;
alter table public.settings        enable row level security;
alter table public.change_log      enable row level security;

-- ===========================================================================
-- employees: lesen = Personal; verwalten = Admin.
-- ===========================================================================
create policy "employees_select" on public.employees
  for select using (public.is_staff());
create policy "employees_admin_write" on public.employees
  for all using (public.is_admin()) with check (public.is_admin());

-- ===========================================================================
-- customers: lesen = Personal; anlegen = Personal;
--            ändern = Admin oder Ersteller; löschen = Admin.
-- ===========================================================================
create policy "customers_select" on public.customers
  for select using (public.is_staff());
create policy "customers_insert" on public.customers
  for insert with check (public.is_staff());
create policy "customers_update" on public.customers
  for update
  using (public.is_admin() or created_by = public.current_employee_id())
  with check (public.is_admin() or created_by = public.current_employee_id());
create policy "customers_delete" on public.customers
  for delete using (public.is_admin());

-- ===========================================================================
-- projects: ändern = Admin, Ersteller ODER zugewiesener Mitarbeiter.
-- ===========================================================================
create policy "projects_select" on public.projects
  for select using (public.is_staff());
create policy "projects_insert" on public.projects
  for insert with check (public.is_staff());
create policy "projects_update" on public.projects
  for update
  using (
    public.is_admin()
    or created_by = public.current_employee_id()
    or assigned_employee_id = public.current_employee_id()
  )
  with check (
    public.is_admin()
    or created_by = public.current_employee_id()
    or assigned_employee_id = public.current_employee_id()
  );
create policy "projects_delete" on public.projects
  for delete using (public.is_admin());

-- ===========================================================================
-- activities: ändern = Admin oder eigener Eintrag (employee_id).
-- ===========================================================================
create policy "activities_select" on public.activities
  for select using (public.is_staff());
create policy "activities_insert" on public.activities
  for insert with check (public.is_staff());
create policy "activities_update" on public.activities
  for update
  using (public.is_admin() or employee_id = public.current_employee_id())
  with check (public.is_admin() or employee_id = public.current_employee_id());
create policy "activities_delete" on public.activities
  for delete using (public.is_admin());

-- ===========================================================================
-- Katalog (products, product_groups, product_assets):
-- Personal darf lesen/anlegen/ändern; löschen = Admin.
-- ===========================================================================
create policy "products_select" on public.products
  for select using (public.is_staff());
create policy "products_insert" on public.products
  for insert with check (public.is_staff());
create policy "products_update" on public.products
  for update using (public.is_staff()) with check (public.is_staff());
create policy "products_delete" on public.products
  for delete using (public.is_admin());

create policy "product_groups_select" on public.product_groups
  for select using (public.is_staff());
create policy "product_groups_insert" on public.product_groups
  for insert with check (public.is_staff());
create policy "product_groups_update" on public.product_groups
  for update using (public.is_staff()) with check (public.is_staff());
create policy "product_groups_delete" on public.product_groups
  for delete using (public.is_admin());

create policy "product_assets_select" on public.product_assets
  for select using (public.is_staff());
create policy "product_assets_insert" on public.product_assets
  for insert with check (public.is_staff());
create policy "product_assets_update" on public.product_assets
  for update using (public.is_staff()) with check (public.is_staff());
create policy "product_assets_delete" on public.product_assets
  for delete using (public.is_admin());

-- ===========================================================================
-- Vorlagen & Kalkulation: ändern = Admin oder Ersteller; löschen = Admin.
-- (calculations: Ersteller; ansonsten gilt Projektzugriff über die App.)
-- ===========================================================================
create policy "offer_templates_select" on public.offer_templates
  for select using (public.is_staff());
create policy "offer_templates_insert" on public.offer_templates
  for insert with check (public.is_staff());
create policy "offer_templates_update" on public.offer_templates
  for update
  using (public.is_admin() or created_by = public.current_employee_id())
  with check (public.is_admin() or created_by = public.current_employee_id());
create policy "offer_templates_delete" on public.offer_templates
  for delete using (public.is_admin());

create policy "calc_templates_select" on public.calc_templates
  for select using (public.is_staff());
create policy "calc_templates_insert" on public.calc_templates
  for insert with check (public.is_staff());
create policy "calc_templates_update" on public.calc_templates
  for update
  using (public.is_admin() or created_by = public.current_employee_id())
  with check (public.is_admin() or created_by = public.current_employee_id());
create policy "calc_templates_delete" on public.calc_templates
  for delete using (public.is_admin());

create policy "calculations_select" on public.calculations
  for select using (public.is_staff());
create policy "calculations_insert" on public.calculations
  for insert with check (public.is_staff());
create policy "calculations_update" on public.calculations
  for update
  using (public.is_admin() or created_by = public.current_employee_id())
  with check (public.is_admin() or created_by = public.current_employee_id());
create policy "calculations_delete" on public.calculations
  for delete using (public.is_admin());

-- ===========================================================================
-- settings: lesen = Personal; schreiben = Admin.
-- ===========================================================================
create policy "settings_select" on public.settings
  for select using (public.is_staff());
create policy "settings_admin_write" on public.settings
  for all using (public.is_admin()) with check (public.is_admin());

-- ===========================================================================
-- change_log: nur Admin liest. Schreiben ausschließlich per Audit-Trigger
-- (SECURITY DEFINER) — keine direkten Schreib-Policies für Clients.
-- ===========================================================================
create policy "change_log_admin_select" on public.change_log
  for select using (public.is_admin());


-- ============================================================================
-- >>> supabase/migrations/20260531120200_audit.sql
-- ============================================================================
-- ============================================================================
-- ip³ PV-Tool — Audit-Log per Trigger (Phase 2)
-- Bildet die alte dbPutWithAudit/dbDelWithAudit-Logik nach (CLAUDE.md §5).
-- Zentral per Trigger — nicht in jeder Funktion einzeln.
-- ============================================================================

create or replace function public.log_audit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_action    text;
  v_entity_id uuid;
  v_before    jsonb;
  v_after     jsonb;
begin
  if (tg_op = 'INSERT') then
    v_action := 'create';
    v_after := to_jsonb(new);
    v_entity_id := new.id;
  elsif (tg_op = 'UPDATE') then
    v_action := 'update';
    v_before := to_jsonb(old);
    v_after := to_jsonb(new);
    v_entity_id := new.id;
  elsif (tg_op = 'DELETE') then
    v_action := 'delete';
    v_before := to_jsonb(old);
    v_entity_id := old.id;
  end if;

  insert into public.change_log
    (entity_type, entity_id, action, before, after, employee_id)
  values
    (tg_table_name, v_entity_id, v_action, v_before, v_after,
     public.current_employee_id());

  if (tg_op = 'DELETE') then
    return old;
  end if;
  return new;
end;
$$;

-- Trigger an alle Entitäten mit `id uuid` hängen (settings hat key-PK → ausgenommen).
do $$
declare
  t text;
begin
  foreach t in array array[
    'customers', 'projects', 'activities', 'products', 'product_groups',
    'product_assets', 'employees', 'offer_templates', 'calc_templates',
    'calculations'
  ]
  loop
    execute format(
      'create trigger audit_%1$s
         after insert or update or delete on public.%1$I
         for each row execute function public.log_audit();', t);
  end loop;
end;
$$;


-- ============================================================================
-- >>> supabase/migrations/20260531120300_auth_bootstrap.sql
-- ============================================================================
-- ============================================================================
-- ip³ PV-Tool — Auth-Bootstrap (Phase 2)
-- Legt für jeden neuen Auth-User automatisch einen employees-Eintrag an.
-- Der ERSTE Nutzer muss danach manuell zum Admin gemacht werden:
--   update public.employees set role = 'admin' where email = 'DEINE@MAIL';
-- ============================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.employees (auth_user_id, email, name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'name', new.email),
    'mitarbeiter'
  )
  on conflict (auth_user_id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- ============================================================================
-- >>> supabase/migrations/20260531120400_defaults.sql
-- ============================================================================
-- ============================================================================
-- ip³ PV-Tool — Spalten-Defaults (Phase 3)
-- created_by/employee_id automatisch auf den aktuellen Mitarbeiter setzen.
-- So greift die RLS-Regel "eigene Datensätze" ohne Zutun des Clients.
-- (Beim Import via Service-Role ist current_employee_id() = NULL → dort wird
--  created_by ohnehin explizit gesetzt.)
-- ============================================================================

alter table public.customers
  alter column created_by set default public.current_employee_id();
alter table public.projects
  alter column created_by set default public.current_employee_id();
alter table public.products
  alter column created_by set default public.current_employee_id();
alter table public.offer_templates
  alter column created_by set default public.current_employee_id();
alter table public.calc_templates
  alter column created_by set default public.current_employee_id();
alter table public.calculations
  alter column created_by set default public.current_employee_id();
alter table public.activities
  alter column employee_id set default public.current_employee_id();


-- ============================================================================
-- >>> supabase/seed.sql
-- ============================================================================
-- ============================================================================
-- ip³ PV-Tool — Seed / Standard-Daten
-- Idempotent (on conflict do nothing). Wird nach den Migrationen ausgeführt.
-- Echte Daten kommen über scripts/import-legacy.ts.
-- ============================================================================

insert into public.settings (key, value) values
  ('company', jsonb_build_object(
     'name', 'ip³ Energietechnik',
     'street', '',
     'zip', '',
     'city', '',
     'phone', '',
     'email', '',
     'logo_url', null
   )),
  ('defaults', jsonb_build_object(
     'vat_percent', 19
   ))
on conflict (key) do nothing;


-- ============================================================================
-- >>> supabase/migrations/20260531120500_fix_auth_trigger.sql
-- ============================================================================
-- ============================================================================
-- ip³ PV-Tool — Fix: "Database error creating new user"
-- Ursache: Der Trigger handle_new_user() schreibt in public.employees, aber
-- die Supabase-Auth-Rolle (supabase_auth_admin), die beim Anlegen eines Users
-- den Trigger ausloest, hat darauf keine Rechte -> Insert scheitert -> die
-- gesamte User-Erstellung bricht ab.
--
-- Dieses Skript im Supabase SQL Editor EINMAL ausfuehren.
-- ============================================================================

-- 1) Auth-Rolle Zugriff auf Schema + employees geben
grant usage on schema public to supabase_auth_admin;
grant insert, select, update on public.employees to supabase_auth_admin;

-- 2) Trigger-Funktion robust neu anlegen:
--    - SECURITY DEFINER (laeuft als Funktions-Owner)
--    - Fehler im Trigger duerfen die User-Erstellung NICHT mehr abbrechen
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  begin
    insert into public.employees (auth_user_id, email, name, role)
    values (
      new.id,
      new.email,
      coalesce(new.raw_user_meta_data ->> 'name', new.email),
      'mitarbeiter'
    )
    on conflict (auth_user_id) do nothing;
  exception when others then
    -- Anlegen des Mitarbeiter-Eintrags darf die Anmeldung nie blockieren.
    raise warning 'handle_new_user: %', sqlerrm;
  end;
  return new;
end;
$$;

-- 3) Trigger sicher (neu) verknuepfen
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 4) employees-Eintraege fuer evtl. bereits angelegte Auth-User nachziehen
insert into public.employees (auth_user_id, email, name, role)
select u.id, u.email, coalesce(u.raw_user_meta_data ->> 'name', u.email), 'mitarbeiter'
from auth.users u
where not exists (
  select 1 from public.employees e where e.auth_user_id = u.id
);


-- ============================================================================
-- >>> supabase/storage.sql (Produkt-Medien: Bucket + Policies)
-- ============================================================================
-- ============================================================================
-- ip³ PV-Tool — Storage-Setup für Produkt-Medien (Bilder + Datenblätter)
-- Im Supabase SQL Editor EINMAL ausführen.
-- Legt den Bucket `product-assets` an und setzt RLS-Policies auf storage.objects.
-- ============================================================================

-- Bucket anlegen (idempotent). public=true → Bilder/Datenblätter per URL ladbar.
insert into storage.buckets (id, name, public)
values ('product-assets', 'product-assets', true)
on conflict (id) do nothing;

-- Lesen: alle angemeldeten Nutzer
drop policy if exists "product_assets_read" on storage.objects;
create policy "product_assets_read" on storage.objects
  for select using (
    bucket_id = 'product-assets' and public.is_staff()
  );

-- Hochladen: Personal (admin/mitarbeiter)
drop policy if exists "product_assets_insert" on storage.objects;
create policy "product_assets_insert" on storage.objects
  for insert with check (
    bucket_id = 'product-assets' and public.is_staff()
  );

-- Aktualisieren: Personal
drop policy if exists "product_assets_update" on storage.objects;
create policy "product_assets_update" on storage.objects
  for update using (
    bucket_id = 'product-assets' and public.is_staff()
  ) with check (
    bucket_id = 'product-assets' and public.is_staff()
  );

-- Löschen: nur Admin
drop policy if exists "product_assets_delete" on storage.objects;
create policy "product_assets_delete" on storage.objects
  for delete using (
    bucket_id = 'product-assets' and public.is_admin()
  );


-- ============================================================================
-- Projekt: Speicherkapazität + Geokoordinaten (Migration 20260531120700)
-- ============================================================================
alter table public.projects add column if not exists storage_kwh numeric;
alter table public.projects add column if not exists lat numeric;
alter table public.projects add column if not exists lon numeric;

-- ============================================================================
-- Produkte: Sortier-Spalte für Drag & Drop (Migration 20260531120800)
-- ============================================================================
alter table public.products add column if not exists sort int not null default 0;
create index if not exists products_group_sort_idx
  on public.products (group_id, sort);

-- ============================================================================
-- Produktpreise auf 2 Nachkommastellen runden (Migration 20260531120900)
-- ============================================================================
update public.products
set price_purchase = round(price_purchase::numeric, 2)
where price_purchase is not null
  and price_purchase <> round(price_purchase::numeric, 2);
update public.products
set price_sell = round(price_sell::numeric, 2)
where price_sell is not null
  and price_sell <> round(price_sell::numeric, 2);
