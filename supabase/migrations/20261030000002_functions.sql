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
