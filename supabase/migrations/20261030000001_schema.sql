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
