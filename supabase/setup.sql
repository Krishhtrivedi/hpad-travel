-- HPAD Travel Management System — complete database setup
-- Generated from supabase/migrations by `npm run db:bundle`. Run once on a new project.

-- >>> 20261030000001_schema.sql
-- =====================================================================
-- HPAD Travel Management System — core schema
-- Tables, types, constraints and indexes.
-- =====================================================================

-- gen_random_uuid() is built into PostgreSQL 13+, no extension needed.

-- ---------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------
create type public.user_role as enum ('super_admin', 'admin', 'employee');
create type public.travel_type as enum ('flight', 'site_visit', 'other');
create type public.request_status as enum ('draft', 'pending', 'approved', 'rejected');
create type public.approval_action as enum ('approved', 'rejected');
create type public.document_kind as enum ('flight_ticket', 'supporting');

-- ---------------------------------------------------------------------
-- Generic updated_at trigger
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- 1. profiles
-- ---------------------------------------------------------------------
create table public.profiles (
  id                uuid primary key default gen_random_uuid(),
  auth_user_id      uuid unique references auth.users (id) on delete set null,
  employee_id       text not null unique,
  full_name         text not null check (char_length(btrim(full_name)) between 2 and 120),
  email             text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  phone             text check (phone is null or phone ~ '^[0-9+()\-\s]{7,20}$'),
  department        text,
  role              public.user_role not null default 'employee',
  assigned_admin_id uuid references public.profiles (id) on delete restrict,
  is_active         boolean not null default true,
  is_demo           boolean not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint profiles_employee_requires_admin check (role <> 'employee' or assigned_admin_id is not null),
  constraint profiles_only_employees_have_admin check (role = 'employee' or assigned_admin_id is null),
  constraint profiles_no_self_assignment check (assigned_admin_id is null or assigned_admin_id <> id)
);

create unique index profiles_email_lower_key on public.profiles (lower(email));
create index profiles_assigned_admin_idx on public.profiles (assigned_admin_id);
create index profiles_role_idx on public.profiles (role, is_active);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- Request number counter (TRV-YYYY-0001)
-- ---------------------------------------------------------------------
create table public.request_counters (
  year       integer primary key,
  last_value integer not null default 0
);

-- ---------------------------------------------------------------------
-- 2. travel_requests
-- Snapshot columns (employee_name, assigned_admin_name, reviewed_by_name …)
-- preserve who was involved at the time, even if profiles change later.
-- ---------------------------------------------------------------------
create table public.travel_requests (
  id                      uuid primary key default gen_random_uuid(),
  request_number          text unique,
  employee_id             uuid not null references public.profiles (id) on delete restrict,
  assigned_admin_id       uuid references public.profiles (id) on delete restrict,

  -- historical snapshots
  employee_name           text not null,
  employee_code           text not null,
  employee_department     text,
  employee_email          text not null,
  assigned_admin_name     text,

  travel_type             public.travel_type not null default 'other',
  mobile_number           text,
  departure_city          text not null default 'Ahmedabad',
  destination_city        text,
  destination_state       text,
  destination_country     text default 'India',
  travel_purpose          text,
  travel_description      text,
  departure_date          date,
  return_date             date,
  departure_time          time,
  return_time             time,
  estimated_expenses      numeric(12, 2) check (estimated_expenses is null or estimated_expenses >= 0),
  accommodation_required  boolean not null default false,
  transportation_required boolean not null default false,
  additional_remarks      text,
  additional_notes        text,

  status                  public.request_status not null default 'draft',
  review_comments         text,
  submitted_at            timestamptz,
  reviewed_at             timestamptz,
  reviewed_by             uuid references public.profiles (id) on delete restrict,
  reviewed_by_name        text,

  client_token            uuid unique,
  is_demo                 boolean not null default false,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),

  constraint travel_requests_dates_order
    check (departure_date is null or return_date is null or return_date >= departure_date),
  constraint travel_requests_submitted_complete
    check (status = 'draft' or (
      request_number is not null and assigned_admin_id is not null and submitted_at is not null
      and destination_city is not null and travel_purpose is not null
      and departure_date is not null and return_date is not null)),
  constraint travel_requests_reviewed_complete
    check (status not in ('approved', 'rejected') or (reviewed_at is not null and reviewed_by is not null)),
  constraint travel_requests_rejection_reason
    check (status <> 'rejected' or nullif(btrim(review_comments), '') is not null),
  constraint travel_requests_number_format
    check (request_number is null or request_number ~ '^TRV-[0-9]{4}-[0-9]{4,}$')
);

create index travel_requests_employee_idx on public.travel_requests (employee_id, created_at desc);
create index travel_requests_admin_status_idx on public.travel_requests (assigned_admin_id, status);
create index travel_requests_status_departure_idx on public.travel_requests (status, departure_date);
create index travel_requests_submitted_idx on public.travel_requests (submitted_at desc);
create index travel_requests_destination_idx on public.travel_requests (lower(destination_city));

