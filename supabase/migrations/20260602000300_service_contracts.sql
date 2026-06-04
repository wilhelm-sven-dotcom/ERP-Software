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
