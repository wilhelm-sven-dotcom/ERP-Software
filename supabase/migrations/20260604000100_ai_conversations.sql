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
