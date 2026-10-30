-- =====================================================================
-- HPAD Travel Management System — demo data isolation
--
-- Demo rows are flagged is_demo = true. purge_demo_data() removes them
-- (and only them). It is callable only with the server secret key
-- (service_role), never from the browser.
-- History tables stay append-only for everything else.
-- =====================================================================

create or replace function public.prevent_modification()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_setting('hpad.purge_demo', true) = 'on' then
    -- (nested IFs: PL/pgSQL does not short-circuit field references)
    if tg_table_name = 'approval_history' and tg_op = 'DELETE' then
      if exists (select 1 from public.travel_requests r
                  where r.id = (to_jsonb(old) ->> 'travel_request_id')::uuid and r.is_demo) then
        return old;
      end if;
    end if;
    -- ON DELETE SET NULL from a removed demo profile
    if tg_table_name = 'audit_logs' and tg_op = 'UPDATE' then
      if (to_jsonb(new) ->> 'actor_user_id') is null and (to_jsonb(old) ->> 'actor_user_id') is not null
         and (to_jsonb(new) - 'actor_user_id') = (to_jsonb(old) - 'actor_user_id') then
        return new;
      end if;
    end if;
  end if;
  raise exception '% records are permanent and cannot be changed or deleted', tg_table_name
    using errcode = '42501';
end;
$$;

create or replace function public.purge_demo_data()
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_requests integer;
  v_profiles integer;
  v_auth_ids uuid[];
  v_paths    text[];
begin
  perform set_config('hpad.purge_demo', 'on', true);

  select coalesce(array_agg(auth_user_id) filter (where auth_user_id is not null), '{}')
    into v_auth_ids from public.profiles where is_demo;
  select coalesce(array_agg(d.storage_path), '{}') into v_paths
    from public.documents d join public.travel_requests r on r.id = d.travel_request_id
   where r.is_demo;

  delete from public.notifications n
   where n.recipient_user_id in (select id from public.profiles where is_demo)
      or n.travel_request_id in (select id from public.travel_requests where is_demo);
  delete from public.approval_history h
   where h.travel_request_id in (select id from public.travel_requests where is_demo);
  delete from public.travel_requests where is_demo;
  get diagnostics v_requests = row_count;

  delete from public.profiles where is_demo and role = 'employee';
  delete from public.profiles where is_demo and role = 'admin';
  delete from public.profiles where is_demo;
  get diagnostics v_profiles = row_count;

  -- Re-align request numbers with the real data that remains.
  update public.request_counters c
     set last_value = coalesce((
       select max(split_part(request_number, '-', 3)::integer)
         from public.travel_requests
        where split_part(request_number, '-', 2)::integer = c.year), 0);

  return jsonb_build_object('requests_deleted', v_requests, 'auth_user_ids', to_jsonb(v_auth_ids),
                            'storage_paths', to_jsonb(v_paths));
end;
$$;

revoke execute on function public.purge_demo_data() from public, anon, authenticated;
grant execute on function public.purge_demo_data() to service_role;
