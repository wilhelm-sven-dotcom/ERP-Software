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
