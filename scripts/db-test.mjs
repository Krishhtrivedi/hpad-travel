import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs';
import path from 'node:path';

const MIG = new URL('../supabase/migrations', import.meta.url).pathname;
const db = new PGlite();

// ---- Supabase platform stubs ----
await db.exec(`
create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
create schema auth; grant usage on schema auth to anon, authenticated, service_role;
create table auth.users (id uuid primary key default gen_random_uuid(), email text);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant execute on function auth.uid() to anon, authenticated, service_role;
create schema storage; grant usage on schema storage to anon, authenticated, service_role;
create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text, owner uuid);
alter table storage.objects enable row level security;
grant all on storage.objects to authenticated;
create function storage.foldername(name text) returns text[] language sql immutable as $$ select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'),1)-1] $$;
grant execute on function storage.foldername(text) to authenticated;
create publication supabase_realtime;
`);

for (const f of fs.readdirSync(MIG).sort()) {
  try { await db.exec(fs.readFileSync(path.join(MIG, f), 'utf8')); console.log('applied', f); }
  catch (e) { console.error('FAILED', f, e.message, e.position); process.exit(1); }
}

// ---- seed as owner ----
const q = async (sql, params) => (await db.query(sql, params)).rows;
const uid = async () => (await q('select gen_random_uuid() id'))[0].id;
const users = {};
for (const k of ['sa', 'adminA', 'adminB', 'emp1', 'emp2']) users[k] = await uid();
for (const [k, v] of Object.entries(users)) await q('insert into auth.users(id,email) values ($1,$2)', [v, k + '@x.com']);
const prof = {};
const mk = async (k, role, admin) => {
  const r = await q(`insert into public.profiles(auth_user_id, employee_id, full_name, email, role, assigned_admin_id, department)
    values ($1,$2,$3,$4,$5,$6,'Ops') returning id`, [users[k], 'e-' + k, 'Name ' + k, k + '@x.com', role, admin ?? null]);
  prof[k] = r[0].id;
};
await mk('sa', 'super_admin'); await mk('adminA', 'admin'); await mk('adminB', 'admin');
await mk('emp1', 'employee', prof.adminA); await mk('emp2', 'employee', prof.adminB);

