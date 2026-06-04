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