create trigger travel_requests_set_updated_at
  before update on public.travel_requests
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- 3. flight_details (one per request)
-- ---------------------------------------------------------------------
create table public.flight_details (
  id                   uuid primary key default gen_random_uuid(),
  travel_request_id    uuid not null unique references public.travel_requests (id) on delete cascade,
  airline_name         text,
  flight_number        text,
  departure_airport    text,
  arrival_airport      text,
  departure_datetime   timestamptz,
  return_flight_number text,
  return_datetime      timestamptz,
  booking_reference    text
);

-- ---------------------------------------------------------------------
-- 4. site_visit_details (one per request)
-- ---------------------------------------------------------------------
create table public.site_visit_details (
  id                  uuid primary key default gen_random_uuid(),
  travel_request_id   uuid not null unique references public.travel_requests (id) on delete cascade,
  client_company_name text,
  site_address        text,
  site_city           text,
  contact_person      text,
  contact_number      text,
  visit_purpose       text,
  expected_duration   text,
  additional_notes    text
);

-- ---------------------------------------------------------------------
-- 5. approval_history (append-only)
-- ---------------------------------------------------------------------
create table public.approval_history (
  id                uuid primary key default gen_random_uuid(),
  travel_request_id uuid not null references public.travel_requests (id) on delete restrict,
  admin_id          uuid not null references public.profiles (id) on delete restrict,
  admin_name        text not null,
  previous_status   public.request_status not null,
  new_status        public.request_status not null,
  action            public.approval_action not null,
  comments          text,
  action_timestamp  timestamptz not null default now()
);

create index approval_history_request_idx on public.approval_history (travel_request_id, action_timestamp);
create index approval_history_admin_idx on public.approval_history (admin_id, action_timestamp desc);

-- ---------------------------------------------------------------------
-- 6. notifications
-- recipient_user_id references profiles.id (the app user, not auth.users)
-- ---------------------------------------------------------------------
create table public.notifications (
  id                uuid primary key default gen_random_uuid(),
  recipient_user_id uuid not null references public.profiles (id) on delete cascade,
  travel_request_id uuid references public.travel_requests (id) on delete cascade,
  notification_type text not null check (notification_type in (
    'request_submitted', 'request_approved', 'request_rejected', 'admin_comment',
    'new_request', 'pending_reminder', 'request_reassigned',
    'system_activity', 'admin_created', 'employee_account_change')),
  title             text not null,
  message           text not null,
  is_read           boolean not null default false,
  created_at        timestamptz not null default now()
);

create index notifications_recipient_idx on public.notifications (recipient_user_id, is_read, created_at desc);

-- ---------------------------------------------------------------------
-- 7. documents
-- ---------------------------------------------------------------------
create table public.documents (
  id                uuid primary key default gen_random_uuid(),
  travel_request_id uuid not null references public.travel_requests (id) on delete cascade,
  uploaded_by       uuid not null references public.profiles (id) on delete restrict,
  document_kind     public.document_kind not null default 'supporting',
  file_name         text not null check (char_length(file_name) between 1 and 200),
  file_type         text not null check (file_type in ('application/pdf', 'image/jpeg', 'image/png')),
  file_size         integer not null check (file_size > 0 and file_size <= 10485760),
  storage_path      text not null unique,
  uploaded_at       timestamptz not null default now(),
  constraint documents_path_matches_request check (storage_path like travel_request_id::text || '/%')
);

create index documents_request_idx on public.documents (travel_request_id);

-- ---------------------------------------------------------------------
-- 8. audit_logs (append-only)
-- ---------------------------------------------------------------------
create table public.audit_logs (
  id            uuid primary key default gen_random_uuid(),
  actor_user_id uuid references public.profiles (id) on delete set null,
  actor_name    text,
  action        text not null,
  entity_type   text not null,
  entity_id     uuid,
  previous_data jsonb,
  new_data      jsonb,
  created_at    timestamptz not null default now()
);

create index audit_logs_created_idx on public.audit_logs (created_at desc);
create index audit_logs_entity_idx on public.audit_logs (entity_type, entity_id);
create index audit_logs_actor_idx on public.audit_logs (actor_user_id, created_at desc);

-- ---------------------------------------------------------------------
-- Append-only guards
-- ---------------------------------------------------------------------
create or replace function public.prevent_modification()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception '% records are permanent and cannot be changed or deleted', tg_table_name
    using errcode = '42501';
end;
$$;

create trigger approval_history_append_only
  before update or delete on public.approval_history
  for each row execute function public.prevent_modification();

create trigger audit_logs_append_only
  before update or delete on public.audit_logs
  for each row execute function public.prevent_modification();

-- >>> 20261030000002_functions.sql
-- =====================================================================
-- HPAD Travel Management System — business logic
-- Identity helpers, request lifecycle RPCs, audit + notification triggers.
-- All writes to travel data happen here, inside transactions, so the
-- rules cannot be bypassed from the browser.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Identity helpers (security definer so they can be used inside RLS
-- policies without recursion). Inactive accounts resolve to NULL and
-- therefore lose all data access immediately.
-- ---------------------------------------------------------------------
create or replace function public.current_profile_id()
returns uuid
language sql stable security definer
set search_path = ''
as $$
  select id from public.profiles
  where auth_user_id = auth.uid() and is_active
  limit 1;
