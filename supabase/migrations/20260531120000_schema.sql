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
