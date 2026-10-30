-- =====================================================================
-- HPAD Travel Management System — Super Admin helpers
-- =====================================================================

-- Per-person counts for the Manage Admins / Manage Employees screens.
-- SECURITY INVOKER: RLS limits which profiles and requests are counted.
create or replace function public.get_people_stats()
returns table (
  profile_id uuid,
  employees  bigint,
  requests   bigint,
  received   bigint,
  pending    bigint,
  approved   bigint,
  rejected   bigint)
language sql stable security invoker
set search_path = ''
as $$
  select p.id,
         (select count(*) from public.profiles e where e.assigned_admin_id = p.id),
         (select count(*) from public.travel_requests r where r.employee_id = p.id and r.status <> 'draft'),
         (select count(*) from public.travel_requests r where r.assigned_admin_id = p.id and r.status <> 'draft'),
         (select count(*) from public.travel_requests r where r.assigned_admin_id = p.id and r.status = 'pending'),
         (select count(*) from public.travel_requests r where r.assigned_admin_id = p.id and r.status = 'approved'),
         (select count(*) from public.travel_requests r where r.assigned_admin_id = p.id and r.status = 'rejected')
    from public.profiles p;
$$;

-- Lets the Super Admin record actions that happen outside the database
-- (e.g. sending a password reset email) in the audit trail.
create or replace function public.log_admin_action(
  p_action text, p_entity_type text, p_entity_id uuid, p_data jsonb default null)
returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  if not public.is_super_admin() then
    raise exception 'Not authorised' using errcode = '42501';
  end if;
  if p_action !~ '^[a-z_]{3,60}$' then
    raise exception 'Invalid action name' using errcode = '22023';
  end if;
  insert into public.audit_logs (actor_user_id, actor_name, action, entity_type, entity_id, new_data)
  values (public.current_profile_id(),
          (select full_name from public.profiles where id = public.current_profile_id()),
          p_action, p_entity_type, p_entity_id, p_data);
end;
$$;

revoke execute on function public.get_people_stats() from public, anon;
revoke execute on function public.log_admin_action(text, text, uuid, jsonb) from public, anon;
grant execute on function public.get_people_stats() to authenticated;
grant execute on function public.log_admin_action(text, text, uuid, jsonb) to authenticated;