$$;

create or replace function public.current_user_role()
returns public.user_role
language sql stable security definer
set search_path = ''
as $$
  select role from public.profiles
  where auth_user_id = auth.uid() and is_active
  limit 1;
$$;

create or replace function public.is_super_admin()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select coalesce(public.current_user_role() = 'super_admin', false);
$$;

create or replace function public.my_admin_id()
returns uuid
language sql stable security definer
set search_path = ''
as $$
  select assigned_admin_id from public.profiles
  where auth_user_id = auth.uid() and is_active
  limit 1;
$$;

create or replace function public.is_admin_of(p_employee uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles e
    where e.id = p_employee
      and e.assigned_admin_id = public.current_profile_id()
      and public.current_user_role() = 'admin'
  );
$$;

create or replace function public.today_ist()
returns date
language sql stable
set search_path = ''
as $$
  select (now() at time zone 'Asia/Kolkata')::date;
$$;

-- ---------------------------------------------------------------------
-- Request number generator — atomic per-year counter.
-- ---------------------------------------------------------------------
create or replace function public.next_request_number()
returns text
language plpgsql security definer
set search_path = ''
as $$
declare
  v_year integer := extract(year from (now() at time zone 'Asia/Kolkata'))::integer;
  v_n    integer;
begin
  insert into public.request_counters (year, last_value)
  values (v_year, 1)
  on conflict (year) do update
    set last_value = public.request_counters.last_value + 1
  returning last_value into v_n;

  return 'TRV-' || v_year || '-' ||
         case when v_n < 10000 then lpad(v_n::text, 4, '0') else v_n::text end;
end;
$$;

-- ---------------------------------------------------------------------
-- Notifications helper
-- ---------------------------------------------------------------------
create or replace function public.notify(
  p_recipient uuid, p_request uuid, p_type text, p_title text, p_message text)
returns void
language sql security definer
set search_path = ''
as $$
  insert into public.notifications (recipient_user_id, travel_request_id, notification_type, title, message)
  select p_recipient, p_request, p_type, p_title, p_message
  where p_recipient is not null;
$$;

create or replace function public.notify_super_admins(
  p_type text, p_title text, p_message text, p_exclude uuid default null)
returns void
language sql security definer
set search_path = ''
as $$
  insert into public.notifications (recipient_user_id, notification_type, title, message)
  select id, p_type, p_title, p_message
  from public.profiles
  where role = 'super_admin' and is_active
    and (p_exclude is null or id <> p_exclude);
$$;

-- ---------------------------------------------------------------------
-- Profile triggers: validation, column protection, audit, notifications,
-- reassignment of pending requests.
-- ---------------------------------------------------------------------
create or replace function public.validate_profile()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  new.email := lower(btrim(new.email));
  new.full_name := btrim(new.full_name);
  new.employee_id := upper(btrim(new.employee_id));

  if new.assigned_admin_id is not null and not exists (
    select 1 from public.profiles p
    where p.id = new.assigned_admin_id and p.role = 'admin') then
    raise exception 'The reporting admin must be an account with the Admin role'
      using errcode = '23514';
  end if;

  if tg_op = 'UPDATE' then
    -- Signed-in users who are not super admins may only change their phone number.
    if auth.uid() is not null and not public.is_super_admin() then
      if new.role is distinct from old.role
         or new.assigned_admin_id is distinct from old.assigned_admin_id
         or new.employee_id is distinct from old.employee_id
         or new.email is distinct from old.email
         or new.full_name is distinct from old.full_name
         or new.department is distinct from old.department
         or new.is_active is distinct from old.is_active
         or new.auth_user_id is distinct from old.auth_user_id
         or new.is_demo is distinct from old.is_demo then
        raise exception 'You are only allowed to update your phone number'
          using errcode = '42501';
      end if;
    end if;

    if old.role = 'admin' and new.role <> 'admin' and exists (
      select 1 from public.profiles e where e.assigned_admin_id = old.id) then
      raise exception 'Reassign this admin''s employees before changing their role'
        using errcode = '23514';
    end if;

    if old.role = 'admin' and old.is_active and not new.is_active and exists (
      select 1 from public.profiles e where e.assigned_admin_id = old.id and e.is_active) then
      raise exception 'Reassign this admin''s active employees before deactivating the account'
        using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

create trigger profiles_validate
  before insert or update on public.profiles
  for each row execute function public.validate_profile();

create or replace function public.after_profile_change()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  v_actor      uuid := public.current_profile_id();
  v_actor_name text := (select full_name from public.profiles where id = public.current_profile_id());
  v_admin_name text;
  v_action     text;
