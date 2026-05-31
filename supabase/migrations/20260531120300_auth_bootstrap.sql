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
