-- =====================================================================
-- HPAD Travel Management System — Row Level Security, storage, realtime
--
-- Model:
--   employee     → own profile, own admin's name, own requests (incl. drafts)
--   admin        → own profile, assigned employees, their submitted requests
--   super_admin  → everything except other people's drafts
-- Writes to travel data go only through the RPCs in 0002; there are no
-- INSERT/UPDATE/DELETE policies on those tables.
-- =====================================================================

alter table public.profiles           enable row level security;
alter table public.travel_requests    enable row level security;
alter table public.flight_details     enable row level security;
alter table public.site_visit_details enable row level security;
alter table public.approval_history   enable row level security;
alter table public.notifications      enable row level security;
alter table public.documents          enable row level security;
alter table public.audit_logs         enable row level security;
alter table public.request_counters   enable row level security;

-- Defence in depth: the browser roles may never write these tables directly.
revoke all on all tables in schema public from anon;
revoke insert, update, delete, truncate on public.travel_requests,
  public.flight_details, public.site_visit_details, public.approval_history,
  public.audit_logs, public.request_counters from authenticated;
revoke all on public.request_counters from authenticated;
revoke update, truncate on public.documents from authenticated;
revoke insert, delete, truncate on public.notifications from authenticated;
revoke update on public.notifications from authenticated;
grant update (is_read) on public.notifications to authenticated;
revoke delete, truncate on public.profiles from authenticated;

-- ---------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------
create policy profiles_select on public.profiles
  for select to authenticated
  using (
    id = (select public.current_profile_id())
    or (select public.is_super_admin())
    or ((select public.current_user_role()) = 'admin'
        and assigned_admin_id = (select public.current_profile_id()))
    or id = (select public.my_admin_id())
  );

create policy profiles_insert_super_admin on public.profiles
  for insert to authenticated
  with check ((select public.is_super_admin()));

-- Self-updates are limited to the phone number by the profiles_validate trigger.
create policy profiles_update on public.profiles
  for update to authenticated
  using (id = (select public.current_profile_id()) or (select public.is_super_admin()))
  with check (id = (select public.current_profile_id()) or (select public.is_super_admin()));

-- ---------------------------------------------------------------------
-- travel_requests
-- ---------------------------------------------------------------------
create policy travel_requests_select on public.travel_requests
  for select to authenticated
  using (
    employee_id = (select public.current_profile_id())
    or (status <> 'draft' and (
          (select public.is_super_admin())
          or ((select public.current_user_role()) = 'admin' and (
                assigned_admin_id = (select public.current_profile_id())
                or public.is_admin_of(employee_id)))))
  );

-- Child tables inherit visibility from their parent request (whose RLS applies).
create policy flight_details_select on public.flight_details
  for select to authenticated
  using (exists (select 1 from public.travel_requests r where r.id = travel_request_id));

create policy site_visit_details_select on public.site_visit_details
  for select to authenticated
  using (exists (select 1 from public.travel_requests r where r.id = travel_request_id));

create policy approval_history_select on public.approval_history
  for select to authenticated
  using (exists (select 1 from public.travel_requests r where r.id = travel_request_id));

-- ---------------------------------------------------------------------
-- documents
-- ---------------------------------------------------------------------
create policy documents_select on public.documents
  for select to authenticated
  using (exists (select 1 from public.travel_requests r where r.id = travel_request_id));

create policy documents_insert_owner on public.documents
  for insert to authenticated
  with check (
    uploaded_by = (select public.current_profile_id())
    and exists (
      select 1 from public.travel_requests r
       where r.id = travel_request_id
         and r.employee_id = (select public.current_profile_id())
         and r.status in ('draft', 'pending'))
  );

create policy documents_delete_owner_draft on public.documents
  for delete to authenticated
  using (exists (
    select 1 from public.travel_requests r
     where r.id = travel_request_id
       and r.employee_id = (select public.current_profile_id())
       and r.status = 'draft'));

-- ---------------------------------------------------------------------
-- notifications — own only; only is_read can be updated (column grant)
-- ---------------------------------------------------------------------
create policy notifications_select_own on public.notifications
  for select to authenticated
  using (recipient_user_id = (select public.current_profile_id()));

create policy notifications_update_own on public.notifications
  for update to authenticated
  using (recipient_user_id = (select public.current_profile_id()))
  with check (recipient_user_id = (select public.current_profile_id()));

-- ---------------------------------------------------------------------
-- audit_logs — super admin read-only
-- ---------------------------------------------------------------------
create policy audit_logs_select_super_admin on public.audit_logs
  for select to authenticated
  using ((select public.is_super_admin()));

-- ---------------------------------------------------------------------
-- Storage: private bucket, path = <travel_request_id>/<file>
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('travel-documents', 'travel-documents', false, 10485760,
        array['application/pdf', 'image/jpeg', 'image/png'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy travel_docs_insert_owner on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'travel-documents'
    and exists (
      select 1 from public.travel_requests r
       where r.id::text = (storage.foldername(name))[1]
         and r.employee_id = (select public.current_profile_id())
         and r.status in ('draft', 'pending'))
  );

-- Read access (and therefore signed URLs) follows request visibility.
create policy travel_docs_select_visible on storage.objects
  for select to authenticated
  using (
    bucket_id = 'travel-documents'
    and exists (
      select 1 from public.travel_requests r
       where r.id::text = (storage.foldername(name))[1])
  );

create policy travel_docs_delete_owner_draft on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'travel-documents'
    and exists (
      select 1 from public.travel_requests r
       where r.id::text = (storage.foldername(name))[1]
         and r.employee_id = (select public.current_profile_id())
         and r.status = 'draft')
  );

-- ---------------------------------------------------------------------
-- Realtime (postgres_changes respects the RLS policies above)
-- ---------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.travel_requests;
    alter publication supabase_realtime add table public.notifications;
    alter publication supabase_realtime add table public.approval_history;
  end if;
end;
$$;