begin
  if tg_op = 'INSERT' then
    v_action := case new.role when 'admin' then 'admin_created'
                              when 'super_admin' then 'super_admin_created'
                              else 'employee_created' end;
    insert into public.audit_logs (actor_user_id, actor_name, action, entity_type, entity_id, new_data)
    values (v_actor, v_actor_name, v_action, 'profile', new.id, to_jsonb(new));

    if new.role = 'admin' then
      perform public.notify_super_admins('admin_created', 'New admin created',
        new.full_name || ' (' || new.employee_id || ') was added as an Admin.', v_actor);
    elsif new.role = 'employee' then
      perform public.notify_super_admins('employee_account_change', 'New employee account',
        new.full_name || ' (' || new.employee_id || ') was added.', v_actor);
    end if;
    return new;
  end if;

  -- UPDATE
  if new.assigned_admin_id is distinct from old.assigned_admin_id then
    v_action := 'assignment_changed';
  elsif new.is_active is distinct from old.is_active then
    v_action := case when new.is_active then 'account_activated' else 'account_deactivated' end;
  elsif new.role is distinct from old.role then
    v_action := 'role_changed';
  else
    v_action := 'profile_updated';
  end if;

  if to_jsonb(new) - 'updated_at' is distinct from to_jsonb(old) - 'updated_at' then
    insert into public.audit_logs (actor_user_id, actor_name, action, entity_type, entity_id, previous_data, new_data)
    values (v_actor, v_actor_name, v_action, 'profile', new.id, to_jsonb(old), to_jsonb(new));
  end if;

  if v_action in ('assignment_changed', 'account_activated', 'account_deactivated', 'role_changed') then
    perform public.notify_super_admins('employee_account_change', 'Account change',
      new.full_name || ': ' || replace(v_action, '_', ' ') || '.', v_actor);
  end if;

  -- Move pending requests to the new reporting admin.
  if new.role = 'employee' and new.assigned_admin_id is distinct from old.assigned_admin_id then
    select full_name into v_admin_name from public.profiles where id = new.assigned_admin_id;

    update public.travel_requests
       set assigned_admin_id = new.assigned_admin_id,
           assigned_admin_name = v_admin_name
     where employee_id = new.id and status = 'pending';

    insert into public.notifications (recipient_user_id, travel_request_id, notification_type, title, message)
    select new.assigned_admin_id, r.id, 'request_reassigned', 'Request reassigned to you',
           r.request_number || ' from ' || new.full_name || ' now needs your review.'
      from public.travel_requests r
     where r.employee_id = new.id and r.status = 'pending';
  end if;

  return new;
end;
$$;

create trigger profiles_after_change
  after insert or update on public.profiles
  for each row execute function public.after_profile_change();

-- ---------------------------------------------------------------------
-- Travel request audit trigger (status transitions only; drafts are noise)
-- ---------------------------------------------------------------------
create or replace function public.after_request_change()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  v_actor uuid := public.current_profile_id();
begin
  if tg_op = 'UPDATE' and new.status is distinct from old.status then
    insert into public.audit_logs (actor_user_id, actor_name, action, entity_type, entity_id, previous_data, new_data)
    values (
      v_actor,
      (select full_name from public.profiles where id = v_actor),
      case new.status when 'pending' then 'request_submitted'
                      when 'approved' then 'request_approved'
                      when 'rejected' then 'request_rejected'
                      else 'request_status_changed' end,
      'travel_request', new.id,
      jsonb_build_object('status', old.status),
      jsonb_build_object('status', new.status, 'request_number', new.request_number,
                         'review_comments', new.review_comments));
  elsif tg_op = 'INSERT' and new.status <> 'draft' then
    insert into public.audit_logs (actor_user_id, actor_name, action, entity_type, entity_id, new_data)
    values (v_actor, (select full_name from public.profiles where id = v_actor),
            'request_' || new.status::text, 'travel_request', new.id,
            jsonb_build_object('status', new.status, 'request_number', new.request_number));
  end if;
  return new;
end;
$$;

create trigger travel_requests_after_change
  after insert or update on public.travel_requests
  for each row execute function public.after_request_change();

-- Submitted requests are immutable except for review fields and admin reassignment.
create or replace function public.guard_request_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status in ('approved', 'rejected') then
    raise exception 'Request % has already been decided and cannot be changed', old.request_number
      using errcode = '42501';
  end if;
  if old.status = 'pending' and new.status = 'draft' then
    raise exception 'A submitted request cannot return to draft' using errcode = '42501';
  end if;
  if old.status = 'pending' and (
       new.travel_type, new.destination_city, new.destination_state, new.destination_country,
       new.departure_date, new.return_date, new.departure_time, new.return_time,
       new.travel_purpose, new.travel_description, new.estimated_expenses, new.employee_id,
       new.request_number, new.submitted_at)
     is distinct from (
       old.travel_type, old.destination_city, old.destination_state, old.destination_country,
       old.departure_date, old.return_date, old.departure_time, old.return_time,
       old.travel_purpose, old.travel_description, old.estimated_expenses, old.employee_id,
       old.request_number, old.submitted_at) then
    raise exception 'Submitted requests cannot be modified' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger travel_requests_guard_update
  before update on public.travel_requests
  for each row execute function public.guard_request_update();