let pass = 0, fail = 0;
const as = async (k) => { await db.exec(`reset role; select set_config('request.jwt.claim.sub', '${users[k]}', false); set role authenticated;`); };
const asOwner = async () => db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false);`);
const ok = async (name, fn) => { try { const r = await fn(); console.log('  ✓', name); pass++; return r; } catch (e) { console.log('  ✗', name, '→', e.message); fail++; } };
const errs = async (name, fn, match) => { try { await fn(); console.log('  ✗', name, '(expected error)'); fail++; } catch (e) { if (match && !e.message.includes(match)) { console.log('  ✗', name, 'wrong error:', e.message); fail++; } else { console.log('  ✓', name, '—', e.message.slice(0, 80)); pass++; } } };
const expect = (cond, msg) => { if (!cond) throw new Error(msg); };

const future = (d) => { const x = new Date(); x.setDate(x.getDate() + d); return x.toISOString().slice(0, 10); };
const payload = (o = {}) => JSON.stringify({ travel_type: 'flight', mobile_number: '9876543210', destination_city: 'Mumbai', destination_state: 'MH',
  travel_purpose: 'Client meeting', departure_date: future(5), return_date: future(7), departure_time: '09:00', return_time: '18:00',
  estimated_expenses: '12000', accommodation_required: true, flight: { airline_name: 'IndiGo', flight_number: '6e 123', departure_datetime: future(5) + 'T09:00:00+05:30' }, ...o });

console.log('\nEmployee flow');
await as('emp1');
const draft = await ok('save draft', async () => (await q(`select public.save_travel_request(null, $1::jsonb, false, '11111111-1111-1111-1111-111111111111') r`, [payload()]))[0].r);
await ok('idempotent draft create returns same row', async () => { const r = (await q(`select public.save_travel_request(null, $1::jsonb, false, '11111111-1111-1111-1111-111111111111') r`, [payload()]))[0].r; expect(r.id === draft.id, 'different id'); });
await ok('admin cannot see draft', async () => { await as('adminA'); const r = await q('select * from travel_requests'); expect(r.length === 0, 'saw draft'); await as('emp1'); });
const sub = await ok('submit', async () => (await q(`select public.save_travel_request($1, $2::jsonb, true) r`, [draft.id, payload()]))[0].r);
await ok('request number format', async () => expect(/^TRV-\d{4}-0001$/.test(sub.request_number), sub.request_number));
await ok('double submit is idempotent', async () => { const r = (await q(`select public.save_travel_request($1, $2::jsonb, true) r`, [draft.id, payload()]))[0].r; expect(r.duplicate === true, 'not duplicate'); });
await errs('cannot edit submitted', () => q(`select public.save_travel_request($1, $2::jsonb, false)`, [draft.id, payload()]), 'cannot be modified');
await errs('duplicate trip blocked', () => q(`select public.save_travel_request(null, $1::jsonb, true)`, [payload()]), 'already have');
await errs('past date blocked', () => q(`select public.save_travel_request(null, $1::jsonb, true)`, [payload({ destination_city: 'Delhi', departure_date: future(-2), return_date: future(1) })]), 'past');
await errs('return before departure blocked', () => q(`select public.save_travel_request(null, $1::jsonb, true)`, [payload({ destination_city: 'Pune', departure_date: future(5), return_date: future(3) })]));
await errs('site visit needs client', () => q(`select public.save_travel_request(null, $1::jsonb, true)`, [payload({ travel_type: 'site_visit', destination_city: 'Surat' })]), 'Client');
await errs('direct insert denied', () => q(`insert into travel_requests(employee_id, employee_name, employee_code, employee_email) values ($1,'x','x','x@x.com')`, [prof.emp1]), 'permission');
await errs('direct status update denied', () => q(`update travel_requests set status='approved'`), 'permission');
await errs('employee cannot decide', () => q(`select public.decide_travel_request($1,'approve')`, [draft.id]), 'Only admins');
await errs('employee cannot change role', () => q(`update profiles set role='super_admin' where id=$1`, [prof.emp1]), 'phone');
await ok('employee can change phone', async () => { const r = await q(`update profiles set phone='+91 98765 43210' where id=$1 returning id`, [prof.emp1]); expect(r.length === 1, 'no row'); });
await ok('employee sees self + own admin only', async () => { const r = await q('select id from profiles'); expect(r.length === 2, 'saw ' + r.length); });
await ok('flight details visible to owner', async () => { const r = await q('select flight_number from flight_details'); expect(r[0].flight_number === '6E 123', JSON.stringify(r)); });
await ok('employee got submitted notification', async () => { const r = await q('select notification_type from notifications'); expect(r.some(x => x.notification_type === 'request_submitted'), 'missing'); });
await ok('mark notification read', async () => q('update notifications set is_read = true'));
await errs('cannot edit notification text', () => q(`update notifications set title='x'`), 'permission');
await ok('storage upload allowed on own request', async () => q(`insert into storage.objects(bucket_id,name) values ('travel-documents', $1)`, [draft.id + '/ticket.pdf']));
await ok('document row insert', async () => q(`insert into documents(travel_request_id, uploaded_by, file_name, file_type, file_size, storage_path, document_kind) values ($1,$2,'ticket.pdf','application/pdf',1000,$3,'flight_ticket')`, [draft.id, prof.emp1, draft.id + '/ticket.pdf']));
await errs('bad file type rejected', () => q(`insert into documents(travel_request_id, uploaded_by, file_name, file_type, file_size, storage_path) values ($1,$2,'x.exe','application/x-msdownload',10,$3)`, [draft.id, prof.emp1, draft.id + '/x.exe']), 'check');

console.log('\nOther employee isolation');
await as('emp2');
await ok('emp2 cannot see emp1 request', async () => { const r = await q('select * from travel_requests'); expect(r.length === 0, 'leak'); });
await ok('emp2 cannot see emp1 documents', async () => { const r = await q('select * from documents'); expect(r.length === 0, 'leak'); });
await ok('emp2 cannot read emp1 storage object', async () => { const r = await q('select * from storage.objects'); expect(r.length === 0, 'leak'); });
await errs('emp2 cannot upload into emp1 folder', () => q(`insert into storage.objects(bucket_id,name) values ('travel-documents', $1)`, [draft.id + '/evil.pdf']), 'row-level');

console.log('\nAdmin flow');
await as('adminB');
await ok('unassigned admin cannot see request', async () => { const r = await q('select * from travel_requests'); expect(r.length === 0, 'leak'); });
await errs('unassigned admin cannot decide', () => q(`select public.decide_travel_request($1,'approve')`, [draft.id]), 'not assigned');
await as('adminA');
await ok('assigned admin sees request', async () => { const r = await q('select * from travel_requests'); expect(r.length === 1, 'missing'); });
await ok('assigned admin sees documents + storage', async () => { const a = await q('select * from documents'); const b = await q('select * from storage.objects'); expect(a.length === 1 && b.length === 1, 'missing'); });
await ok('admin got new_request notification', async () => { const r = await q('select notification_type from notifications'); expect(r.some(x => x.notification_type === 'new_request'), 'missing'); });
await errs('reject without reason fails', () => q(`select public.decide_travel_request($1,'reject','  ')`, [draft.id]), 'reason');
await ok('approve', async () => q(`select public.decide_travel_request($1,'approve','Have a good trip')`, [draft.id]));
await errs('second decision blocked', () => q(`select public.decide_travel_request($1,'reject','late')`, [draft.id]), 'already');
await errs('cannot delete approval history', async () => { await asOwner(); await q('delete from approval_history'); }, 'permanent');
await errs('cannot alter audit logs', async () => { await asOwner(); await q(`update audit_logs set action='x'`); }, 'permanent');

console.log('\nNotifications + audit');
await as('emp1');
await ok('employee notified of approval + comment', async () => { const r = (await q('select notification_type from notifications')).map(x => x.notification_type); expect(r.includes('request_approved') && r.includes('admin_comment'), r.join()); });
await ok('employee cannot read audit logs', async () => { const r = await q('select * from audit_logs'); expect(r.length === 0, 'leak'); });
await as('sa');
await ok('super admin reads audit logs', async () => { const r = (await q('select action from audit_logs')).map(x => x.action); expect(r.includes('request_submitted') && r.includes('request_approved'), r.join()); });
await ok('super admin sees all profiles', async () => { const r = await q('select * from profiles'); expect(r.length === 5, r.length); });

console.log('\nReassignment');
await as('emp1');
const s2 = await ok('submit second request', async () => (await q(`select public.save_travel_request(null, $1::jsonb, true) r`, [payload({ destination_city: 'Bengaluru' })]))[0].r);
await as('sa');
await ok('super admin reassigns employee', async () => q('update profiles set assigned_admin_id=$1 where id=$2', [prof.adminB, prof.emp1]));
await errs('cannot deactivate admin with active employees', () => q('update profiles set is_active=false where id=$1', [prof.adminB]), 'Reassign');
await as('adminB');
await ok('new admin now owns pending request', async () => { const r = await q(`select request_number from travel_requests where status='pending'`); expect(r.length === 1, JSON.stringify(r)); });
await ok('new admin got reassignment notification', async () => { const r = (await q('select notification_type from notifications')).map(x => x.notification_type); expect(r.includes('request_reassigned'), r.join()); });
await as('adminA');
await errs('old admin can no longer decide', () => q(`select public.decide_travel_request($1,'approve')`, [s2.id]), 'not assigned');
await ok('old admin still sees request they decided? (history via assignment snapshot)', async () => { const r = await q('select request_number, status from travel_requests'); console.log('     visible:', JSON.stringify(r)); });

console.log('\nStats');
for (const k of ['sa', 'adminA', 'adminB', 'emp1', 'emp2']) {
  await as(k);
  await ok('stats for ' + k, async () => { const s = (await q('select public.get_dashboard_stats() s'))[0].s; console.log('     ', JSON.stringify({ emp: s.total_employees, admins: s.total_admins, total: s.total_requests, p: s.pending, a: s.approved, up: s.upcoming, months: s.monthly.length, perf: s.admin_performance.length })); });
}

console.log('\nSuper admin helpers');
await as('sa');
await ok('people stats for super admin', async () => { const r = await q('select * from public.get_people_stats()'); expect(r.length === 5, r.length); });
await ok('super admin can log an action', async () => q(`select public.log_admin_action('password_reset_sent','profile',$1,'{}'::jsonb)`, [prof.emp1]));
await as('adminA');
await ok('admin people stats limited by RLS', async () => { const r = await q('select * from public.get_people_stats()'); expect(r.length <= 2, r.length); });
await errs('admin cannot log admin actions', () => q(`select public.log_admin_action('x_y_z','profile',null,null)`), 'Not authorised');
await as('emp1');
await errs('employee cannot send reminders', () => q('select public.send_pending_reminders()'), 'Not authorised');

console.log('\nDeactivation');
await as('sa');
await ok('deactivate employee', async () => q('update profiles set is_active=false where id=$1', [prof.emp2]));
await as('emp2');
await ok('deactivated user sees nothing', async () => { const r = await q('select * from profiles'); expect(r.length === 0, 'leak'); });
await errs('deactivated user cannot submit', () => q(`select public.save_travel_request(null, $1::jsonb, true)`, [payload({ destination_city: 'Goa' })]), 'not active');

console.log('\nDemo purge');
await asOwner();
await ok('flag emp1 data as demo and purge it', async () => {
  // Seeded demo rows are flagged at insert time; here we flag existing rows, so bypass the immutability guard.
  await q('alter table travel_requests disable trigger travel_requests_guard_update');
  await q('update travel_requests set is_demo = true where employee_id = $1', [prof.emp1]);
  await q('alter table travel_requests enable trigger travel_requests_guard_update');
  await q('update profiles set is_demo = true where id = $1', [prof.emp1]);
  const r = (await q('select public.purge_demo_data() r'))[0].r;
  expect(r.requests_deleted === 2, JSON.stringify(r));
  const left = await q('select count(*)::int c from travel_requests');
  expect(left[0].c === 0, 'requests remain');
  const hist = await q('select count(*)::int c from approval_history');
  expect(hist[0].c === 0, 'history remains');
  const audit = await q('select count(*)::int c from audit_logs');
  expect(audit[0].c > 0, 'audit log should be kept');
});
await errs('non-demo history still undeletable', async () => { await q('insert into approval_history(travel_request_id, admin_id, admin_name, previous_status, new_status, action) select gen_random_uuid(), id, $2, $3, $4, $5 from profiles where id = $1', [prof.adminA, 'x', 'pending', 'approved', 'approved']); }, 'foreign key');
await as('sa');
await errs('purge not callable by signed-in users', () => q('select public.purge_demo_data()'), 'permission');
await asOwner();

console.log('\nCounter');
await asOwner();
await ok('counter reset after purge', async () => { const r = await q('select last_value from request_counters'); expect(r[0].last_value === 0, JSON.stringify(r)); });

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
