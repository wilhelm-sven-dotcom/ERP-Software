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