-- ---------------------------------------------------------------------
-- RPC: save (draft) or submit a travel request
-- p_payload keys mirror the form; nested "flight" and "site_visit" objects.
-- ---------------------------------------------------------------------
create or replace function public.save_travel_request(
  p_request_id   uuid,
  p_payload      jsonb,
  p_submit       boolean default false,
  p_client_token uuid default null)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_me      public.profiles;
  v_admin   public.profiles;
  v_req     public.travel_requests;
  v_type    public.travel_type;
  v_flight  jsonb := coalesce(p_payload -> 'flight', '{}'::jsonb);
  v_site    jsonb := coalesce(p_payload -> 'site_visit', '{}'::jsonb);
  v_today   date := public.today_ist();
  v_number  text;
  v_recent  integer;
begin
  select * into v_me from public.profiles where auth_user_id = auth.uid() and is_active;
  if not found then
    raise exception 'Your account is not active' using errcode = '42501';
  end if;
  if v_me.role <> 'employee' then
    raise exception 'Only employees can create travel requests' using errcode = '42501';
  end if;

  -- Idempotency: a repeated create with the same client token returns the same row.
  if p_request_id is null and p_client_token is not null then
    select id into p_request_id from public.travel_requests
     where client_token = p_client_token and employee_id = v_me.id;
  end if;

  if p_request_id is not null then
    select * into v_req from public.travel_requests where id = p_request_id for update;
    if not found or v_req.employee_id <> v_me.id then
      raise exception 'Request not found' using errcode = 'P0002';
    end if;
    if v_req.status <> 'draft' then
      if p_submit and v_req.status = 'pending' then
        -- Double-click / retry of a submission: return the existing result.
        return jsonb_build_object('id', v_req.id, 'request_number', v_req.request_number,
                                  'status', v_req.status, 'duplicate', true);
      end if;
      raise exception 'Submitted requests cannot be modified' using errcode = '42501';
    end if;
  end if;

  begin
    v_type := coalesce(nullif(p_payload ->> 'travel_type', ''), 'other')::public.travel_type;
  exception when invalid_text_representation then
    raise exception 'Invalid travel type' using errcode = '22023';
  end;

  if p_request_id is null then
    insert into public.travel_requests (employee_id, employee_name, employee_code,
      employee_department, employee_email, travel_type, client_token)
    values (v_me.id, v_me.full_name, v_me.employee_id, v_me.department, v_me.email,
            v_type, p_client_token)
    returning * into v_req;
  end if;

  update public.travel_requests set
    travel_type             = v_type,
    employee_name           = v_me.full_name,
    employee_code           = v_me.employee_id,
    employee_department     = v_me.department,
    employee_email          = v_me.email,
    mobile_number           = nullif(btrim(p_payload ->> 'mobile_number'), ''),
    departure_city          = coalesce(nullif(btrim(p_payload ->> 'departure_city'), ''), 'Ahmedabad'),
    destination_city        = nullif(btrim(p_payload ->> 'destination_city'), ''),
    destination_state       = nullif(btrim(p_payload ->> 'destination_state'), ''),
    destination_country     = coalesce(nullif(btrim(p_payload ->> 'destination_country'), ''), 'India'),
    travel_purpose          = nullif(btrim(p_payload ->> 'travel_purpose'), ''),
    travel_description      = nullif(btrim(p_payload ->> 'travel_description'), ''),
    departure_date          = nullif(p_payload ->> 'departure_date', '')::date,
    return_date             = nullif(p_payload ->> 'return_date', '')::date,
    departure_time          = nullif(p_payload ->> 'departure_time', '')::time,
    return_time             = nullif(p_payload ->> 'return_time', '')::time,
    estimated_expenses      = nullif(p_payload ->> 'estimated_expenses', '')::numeric,
    accommodation_required  = coalesce((p_payload ->> 'accommodation_required')::boolean, false),
    transportation_required = coalesce((p_payload ->> 'transportation_required')::boolean, false),
    additional_remarks      = nullif(btrim(p_payload ->> 'additional_remarks'), ''),
    additional_notes        = nullif(btrim(p_payload ->> 'additional_notes'), '')
  where id = v_req.id
  returning * into v_req;

  -- Type-specific details
  if v_type = 'flight' then
    insert into public.flight_details (travel_request_id, airline_name, flight_number,
      departure_airport, arrival_airport, departure_datetime, return_flight_number,
      return_datetime, booking_reference)
    values (v_req.id,
      nullif(btrim(v_flight ->> 'airline_name'), ''),
      nullif(upper(btrim(v_flight ->> 'flight_number')), ''),
      nullif(btrim(v_flight ->> 'departure_airport'), ''),
      nullif(btrim(v_flight ->> 'arrival_airport'), ''),
      nullif(v_flight ->> 'departure_datetime', '')::timestamptz,
      nullif(upper(btrim(v_flight ->> 'return_flight_number')), ''),
      nullif(v_flight ->> 'return_datetime', '')::timestamptz,
      nullif(btrim(v_flight ->> 'booking_reference'), ''))
    on conflict (travel_request_id) do update set
      airline_name = excluded.airline_name, flight_number = excluded.flight_number,
      departure_airport = excluded.departure_airport, arrival_airport = excluded.arrival_airport,
      departure_datetime = excluded.departure_datetime,
      return_flight_number = excluded.return_flight_number,
      return_datetime = excluded.return_datetime, booking_reference = excluded.booking_reference;
  else
    delete from public.flight_details where travel_request_id = v_req.id;
  end if;

  if v_type = 'site_visit' then
    insert into public.site_visit_details (travel_request_id, client_company_name, site_address,
      site_city, contact_person, contact_number, visit_purpose, expected_duration, additional_notes)
    values (v_req.id,
      nullif(btrim(v_site ->> 'client_company_name'), ''),
      nullif(btrim(v_site ->> 'site_address'), ''),
      nullif(btrim(v_site ->> 'site_city'), ''),
      nullif(btrim(v_site ->> 'contact_person'), ''),
      nullif(btrim(v_site ->> 'contact_number'), ''),
      nullif(btrim(v_site ->> 'visit_purpose'), ''),
      nullif(btrim(v_site ->> 'expected_duration'), ''),
      nullif(btrim(v_site ->> 'additional_notes'), ''))
    on conflict (travel_request_id) do update set
      client_company_name = excluded.client_company_name, site_address = excluded.site_address,
      site_city = excluded.site_city, contact_person = excluded.contact_person,
      contact_number = excluded.contact_number, visit_purpose = excluded.visit_purpose,
      expected_duration = excluded.expected_duration, additional_notes = excluded.additional_notes;
  else
    delete from public.site_visit_details where travel_request_id = v_req.id;
  end if;

  if not p_submit then
    return jsonb_build_object('id', v_req.id, 'request_number', null, 'status', 'draft');
  end if;

  -- ---------------- Submission rules ----------------
  if v_req.mobile_number is null or v_req.destination_city is null or v_req.travel_purpose is null
     or v_req.departure_date is null or v_req.return_date is null then
    raise exception 'Mobile number, destination city, purpose and travel dates are required'
      using errcode = '23502';
  end if;
  if v_req.departure_date < v_today then
    raise exception 'Departure date cannot be in the past' using errcode = '22007';
  end if;
  if v_req.return_date < v_req.departure_date then
    raise exception 'Return date must be on or after the departure date' using errcode = '22007';
  end if;
  if v_req.return_date = v_req.departure_date and v_req.departure_time is not null
     and v_req.return_time is not null and v_req.return_time <= v_req.departure_time then
    raise exception 'Return time must be after departure time on a same-day trip' using errcode = '22007';
  end if;
  if v_req.return_date > v_req.departure_date + 365 then
    raise exception 'Trips longer than one year are not allowed' using errcode = '22007';
  end if;
  if v_type = 'site_visit' and (nullif(btrim(v_site ->> 'client_company_name'), '') is null
                                or nullif(btrim(v_site ->> 'site_city'), '') is null) then
    raise exception 'Client/company name and site city are required for site visits'
      using errcode = '23502';
  end if;

  -- Rate limit: 10 submissions per hour per employee
  select count(*) into v_recent from public.travel_requests
   where employee_id = v_me.id and submitted_at > now() - interval '1 hour';
  if v_recent >= 10 then
    raise exception 'Too many submissions. Please wait before submitting again.'
      using errcode = '54000';
  end if;

  -- Duplicate trip check
  if exists (
    select 1 from public.travel_requests r
     where r.employee_id = v_me.id and r.id <> v_req.id
       and r.status in ('pending', 'approved')
       and lower(r.destination_city) = lower(v_req.destination_city)
       and r.departure_date = v_req.departure_date) then
    raise exception 'You already have a pending or approved request to % departing on %',
      v_req.destination_city, to_char(v_req.departure_date, 'DD Mon YYYY')
      using errcode = '23505';
  end if;

  select * into v_admin from public.profiles
   where id = v_me.assigned_admin_id and role = 'admin' and is_active;
  if not found then
    raise exception 'You do not have an active reporting admin. Please contact the Super Admin.'
      using errcode = '23514';
  end if;

  v_number := public.next_request_number();

  update public.travel_requests set
    status = 'pending',
    request_number = v_number,
    assigned_admin_id = v_admin.id,
    assigned_admin_name = v_admin.full_name,
    submitted_at = now()
  where id = v_req.id
  returning * into v_req;

  perform public.notify(v_admin.id, v_req.id, 'new_request', 'New travel request',
    v_me.full_name || ' submitted ' || v_number || ' — ' || v_req.destination_city ||
    ' on ' || to_char(v_req.departure_date, 'DD Mon YYYY') || '.');
  perform public.notify(v_me.id, v_req.id, 'request_submitted', 'Request submitted',
    v_number || ' was sent to ' || v_admin.full_name || ' for approval.');

  return jsonb_build_object('id', v_req.id, 'request_number', v_number, 'status', 'pending',
                            'duplicate', false);
