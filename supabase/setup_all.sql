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
-- ============================================================================
-- ip³ PV-Tool — Großhändler (wholesalers) + Produkt-Verknüpfung
-- Pro Produkt mehrere Großhändler mit Bestellnummer und (optionalem) EK-Preis.
-- Im Supabase SQL-Editor einmal ausführen. Idempotent.
-- ============================================================================

create table if not exists public.wholesalers (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  contact     text,
  email       text,
  phone       text,
  notes       text,
  created_by  uuid references public.employees (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.product_wholesalers (
  id             uuid primary key default gen_random_uuid(),
  product_id     uuid not null references public.products (id) on delete cascade,
  wholesaler_id  uuid not null references public.wholesalers (id) on delete cascade,
  order_number   text,
  price_purchase numeric,
  created_at     timestamptz not null default now()
);
create index if not exists product_wholesalers_product_idx
  on public.product_wholesalers (product_id);

alter table public.wholesalers          enable row level security;
alter table public.product_wholesalers  enable row level security;

-- Personal darf lesen/anlegen/ändern; löschen = Admin (analog products).
do $$
declare t text;
begin
  foreach t in array array['wholesalers', 'product_wholesalers']
  loop
    execute format($f$
      drop policy if exists "%1$s_select" on public.%1$I;
      create policy "%1$s_select" on public.%1$I for select using (public.is_staff());
      drop policy if exists "%1$s_insert" on public.%1$I;
      create policy "%1$s_insert" on public.%1$I for insert with check (public.is_staff());
      drop policy if exists "%1$s_update" on public.%1$I;
      create policy "%1$s_update" on public.%1$I for update using (public.is_staff()) with check (public.is_staff());
      drop policy if exists "%1$s_delete" on public.%1$I;
      create policy "%1$s_delete" on public.%1$I for delete using (public.is_admin());
    $f$, t);
  end loop;
end $$;
-- ============================================================================
-- ip³ PV-Tool — Kalkulations-Varianten
-- Mehrere benannte Kalkulationen je Projekt; eine ist „ausgewählt". Die
-- berechnete Anlagen-/Speichergröße wird je Variante mitgespeichert.
-- Im Supabase SQL-Editor einmal ausführen. Idempotent.
-- ============================================================================

alter table public.calculations add column if not exists name text;
alter table public.calculations
  add column if not exists is_selected boolean not null default false;
alter table public.calculations add column if not exists system_size_kwp numeric;
alter table public.calculations add column if not exists storage_kwh numeric;

-- Bestehende Kalkulationen benennen, damit die Liste nicht leer wirkt.
update public.calculations set name = 'Standard' where name is null;
-- ============================================================================
-- ip³ PV-Tool — Angebote (offers) als eigene Datensätze
-- Eingefrorene Positionen/Summen aus einer Kalkulations-Variante, mit
-- fortlaufender Angebotsnummer und Status. Im SQL-Editor einmal ausführen.
-- ============================================================================

create table if not exists public.offers (
  id              uuid primary key default gen_random_uuid(),
  project_id      uuid not null references public.projects (id) on delete cascade,
  calculation_id  uuid references public.calculations (id) on delete set null,
  offer_number    int unique,
  title           text,
  status          text not null default 'Entwurf',
  positions       jsonb not null default '[]'::jsonb,
  totals          jsonb not null default '{}'::jsonb,
  meta            jsonb not null default '{}'::jsonb,
  valid_until     date,
  notes           text,
  created_by      uuid references public.employees (id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists offers_project_idx on public.offers (project_id);

alter table public.offers enable row level security;

drop policy if exists "offers_select" on public.offers;
create policy "offers_select" on public.offers for select using (public.is_staff());
drop policy if exists "offers_insert" on public.offers;
create policy "offers_insert" on public.offers for insert with check (public.is_staff());
drop policy if exists "offers_update" on public.offers;
create policy "offers_update" on public.offers for update using (public.is_staff()) with check (public.is_staff());
drop policy if exists "offers_delete" on public.offers;
create policy "offers_delete" on public.offers for delete using (public.is_admin());

-- ============================================================================
-- Projekttyp (Anlagentyp) — Migration 20260531121300
-- ============================================================================
alter table public.projects add column if not exists project_type text;
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
-- ============================================================================
-- ip³ PV-Tool — Folgedokumente: Auftragsbestätigung (AB) & Lieferschein
-- Eine generische documents-Tabelle (kind) für die Kette
-- Angebot → AB → Lieferschein. Eingefrorene Positionen/Summen.
-- Idempotent. Im Supabase SQL-Editor einmal ausführen.
-- ============================================================================

create table if not exists public.documents (
  id                  uuid primary key default gen_random_uuid(),
  project_id          uuid not null references public.projects (id) on delete cascade,
  kind                text not null,            -- 'auftragsbestaetigung' | 'lieferschein'
  doc_number          int,
  source_offer_id     uuid references public.offers (id) on delete set null,
  source_document_id  uuid references public.documents (id) on delete set null,
  status              text not null default 'Entwurf',
  title               text,
  positions           jsonb not null default '[]'::jsonb,
  totals              jsonb not null default '{}'::jsonb,
  meta                jsonb not null default '{}'::jsonb,
  commission          text,
  created_by          uuid references public.employees (id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index if not exists documents_project_idx on public.documents (project_id);
create index if not exists documents_kind_idx on public.documents (kind, doc_number);

alter table public.documents enable row level security;

drop policy if exists "documents_select" on public.documents;
create policy "documents_select" on public.documents for select using (public.is_staff());
drop policy if exists "documents_insert" on public.documents;
create policy "documents_insert" on public.documents for insert with check (public.is_staff());
drop policy if exists "documents_update" on public.documents;
create policy "documents_update" on public.documents for update using (public.is_staff()) with check (public.is_staff());
drop policy if exists "documents_delete" on public.documents;
create policy "documents_delete" on public.documents for delete using (public.is_admin());
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
-- ============================================================================
-- ip³ PV-Tool — Zeiterfassung (Stunden je Projekt) + Stundensätze
-- Basis für die Nachkalkulation (Plan/Ist je Projekt). Optionaler Import aus
-- Altsoftware via source='import' + external_id (Dedupe).
-- Idempotent. Im Supabase SQL-Editor einmal ausführen.
-- ============================================================================

alter table public.employees add column if not exists cost_rate numeric;

create table if not exists public.time_entries (
  id                    uuid primary key default gen_random_uuid(),
  project_id            uuid not null references public.projects (id) on delete cascade,
  employee_id           uuid references public.employees (id) on delete set null,
  work_date             date not null default current_date,
  hours                 numeric not null default 0,
  activity              text,
  description           text,
  hourly_rate           numeric,                 -- optional übersteuert den Mitarbeitersatz
  source                text not null default 'manual',  -- 'manual' | 'import'
  external_id           text,
  created_by            uuid references public.employees (id) on delete set null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create index if not exists time_entries_project_idx on public.time_entries (project_id);
create index if not exists time_entries_employee_idx on public.time_entries (employee_id, work_date);
-- Import-Dedupe: gleiche externe ID nicht doppelt importieren.
create unique index if not exists time_entries_external_uidx
  on public.time_entries (source, external_id)
  where external_id is not null;

alter table public.time_entries enable row level security;

drop policy if exists "te_select" on public.time_entries;
create policy "te_select" on public.time_entries for select using (public.is_staff());
drop policy if exists "te_insert" on public.time_entries;
create policy "te_insert" on public.time_entries for insert with check (public.is_staff());
-- Mitarbeiter ändern eigene Einträge; Admin alles.
drop policy if exists "te_update" on public.time_entries;
create policy "te_update" on public.time_entries for update
  using (public.is_admin() or employee_id = public.current_employee_id())
  with check (public.is_admin() or employee_id = public.current_employee_id());
drop policy if exists "te_delete" on public.time_entries;
create policy "te_delete" on public.time_entries for delete
  using (public.is_admin() or employee_id = public.current_employee_id());
-- ============================================================================
-- ip³ PV-Tool — Externe Integrationen je Mitarbeiter (Google-Kalender, read-only)
-- Speichert OAuth-Tokens je Mitarbeiter. Tokens nur serverseitig nutzen.
-- Idempotent. Im Supabase SQL-Editor einmal ausführen.
-- ============================================================================

create table if not exists public.user_integrations (
  id            uuid primary key default gen_random_uuid(),
  employee_id   uuid not null references public.employees (id) on delete cascade,
  provider      text not null default 'google',
  refresh_token text,
  access_token  text,
  token_expiry  timestamptz,
  calendar_id   text default 'primary',
  connected_at  timestamptz not null default now(),
  unique (employee_id, provider)
);

alter table public.user_integrations enable row level security;

-- Nur Eigentümer (oder Admin) darf seine Integration sehen/verwalten.
drop policy if exists "ui_select" on public.user_integrations;
create policy "ui_select" on public.user_integrations for select
  using (public.is_admin() or employee_id = public.current_employee_id());
drop policy if exists "ui_write" on public.user_integrations;
create policy "ui_write" on public.user_integrations for all
  using (public.is_admin() or employee_id = public.current_employee_id())
  with check (public.is_admin() or employee_id = public.current_employee_id());
-- ============================================================================
-- ip³ PV-Tool — Kollaborativer Projektablauf (UX-Paket 7)
-- Erweitert Aufgaben um Anbieten/Annehmen (Claim), einen Messenger-Thread je
-- Vorgang, Gelesen-Stände und Live-Updates (Realtime).
-- Idempotent. Im Supabase SQL-Editor einmal ausführen.
-- ============================================================================

-- project_tasks erweitern: Status 'angeboten' (Logik), parallele Bündelung.
alter table public.project_tasks add column if not exists group_label text;
-- (status bleibt text: 'offen' | 'angeboten' | 'erledigt')

-- Kandidaten: Mitarbeiter, denen eine Aufgabe angeboten wurde (Claim-Menge).
create table if not exists public.task_candidates (
  task_id      uuid not null references public.project_tasks (id) on delete cascade,
  employee_id  uuid not null references public.employees (id) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (task_id, employee_id)
);
create index if not exists task_candidates_emp_idx on public.task_candidates (employee_id);

-- Messenger-Thread je Aufgabe (Chat + System-Ereigniszeilen).
create table if not exists public.task_messages (
  id                  uuid primary key default gen_random_uuid(),
  task_id             uuid not null references public.project_tasks (id) on delete cascade,
  author_employee_id  uuid references public.employees (id) on delete set null,
  body                text not null,
  kind                text not null default 'message',  -- 'message' | 'event'
  created_at          timestamptz not null default now()
);
create index if not exists task_messages_task_idx on public.task_messages (task_id, created_at);

-- Gelesen-Stand je Mitarbeiter (für Ungelesen-Zähler).
create table if not exists public.task_reads (
  task_id       uuid not null references public.project_tasks (id) on delete cascade,
  employee_id   uuid not null references public.employees (id) on delete cascade,
  last_read_at  timestamptz not null default now(),
  primary key (task_id, employee_id)
);

alter table public.task_candidates enable row level security;
alter table public.task_messages enable row level security;
alter table public.task_reads enable row level security;

-- Kandidaten: Personal liest/verwaltet (Anbieten/Claim).
drop policy if exists "tc_select" on public.task_candidates;
create policy "tc_select" on public.task_candidates for select using (public.is_staff());
drop policy if exists "tc_write" on public.task_candidates;
create policy "tc_write" on public.task_candidates for all using (public.is_staff()) with check (public.is_staff());

-- Nachrichten: Personal liest alle; schreibt als sich selbst; Löschen Admin/Autor.
drop policy if exists "tm_select" on public.task_messages;
create policy "tm_select" on public.task_messages for select using (public.is_staff());
drop policy if exists "tm_insert" on public.task_messages;
create policy "tm_insert" on public.task_messages for insert with check (public.is_staff());
drop policy if exists "tm_delete" on public.task_messages;
create policy "tm_delete" on public.task_messages for delete
  using (public.is_admin() or author_employee_id = public.current_employee_id());

-- Gelesen-Stände: nur eigene Zeilen.
drop policy if exists "tr_select" on public.task_reads;
create policy "tr_select" on public.task_reads for select
  using (public.is_admin() or employee_id = public.current_employee_id());
drop policy if exists "tr_write" on public.task_reads;
create policy "tr_write" on public.task_reads for all
  using (employee_id = public.current_employee_id())
  with check (employee_id = public.current_employee_id());

-- Realtime für die Live-Aktualisierung aktivieren (idempotent).
do $$
begin
  begin
    alter publication supabase_realtime add table public.task_messages;
  exception when duplicate_object then null; end;
  begin
    alter publication supabase_realtime add table public.task_candidates;
  exception when duplicate_object then null; end;
  begin
    alter publication supabase_realtime add table public.project_tasks;
  exception when duplicate_object then null; end;
end $$;
-- ============================================================================
-- ip³ PV-Tool — Projekt-Dateien (Datenblätter, Handbücher, Pläne, Fotos)
-- Dateien werden per Drag & Drop einem Projekt zugeordnet. Datei-Inhalt liegt
-- im Storage-Bucket `project-files` (siehe supabase/storage.sql), Metadaten hier.
-- Idempotent. Im Supabase SQL-Editor einmal ausführen.
-- ============================================================================

create table if not exists public.project_files (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid not null references public.projects (id) on delete cascade,
  name          text not null,
  storage_path  text not null,
  mime          text,
  kind          text not null default 'dokument',
  size          bigint,
  uploaded_by   uuid references public.employees (id) on delete set null,
  created_at    timestamptz not null default now()
);
create index if not exists project_files_project_idx on public.project_files (project_id);

alter table public.project_files enable row level security;

drop policy if exists "pf_select" on public.project_files;
create policy "pf_select" on public.project_files for select using (public.is_staff());
drop policy if exists "pf_insert" on public.project_files;
create policy "pf_insert" on public.project_files for insert with check (public.is_staff());
drop policy if exists "pf_delete" on public.project_files;
create policy "pf_delete" on public.project_files for delete
  using (public.is_admin() or uploaded_by = public.current_employee_id());


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
where ws.title = m.title
  and ws.group_label is null
  and exists (
    select 1 from public.workflow_templates wt
    where wt.id = ws.template_id and wt.phase = 'projekt'
  );

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


-- ============================================================================
-- ip³ PV-Tool — Rechnungen & Abschlagsrechnungen (Paket 11)
-- Erweitert die generische `documents`-Tabelle um Rechnungs-Felder. Eine
-- Rechnung ist ein document mit kind='rechnung' (Typ in meta.invoice_type:
-- 'voll' | 'abschlag' | 'schluss'). Eigener Nummernkreis via nextDocNumber().
-- Firmen-Zahlungsdaten (IBAN/Steuernr.) liegen im settings-Key 'company' (JSONB).
-- Idempotent. Im Supabase SQL-Editor einmal ausführen.
-- ============================================================================

alter table public.documents add column if not exists invoice_date date;
alter table public.documents add column if not exists due_date date;
alter table public.documents add column if not exists paid_at timestamptz;
alter table public.documents add column if not exists payment_status text; -- offen|teilbezahlt|bezahlt
alter table public.documents add column if not exists paid_amount numeric;
alter table public.documents add column if not exists percentage numeric;   -- Abschlag in %

create index if not exists documents_kind_status_idx
  on public.documents (kind, payment_status, due_date);

-- kind erlaubt zusätzlich 'rechnung' (Spalte ist text ohne CHECK).
-- RLS/Audit der documents-Tabelle gelten unverändert weiter.


-- ============================================================================
-- ip³ PV-Tool — Mahnwesen & Zahlungsstatus (Paket 12)
-- Rechnungen (documents kind='rechnung') bekommen einen Mahnstand; Mahnungen
-- sind eigene documents (kind='mahnung') mit Verweis auf die Rechnung.
-- Idempotent. Im Supabase SQL-Editor einmal ausführen.
-- ============================================================================

alter table public.documents add column if not exists reminder_level int not null default 0;
alter table public.documents add column if not exists last_reminder_at timestamptz;

-- kind erlaubt zusätzlich 'mahnung' (Spalte ist text ohne CHECK).


-- ============================================================================
-- ip³ PV-Tool — Wartungsverträge (Paket 13)
-- Wiederkehrende Wartung/Instandhaltung je Kunde/Projekt mit Intervall und
-- nächster Fälligkeit. „Wartung erledigt" schiebt die nächste Fälligkeit weiter.
-- Idempotent. Im Supabase SQL-Editor einmal ausführen.
-- ============================================================================

create table if not exists public.service_contracts (
  id              uuid primary key default gen_random_uuid(),
  customer_id     uuid references public.customers (id) on delete set null,
  project_id      uuid references public.projects (id) on delete set null,
  title           text not null,
  start_date      date,
  interval_months int not null default 12,
  next_due        date,
  price           numeric,
  status          text not null default 'aktiv',  -- aktiv | pausiert | beendet
  notes           text,
  created_by      uuid references public.employees (id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists service_contracts_due_idx on public.service_contracts (next_due);
create index if not exists service_contracts_customer_idx on public.service_contracts (customer_id);

alter table public.service_contracts enable row level security;

drop policy if exists "sc_select" on public.service_contracts;
create policy "sc_select" on public.service_contracts for select using (public.is_staff());
drop policy if exists "sc_insert" on public.service_contracts;
create policy "sc_insert" on public.service_contracts for insert with check (public.is_staff());
drop policy if exists "sc_update" on public.service_contracts;
create policy "sc_update" on public.service_contracts for update using (public.is_staff()) with check (public.is_staff());
drop policy if exists "sc_delete" on public.service_contracts;
create policy "sc_delete" on public.service_contracts for delete using (public.is_admin());


-- ============================================================================
-- ip³ PV-Tool — Plantafel / Disposition (Paket 14)
-- Termine/Einsätze je Mitarbeiter und Tag (Montage, Aufmaß, Wartung …).
-- Wird in einem Wochenraster per Drag & Drop verschoben.
-- Idempotent. Im Supabase SQL-Editor einmal ausführen.
-- ============================================================================

create table if not exists public.dispo_entries (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid references public.projects (id) on delete set null,
  employee_id  uuid references public.employees (id) on delete set null,
  date         date not null,
  title        text not null,
  kind         text not null default 'einsatz',  -- einsatz | montage | aufmass | wartung | sonstiges
  note         text,
  created_by   uuid references public.employees (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists dispo_entries_date_idx on public.dispo_entries (date);
create index if not exists dispo_entries_employee_idx on public.dispo_entries (employee_id, date);

alter table public.dispo_entries enable row level security;

drop policy if exists "de_select" on public.dispo_entries;
create policy "de_select" on public.dispo_entries for select using (public.is_staff());
drop policy if exists "de_insert" on public.dispo_entries;
create policy "de_insert" on public.dispo_entries for insert with check (public.is_staff());
drop policy if exists "de_update" on public.dispo_entries;
create policy "de_update" on public.dispo_entries for update using (public.is_staff()) with check (public.is_staff());
drop policy if exists "de_delete" on public.dispo_entries;
create policy "de_delete" on public.dispo_entries for delete using (public.is_staff());


-- ============================================================================
-- ip³ PV-Tool — Aufmaß (Paket 17)
-- Aufmaß-Positionen je Projekt (Dachflächen, Stückzahlen, Längen …), die in
-- eine Kalkulation übernommen werden können.
-- Idempotent. Im Supabase SQL-Editor einmal ausführen.
-- ============================================================================

create table if not exists public.measurements (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects (id) on delete cascade,
  label       text not null,
  quantity    numeric,
  unit        text,
  area        numeric,
  note        text,
  sort        int not null default 0,
  created_by  uuid references public.employees (id) on delete set null,
  created_at  timestamptz not null default now()
);
create index if not exists measurements_project_idx on public.measurements (project_id, sort);

alter table public.measurements enable row level security;

drop policy if exists "ms_select" on public.measurements;
create policy "ms_select" on public.measurements for select using (public.is_staff());
drop policy if exists "ms_insert" on public.measurements;
create policy "ms_insert" on public.measurements for insert with check (public.is_staff());
drop policy if exists "ms_update" on public.measurements;
create policy "ms_update" on public.measurements for update using (public.is_staff()) with check (public.is_staff());
drop policy if exists "ms_delete" on public.measurements;
create policy "ms_delete" on public.measurements for delete using (public.is_staff());


-- ============================================================================
-- ip³ PV-Tool — Bautagebuch / Baustellendokumentation (Paket 18)
-- Chronologische Einträge je Projekt (Datum, Wetter, Mannschaft, Arbeiten).
-- Fotos werden über die bestehende project_files-Ablage verknüpft.
-- Idempotent. Im Supabase SQL-Editor einmal ausführen.
-- ============================================================================

create table if not exists public.site_log (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects (id) on delete cascade,
  log_date    date not null default current_date,
  weather     text,
  crew        text,
  work_done   text,
  note        text,
  created_by  uuid references public.employees (id) on delete set null,
  created_at  timestamptz not null default now()
);
create index if not exists site_log_project_idx on public.site_log (project_id, log_date desc);

alter table public.site_log enable row level security;

drop policy if exists "sl_select" on public.site_log;
create policy "sl_select" on public.site_log for select using (public.is_staff());
drop policy if exists "sl_insert" on public.site_log;
create policy "sl_insert" on public.site_log for insert with check (public.is_staff());
drop policy if exists "sl_update" on public.site_log;
create policy "sl_update" on public.site_log for update using (public.is_staff()) with check (public.is_staff());
drop policy if exists "sl_delete" on public.site_log;
create policy "sl_delete" on public.site_log for delete using (public.is_admin() or created_by = public.current_employee_id());


-- ============================================================================
-- ip³ PV-Tool — Ad-hoc-Aufgaben ohne Projekt (Schnell-Rückfrage am Dashboard)
-- project_tasks.project_id darf jetzt NULL sein (projektlose Aufgaben/Rückfragen).
-- Die bestehende FK (on delete cascade) bleibt für projektbezogene Aufgaben gültig.
-- Idempotent. Im Supabase SQL-Editor einmal ausführen.
-- ============================================================================

alter table public.project_tasks alter column project_id drop not null;


-- ============================================================================
-- ip³ PV-Tool — Service-Board (Kanban, getrennt von Wartung) — Paket 3
-- Service-Tickets mit Status-Spalten, Kommentaren und Datei-/Foto-Anhängen.
-- Idempotent. Im Supabase SQL-Editor einmal ausführen.
-- ============================================================================

create table if not exists public.service_tickets (
  id                   uuid primary key default gen_random_uuid(),
  title                text not null,
  customer_id          uuid references public.customers (id) on delete set null,
  project_id           uuid references public.projects (id) on delete set null,
  location             text,
  status               text not null default 'Eingang',
  assignee_employee_id uuid references public.employees (id) on delete set null,
  due_date             date,
  description          text,
  cover_path           text,                       -- Storage-Pfad des Titelbilds
  sort                 int not null default 0,
  source               text,                       -- z. B. 'trello'
  external_id          text,                       -- Trello-Card-ID (Dedupe)
  created_by           uuid references public.employees (id) on delete set null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create index if not exists service_tickets_status_idx on public.service_tickets (status, sort);
create unique index if not exists service_tickets_external_idx
  on public.service_tickets (source, external_id) where external_id is not null;

create table if not exists public.service_ticket_messages (
  id                  uuid primary key default gen_random_uuid(),
  ticket_id           uuid not null references public.service_tickets (id) on delete cascade,
  author_employee_id  uuid references public.employees (id) on delete set null,
  body                text not null,
  kind                text not null default 'message', -- 'message' | 'event'
  created_at          timestamptz not null default now()
);
create index if not exists service_ticket_messages_idx on public.service_ticket_messages (ticket_id, created_at);

create table if not exists public.service_ticket_files (
  id            uuid primary key default gen_random_uuid(),
  ticket_id     uuid not null references public.service_tickets (id) on delete cascade,
  name          text not null,
  storage_path  text not null,
  mime          text,
  size          bigint,
  uploaded_by   uuid references public.employees (id) on delete set null,
  created_at    timestamptz not null default now()
);
create index if not exists service_ticket_files_idx on public.service_ticket_files (ticket_id);

alter table public.service_tickets enable row level security;
alter table public.service_ticket_messages enable row level security;
alter table public.service_ticket_files enable row level security;

drop policy if exists "st_select" on public.service_tickets;
create policy "st_select" on public.service_tickets for select using (public.is_staff());
drop policy if exists "st_insert" on public.service_tickets;
create policy "st_insert" on public.service_tickets for insert with check (public.is_staff());
drop policy if exists "st_update" on public.service_tickets;
create policy "st_update" on public.service_tickets for update using (public.is_staff()) with check (public.is_staff());
drop policy if exists "st_delete" on public.service_tickets;
create policy "st_delete" on public.service_tickets for delete using (public.is_admin() or created_by = public.current_employee_id());

drop policy if exists "stm_select" on public.service_ticket_messages;
create policy "stm_select" on public.service_ticket_messages for select using (public.is_staff());
drop policy if exists "stm_insert" on public.service_ticket_messages;
create policy "stm_insert" on public.service_ticket_messages for insert with check (public.is_staff());
drop policy if exists "stm_delete" on public.service_ticket_messages;
create policy "stm_delete" on public.service_ticket_messages for delete
  using (public.is_admin() or author_employee_id = public.current_employee_id());

drop policy if exists "stf_select" on public.service_ticket_files;
create policy "stf_select" on public.service_ticket_files for select using (public.is_staff());
drop policy if exists "stf_insert" on public.service_ticket_files;
create policy "stf_insert" on public.service_ticket_files for insert with check (public.is_staff());
drop policy if exists "stf_delete" on public.service_ticket_files;
create policy "stf_delete" on public.service_ticket_files for delete
  using (public.is_admin() or uploaded_by = public.current_employee_id());

-- Realtime für Live-Kommentare (idempotent).
do $$
begin
  begin
    alter publication supabase_realtime add table public.service_ticket_messages;
  exception when duplicate_object then null; end;
  begin
    alter publication supabase_realtime add table public.service_tickets;
  exception when duplicate_object then null; end;
end $$;


-- ============================================================================
-- 20260603000100_file_text.sql
-- ============================================================================
-- ============================================================================
-- ip³ PV-Tool — Datei-Volltext + Beleg-Metadaten
-- (1) `text_content`: extrahierter PDF-Text wird gespeichert, damit Dateien
--     intelligent nach Inhalt durchsucht werden können (globale Suche + KI).
-- (2) `doc_meta`: KI-interpretierte Beleg-Felder (Lieferant, Rechnungsnummer,
--     Datum, Fälligkeit, Betrag …) für eingezogene Dokumente/Rechnungen.
-- Idempotent. Im Supabase SQL-Editor einmal ausführen.
-- ============================================================================

-- Volltext für die durchsuchbaren Datei-Tabellen
alter table public.project_files       add column if not exists text_content text;
alter table public.product_assets      add column if not exists text_content text;
alter table public.service_ticket_files add column if not exists text_content text;

-- Beleg-/Dokument-Metadaten (nur Projekt-Dateien — dort landen Rechnungen)
alter table public.project_files add column if not exists doc_meta jsonb;

-- Volltext-Indizes (deutsch) für schnelle Inhaltssuche
create index if not exists project_files_text_idx
  on public.project_files using gin (to_tsvector('german', coalesce(text_content, '')));
create index if not exists product_assets_text_idx
  on public.product_assets using gin (to_tsvector('german', coalesce(text_content, '')));
create index if not exists service_ticket_files_text_idx
  on public.service_ticket_files using gin (to_tsvector('german', coalesce(text_content, '')));


-- ============================================================================
-- 20260604000100_ai_conversations.sql
-- ============================================================================
-- ============================================================================
-- ip³ PV-Tool — KI-Gesprächsverlauf (Persistenz)
-- ai_conversations: ein Gesprächsfaden je Mitarbeiter (privat).
-- ai_messages:      Nachrichten eines Gesprächs (user/assistant).
-- RLS: Nur der eigene Mitarbeiter sieht/ändert seine Gespräche.
-- Idempotent. Im Supabase SQL-Editor einmal ausführen.
-- ============================================================================

create table if not exists public.ai_conversations (
  id          uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees (id) on delete cascade,
  title       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists ai_conversations_employee_idx
  on public.ai_conversations (employee_id, updated_at desc);

create table if not exists public.ai_messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.ai_conversations (id) on delete cascade,
  role            text not null,                 -- 'user' | 'assistant'
  content         text not null,
  created_at      timestamptz not null default now()
);
create index if not exists ai_messages_conversation_idx
  on public.ai_messages (conversation_id, created_at);

alter table public.ai_conversations enable row level security;
alter table public.ai_messages enable row level security;

-- Gespräche: nur Eigentümer (Mitarbeiter)
drop policy if exists "aic_select" on public.ai_conversations;
create policy "aic_select" on public.ai_conversations for select
  using (employee_id = public.current_employee_id());
drop policy if exists "aic_insert" on public.ai_conversations;
create policy "aic_insert" on public.ai_conversations for insert
  with check (employee_id = public.current_employee_id());
drop policy if exists "aic_update" on public.ai_conversations;
create policy "aic_update" on public.ai_conversations for update
  using (employee_id = public.current_employee_id())
  with check (employee_id = public.current_employee_id());
drop policy if exists "aic_delete" on public.ai_conversations;
create policy "aic_delete" on public.ai_conversations for delete
  using (employee_id = public.current_employee_id());

-- Nachrichten: über Konversations-Besitz abgesichert
drop policy if exists "aim_select" on public.ai_messages;
create policy "aim_select" on public.ai_messages for select
  using (exists (select 1 from public.ai_conversations c
    where c.id = conversation_id and c.employee_id = public.current_employee_id()));
drop policy if exists "aim_insert" on public.ai_messages;
create policy "aim_insert" on public.ai_messages for insert
  with check (exists (select 1 from public.ai_conversations c
    where c.id = conversation_id and c.employee_id = public.current_employee_id()));
drop policy if exists "aim_delete" on public.ai_messages;
create policy "aim_delete" on public.ai_messages for delete
  using (exists (select 1 from public.ai_conversations c
    where c.id = conversation_id and c.employee_id = public.current_employee_id()));


-- ============================================================================
-- 20260605000100_embeddings.sql
-- ============================================================================
-- ============================================================================
-- ip³ PV-Tool — Semantische Dokumentsuche (pgvector)
-- Embeddings (OpenAI text-embedding-3-small, 1536 Dim.) für den extrahierten
-- Datei-Volltext. Ermöglicht Bedeutungs-Suche statt nur Stichwort.
-- Idempotent. Im Supabase SQL-Editor einmal ausführen.
-- HINWEIS: Erfordert die Extension `vector` (in Supabase verfügbar).
-- ============================================================================

create extension if not exists vector;

alter table public.project_files       add column if not exists embedding vector(1536);
alter table public.product_assets      add column if not exists embedding vector(1536);
alter table public.service_ticket_files add column if not exists embedding vector(1536);

create index if not exists project_files_embedding_idx
  on public.project_files using hnsw (embedding vector_cosine_ops);
create index if not exists product_assets_embedding_idx
  on public.product_assets using hnsw (embedding vector_cosine_ops);
create index if not exists service_ticket_files_embedding_idx
  on public.service_ticket_files using hnsw (embedding vector_cosine_ops);

-- Ähnlichkeitssuche über alle Datei-Quellen. SECURITY INVOKER (Default) →
-- RLS der zugrunde liegenden Tabellen gilt für den aufrufenden Nutzer.
create or replace function public.match_documents(
  query_embedding vector(1536),
  match_count int default 8
)
returns table (source text, name text, owner text, content text, similarity float)
language sql
stable
as $$
  with hits as (
    select 'Projekt'::text as source, pf.name,
           coalesce(p.title, 'Projekt') as owner,
           left(coalesce(pf.text_content, ''), 600) as content,
           1 - (pf.embedding <=> query_embedding) as similarity
    from public.project_files pf
    left join public.projects p on p.id = pf.project_id
    where pf.embedding is not null
    union all
    select 'Produkt'::text, pa.name,
           coalesce(pr.name, 'Produkt'),
           left(coalesce(pa.text_content, ''), 600),
           1 - (pa.embedding <=> query_embedding)
    from public.product_assets pa
    left join public.products pr on pr.id = pa.product_id
    where pa.embedding is not null
    union all
    select 'Service'::text, sf.name,
           coalesce(t.title, 'Ticket'),
           left(coalesce(sf.text_content, ''), 600),
           1 - (sf.embedding <=> query_embedding)
    from public.service_ticket_files sf
    left join public.service_tickets t on t.id = sf.ticket_id
    where sf.embedding is not null
  )
  select * from hits order by similarity desc limit match_count;
$$;
