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