end;
$$;

-- ---------------------------------------------------------------------
-- RPC: approve / reject (atomic, row-locked, single decision)
-- ---------------------------------------------------------------------
create or replace function public.decide_travel_request(
  p_request_id uuid,
  p_decision   text,
  p_comments   text default null)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_me       public.profiles;
  v_req      public.travel_requests;
  v_new      public.request_status;
  v_comments text := nullif(btrim(p_comments), '');
begin
  select * into v_me from public.profiles where auth_user_id = auth.uid() and is_active;
  if not found or v_me.role not in ('admin', 'super_admin') then
    raise exception 'Only admins can approve or reject requests' using errcode = '42501';
  end if;
  if p_decision not in ('approve', 'reject') then
    raise exception 'Decision must be approve or reject' using errcode = '22023';
  end if;
  if p_decision = 'reject' and v_comments is null then
    raise exception 'A rejection reason is required' using errcode = '23502';
  end if;
  if v_comments is not null and char_length(v_comments) > 2000 then
    raise exception 'Comments must be 2000 characters or fewer' using errcode = '22001';
  end if;

  -- Lock the row: concurrent decisions queue here and the loser sees a non-pending status.
  select * into v_req from public.travel_requests where id = p_request_id for update;
  if not found then
    raise exception 'Request not found' using errcode = 'P0002';
  end if;
  if v_req.employee_id = v_me.id then
    raise exception 'You cannot decide on your own request' using errcode = '42501';
  end if;
  if v_me.role = 'admin' and v_req.assigned_admin_id is distinct from v_me.id then
    raise exception 'This request is not assigned to you' using errcode = '42501';
  end if;
  if v_req.status <> 'pending' then
    raise exception 'This request has already been % and cannot be changed',
      v_req.status using errcode = '40001';
  end if;

  v_new := case p_decision when 'approve' then 'approved'::public.request_status
                           else 'rejected'::public.request_status end;

  update public.travel_requests set
    status = v_new,
    reviewed_at = now(),
    reviewed_by = v_me.id,
    reviewed_by_name = v_me.full_name,
    review_comments = v_comments
  where id = v_req.id;

  insert into public.approval_history (travel_request_id, admin_id, admin_name,
    previous_status, new_status, action, comments)
  values (v_req.id, v_me.id, v_me.full_name, 'pending', v_new,
    case v_new when 'approved' then 'approved'::public.approval_action
               else 'rejected'::public.approval_action end,
    v_comments);

  if v_new = 'approved' then
    perform public.notify(v_req.employee_id, v_req.id, 'request_approved', 'Request approved',
      v_req.request_number || ' to ' || v_req.destination_city || ' was approved by ' ||
      v_me.full_name || '.');
    if v_comments is not null then
      perform public.notify(v_req.employee_id, v_req.id, 'admin_comment', 'Comment from ' || v_me.full_name,
        left(v_comments, 300));
    end if;
  else
    perform public.notify(v_req.employee_id, v_req.id, 'request_rejected', 'Request rejected',
      v_req.request_number || ' was rejected by ' || v_me.full_name || '. Reason: ' ||
      left(v_comments, 250));
  end if;

  return jsonb_build_object('id', v_req.id, 'status', v_new, 'request_number', v_req.request_number);
