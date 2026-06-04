-- ============================================================================
-- ip³ PV-Tool — Eingangsrechnungen (Lieferantenrechnungen)
-- Aus einem ausgelesenen Beleg (project_files.doc_meta) als offener Posten
-- verbuchbar; Zahlungsstatus pflegbar. Idempotent.
-- ============================================================================

create table if not exists public.incoming_invoices (
  id              uuid primary key default gen_random_uuid(),
  supplier        text,
  invoice_number  text,
  invoice_date    date,
  due_date        date,
  amount          numeric,
  currency        text not null default 'EUR',
  project_id      uuid references public.projects (id) on delete set null,
  source_file_id  uuid references public.project_files (id) on delete set null,
  status          text not null default 'offen',   -- offen | bezahlt
  paid_at         timestamptz,
  notes           text,
  created_by      uuid references public.employees (id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists incoming_invoices_status_idx on public.incoming_invoices (status, due_date);
create index if not exists incoming_invoices_file_idx on public.incoming_invoices (source_file_id);

alter table public.incoming_invoices enable row level security;
drop policy if exists "ii_select" on public.incoming_invoices;
create policy "ii_select" on public.incoming_invoices for select using (public.is_staff());
drop policy if exists "ii_insert" on public.incoming_invoices;
create policy "ii_insert" on public.incoming_invoices for insert with check (public.is_staff());
drop policy if exists "ii_update" on public.incoming_invoices;
create policy "ii_update" on public.incoming_invoices for update using (public.is_staff()) with check (public.is_staff());
drop policy if exists "ii_delete" on public.incoming_invoices;
create policy "ii_delete" on public.incoming_invoices for delete
  using (public.is_admin() or created_by = public.current_employee_id());
