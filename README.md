# HPAD – Digital Travel Form | Flight & Site Visit Outside Ahmedabad

A web application for submitting, approving and tracking official travel outside Ahmedabad. It has three role-based portals — **Super Admin**, **Admin** and **Employee** — on one shared Supabase PostgreSQL database.

**Stack:** Next.js 15 (App Router, Server Actions) · React 19 · TypeScript · Tailwind CSS 4 · Supabase (PostgreSQL, Auth, Storage, Realtime) · Recharts · React Hook Form · Zod · ExcelJS · jsPDF · Vercel.

---

## Status

| Area | State |
|---|---|
| Database schema, constraints, indexes, RLS, storage, realtime | Done — 66 automated checks pass (`npm run db:test`) |
| Authentication, role redirects, password reset | Done |
| Super Admin / Admin / Employee portals (all pages in the spec) | Done |
| Travel form, drafts, uploads, approve/reject workflow, history | Done |
| Notifications (bell, page, realtime), analytics, Excel/PDF reports | Done |
| Production build, typecheck, lint | Pass |
| Official HPAD logo | Installed (white version) — sidebar, login, mobile header, PDF headers |
| **HPAD brand colours and font** | **Waiting for the existing HPAD design** — see [Branding](#branding) |
| **Connection to your Supabase project** | **Waiting for credentials** — see [Setup](#setup) |

> The database logic has been tested against a real PostgreSQL engine with Supabase's auth and storage behaviour stubbed. It has **not yet** run against your live Supabase project, so do the [end-to-end check](#end-to-end-check) after setup before calling it production-ready.

---

## Setup

### 1. Create the Supabase project

1. Create a project at [supabase.com](https://supabase.com) (region: Mumbai `ap-south-1` is closest).
2. **Apply the database** — either:
   - **SQL editor:** open `supabase/setup.sql`, paste it into *SQL Editor*, run once; or
   - **CLI:** `npx supabase link --project-ref <ref>` then `npx supabase db push` (applies `supabase/migrations/` in order).
3. **Authentication → Sign In / Providers → Email:** turn **off** “Allow new users to sign up”. Accounts are created only by the Super Admin.
4. **Authentication → URL Configuration:**
   - Site URL: your production URL (e.g. `https://travel.hpad.co.in`)
   - Redirect URLs: add `https://<your-domain>/auth/callback` and `http://localhost:3000/auth/callback`
5. **Authentication → Emails → SMTP:** set up your company SMTP so password-reset emails come from HPAD and aren't limited by Supabase's default sender.
6. Confirm **Storage** shows a private bucket `travel-documents` and **Database → Publications → supabase_realtime** includes `travel_requests`, `notifications`, `approval_history` (the migration does both).

### 2. Configure the app

```bash
cp .env.example .env.local     # then fill in the three Supabase values
npm install
npm run create-super-admin     # uses SUPER_ADMIN_* values from .env.local
npm run dev                    # http://localhost:3000
```

Sign in as the Super Admin, create the Admins, then the Employees (each employee must be assigned to an Admin).

### 3. Optional: demo data (use a separate development project)

```bash
SEED_DEMO=yes npm run demo:seed   # 1 super admin, 2 admins, 10 employees, ~40 requests
npm run demo:remove               # removes only demo rows, files and logins
```

Demo logins use `@demo.hpad.local` and the password in `DEMO_PASSWORD` (default `HpadDemo@2026`). Every demo row is flagged `is_demo`, so cleanup never touches real data.

### 4. Optional: daily approval reminders

In *Integrations → Cron*, schedule this daily (e.g. 09:00 IST = `30 3 * * *` UTC):

```sql
select public.send_pending_reminders();
```

The Super Admin can also send reminders from **Settings**.

---

## Deploy to Vercel

1. Push this folder to a GitHub repository and import it in Vercel.
2. Add environment variables (Production and Preview): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `NEXT_PUBLIC_SITE_URL`.
3. Deploy, then add the production `/auth/callback` URL in Supabase (step 1.4).
4. Run the end-to-end check below against the deployed URL.

---

## End-to-end check

Run after connecting a real project (works well with demo data):

1. Each role signs in and lands on its own dashboard; visiting another portal's URL redirects home.
2. Employee submits a flight request with a ticket → gets `TRV-YYYY-NNNN`, status Pending.
3. The assigned Admin sees it appear live with a notification; the other Admin cannot open it.
4. Admin rejects without a reason → blocked. Rejects with a reason → employee is notified live.
5. A second approval attempt on the same request is refused.
6. Super Admin sees it in All Requests, Travel History and Audit Logs; statistics update.
7. Reassign an employee → their pending requests move to the new Admin.
8. Deactivate a user → they can no longer sign in or read data.
9. Download Excel and PDF reports as Admin and Super Admin; Admin's contain only their employees.
10. Refresh the browser and repeat on a phone — data persists and layouts fit.

---

## How security works

Permissions are enforced **in the database**, not just the UI:

- **Row Level Security** on every table. Employees see only their own records; Admins see only employees assigned to them and those employees' submitted requests (never drafts); the Super Admin sees everything except other people's drafts. Deactivated accounts lose all access immediately.
- **No direct writes** to requests, history or audit tables from the browser. Submissions and decisions go through database functions (`save_travel_request`, `decide_travel_request`) that validate dates and required fields, generate the request number, lock the row so only one decision can ever happen, and record history and notifications in the same transaction.
- **Append-only history:** `approval_history` and `audit_logs` cannot be edited or deleted, even by the server key.
- **Snapshots:** each request stores the employee and admin names at the time, so history stays correct after people change roles or teams.
- **Files:** private bucket, PDF/JPG/PNG only, 10 MB max (enforced by Storage and the database). Files are opened via 5-minute signed URLs, and storage access follows request visibility.
- **Secrets:** the secret key is used only server-side to create, block and unblock logins. It is never sent to the browser.
- **Rate limits:** Supabase Auth throttles sign-in attempts; the database limits each employee to 10 submissions per hour and blocks duplicate trips (same destination and departure date).
- **Input:** Zod validation in the browser and server, parameterised queries, filter strings sanitised, React escaping for output.

---

## Branding

The existing HPAD website/app was not available, so colours and font are neutral placeholders until it is shared.

- **Logo** — the official white logo is at `public/brand/hpad-logo-white.png` (transparent padding trimmed, otherwise unchanged). It is shown as-is on the dark sidebar and PDF headers, and on a brand-colour tile on light pages. If a full-colour version exists, add it and set `logoSrc` in `src/lib/brand.ts` to use it on light pages instead.
- **Colours and font** — replace the values under “HPAD BRAND TOKENS” in `src/app/globals.css`. Every component, chart and PDF header reads from these tokens (also update `BRAND_RGB` in `src/lib/pdf.ts` and the header colour `FF1F3A5F` in `src/features/reports/report-builder.tsx`).


---

## Project structure

```
supabase/migrations/   SQL: schema, business functions, RLS/storage/realtime, helpers, demo isolation
supabase/setup.sql     All migrations in one file (npm run db:bundle)
scripts/               db-test, create-super-admin, demo seed/remove
src/app/               Routes: (public) login & reset, super-admin/, admin/, employee/, actions/
src/features/          Page-level views: dashboards, requests, travel form, analytics, reports, people
src/components/        UI kit, app shell (sidebar, bell, realtime), request widgets, charts
src/lib/               Supabase clients, auth guards, validation, types, branding, PDF helpers
```

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` / `build` / `start` | Next.js |
| `npm run typecheck` | TypeScript check |
| `npm run db:test` | Applies all migrations to an in-memory Postgres and runs 66 security and workflow checks |
| `npm run db:bundle` | Regenerates `supabase/setup.sql` |
| `npm run create-super-admin` | Creates the first Super Admin |
| `npm run demo:seed` / `demo:remove` | Adds or removes flagged demo data |

## Business rules (where they're enforced)

| Rule | Enforced by |
|---|---|
| Every employee reports to an Admin | DB check constraint + trigger |
| Unique request ID `TRV-YYYY-NNNN` | DB counter inside `save_travel_request` |
| New requests start Pending | `save_travel_request` |
| Only the assigned Admin (or Super Admin) decides; never on own request | `decide_travel_request` |
| Rejection needs a reason | Function + table constraint |
| Submitted requests can't be edited; decided requests are final | `guard_request_update` trigger |
| No past or reversed dates | Function + constraint + form |
| Duplicate submissions blocked | Client token (double-click safe) + same-trip check |
| Approved ≠ proof of travel | Shown on request pages; “on travel now” vs “upcoming” computed separately in IST |