end;
$$;

-- ---------------------------------------------------------------------
-- RPC: delete one of your own drafts
-- ---------------------------------------------------------------------
create or replace function public.delete_draft(p_request_id uuid)
returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  delete from public.travel_requests
   where id = p_request_id
     and employee_id = public.current_profile_id()
     and status = 'draft';
  if not found then
    raise exception 'Draft not found' using errcode = 'P0002';
  end if;
end;
$$;

-- ---------------------------------------------------------------------
-- RPC: pending approval reminders (schedule daily with pg_cron, or run
-- from Super Admin → Settings). Reminds once per 24h per request.
-- ---------------------------------------------------------------------
create or replace function public.send_pending_reminders()
returns integer
language plpgsql security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  if auth.uid() is not null and not public.is_super_admin() then
    raise exception 'Not authorised' using errcode = '42501';
  end if;

  insert into public.notifications (recipient_user_id, travel_request_id, notification_type, title, message)
  select r.assigned_admin_id, r.id, 'pending_reminder', 'Approval pending',
         r.request_number || ' from ' || r.employee_name || ' has been waiting since ' ||
         to_char(r.submitted_at at time zone 'Asia/Kolkata', 'DD Mon, HH24:MI') || '.'
    from public.travel_requests r
   where r.status = 'pending'
     and r.submitted_at < now() - interval '24 hours'
     and not exists (
       select 1 from public.notifications n
        where n.travel_request_id = r.id and n.notification_type = 'pending_reminder'
          and n.created_at > now() - interval '24 hours');
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- ---------------------------------------------------------------------
-- Dashboard statistics. SECURITY INVOKER: every count is filtered by the
-- caller's row level security, so one function serves all three roles.
-- ---------------------------------------------------------------------
create or replace function public.get_dashboard_stats()
returns jsonb
language sql stable security invoker
set search_path = ''
as $$
with
  me as (select public.current_user_role() as role),
  t as (select public.today_ist() as d),
  r as (select * from public.travel_requests where status <> 'draft')
select jsonb_build_object(
  'total_employees', (select count(*) from public.profiles p, me
                       where p.role = 'employee' and me.role in ('admin', 'super_admin')),
  'active_employees', (select count(*) from public.profiles p, me
                       where p.role = 'employee' and p.is_active and me.role in ('admin', 'super_admin')),
  'total_admins', (select count(*) from public.profiles p, me
                    where p.role = 'admin' and me.role = 'super_admin'),
  'total_requests', (select count(*) from r),
  'pending', (select count(*) from r where status = 'pending'),
  'approved', (select count(*) from r where status = 'approved'),
  'rejected', (select count(*) from r where status = 'rejected'),
  'currently_travelling', (select count(*) from r, t
                            where status = 'approved' and departure_date <= t.d and return_date >= t.d),
  'upcoming', (select count(*) from r, t where status = 'approved' and departure_date > t.d),
  'monthly', (
    select coalesce(jsonb_agg(row_to_json(m) order by m.month), '[]'::jsonb) from (
      select to_char(gs, 'YYYY-MM') as month,
             count(r.id) as total,
             count(r.id) filter (where r.status = 'approved') as approved,
             count(r.id) filter (where r.status = 'rejected') as rejected,
             count(r.id) filter (where r.status = 'pending') as pending
        from t, generate_series(date_trunc('month', t.d) - interval '11 months',
                                date_trunc('month', t.d), interval '1 month') gs
        left join r on date_trunc('month', r.departure_date) = gs
       group by gs) m),
  'yearly', (
    select coalesce(jsonb_agg(row_to_json(y) order by y.year), '[]'::jsonb) from (
      select extract(year from departure_date)::int as year, count(*) as total,
             count(*) filter (where status = 'approved') as approved
        from r group by 1) y),
  'by_type', (
    select coalesce(jsonb_agg(row_to_json(x)), '[]'::jsonb) from (
      select travel_type as type, count(*) as total from r group by travel_type) x),
  'top_destinations', (
    select coalesce(jsonb_agg(row_to_json(x) order by x.total desc), '[]'::jsonb) from (
      select initcap(destination_city) as destination, count(*) as total
        from r group by initcap(destination_city) order by count(*) desc limit 8) x),
  'employee_frequency', (
    select coalesce(jsonb_agg(row_to_json(x) order by x.total desc), '[]'::jsonb) from (
      select employee_name as name, employee_code as code, count(*) as total,
             count(*) filter (where status = 'approved') as approved
        from r group by employee_name, employee_code order by count(*) desc limit 10) x),
  'admin_performance', (
    select coalesce(jsonb_agg(row_to_json(x) order by x.decided desc), '[]'::jsonb) from (
      select coalesce(r.assigned_admin_name, 'Unassigned') as name,
             count(*) as received,
             count(*) filter (where r.status in ('approved', 'rejected')) as decided,
             count(*) filter (where r.status = 'approved') as approved,
             count(*) filter (where r.status = 'rejected') as rejected,
             count(*) filter (where r.status = 'pending') as pending,
             round(avg(extract(epoch from (r.reviewed_at - r.submitted_at)) / 3600.0)
                   filter (where r.reviewed_at is not null)::numeric, 1) as avg_hours
        from r group by coalesce(r.assigned_admin_name, 'Unassigned')) x)
);
$$;

-- ---------------------------------------------------------------------
-- Function privileges
-- ---------------------------------------------------------------------
revoke execute on function public.next_request_number() from public, anon, authenticated;
revoke execute on function public.notify(uuid, uuid, text, text, text) from public, anon, authenticated;
revoke execute on function public.notify_super_admins(text, text, text, uuid) from public, anon, authenticated;
revoke execute on function public.send_pending_reminders() from public, anon;
revoke execute on function public.save_travel_request(uuid, jsonb, boolean, uuid) from public, anon;
revoke execute on function public.decide_travel_request(uuid, text, text) from public, anon;
revoke execute on function public.delete_draft(uuid) from public, anon;
revoke execute on function public.get_dashboard_stats() from public, anon;

grant execute on function public.next_request_number() to service_role;
grant execute on function public.save_travel_request(uuid, jsonb, boolean, uuid) to authenticated;
grant execute on function public.decide_travel_request(uuid, text, text) to authenticated;
grant execute on function public.delete_draft(uuid) to authenticated;
grant execute on function public.get_dashboard_stats() to authenticated;
grant execute on function public.send_pending_reminders() to authenticated, service_role;

-- >>> 20261030000003_security.sql
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

-- >>> 20261030000004_admin_helpers.sql
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

-- >>> 20261030000005_demo_data.sql
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
