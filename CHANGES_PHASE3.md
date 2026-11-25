# LABOS — Phase 3

Run after copying the files:

    npm install
    npx prisma migrate deploy      # applies 20261125090000_branch_scoped_roles (if not yet) + 20261126090000_role_name_unique_per_branch
    npx prisma generate
    npm run build && npm start

## 1. Auto sign-out fixed
Root cause: `getUserSession()/getAdminSession()` returned `null` for ANY error (e.g. a Neon cold-start/network
blip) and that `null` was cached for 30 s -> the next request looked "signed out" and the browser was sent to /login.
* Token problems (bad/expired JWT) still mean "signed out"; database errors are now retried (3x) and, if they persist,
  thrown (never cached, never treated as a logout).
* Session lifetime 8 h -> 7 days and it renews itself: `SessionKeepAlive` calls `/api/auth/refresh` every 20 min and when
  the tab becomes visible again. Only a real 401 redirects to /login.
* If you run over plain http (LAN / no HTTPS) set `COOKIE_SECURE=false` in `.env`.

## 2. Roles at three levels
* Branch admin  -> creates roles only for ITS branch (branch comes from the session).
* Organization admin -> roles for all branches of its organization, or for one chosen branch.
* Super admin -> chooses Organization (or "All organizations") and optionally one branch. With no organization selected the
  Role List shows the roles of every organization.
* Role names are now unique per scope (two branches can both have "Receptionist"). Migration
  `20261126090000_role_name_unique_per_branch`. Org-wide names are checked in `src/lib/roles.js`.
* Organization/branch creation routes use `ensureSystemRole()` instead of `upsert(organizationId_name)`.
* Staff role dropdown now shows "Role · Branch / all branches".
* Still true: staff records cannot log in, so permissions are stored/assigned but not yet enforced on screens.

## 3. Reports & Analytics (/analytics)
Hub with 13 modules: Patients, Doctors, Tests, Orders, Samples, Results, Billing & Payments, Expenses, Suppliers,
Purchases, Inventory, Staff & Roles, Profit & Loss. Each has
* **Combined report** (summary cards + grouped tables + detail list), and
* **Individual report** (search and pick one patient / doctor / test / order / sample / invoice / expense category /
  supplier / purchase / item / staff member / branch).
Date presets (today ... this year, custom), CSV export, Print / Save as PDF. All queries are filtered by the verified scope
(branch admin = own branch, org admin = own organization, super admin = selection or everything).
Files: `src/lib/report-engine.js`, `src/app/api/reports/[module]/route.js`, `src/components/modules/report-viewer.jsx`,
`src/app/(app)/analytics/page.js` and `[module]/page.js`.

## Not verified here
The sandbox had no access to Prisma binaries or a database, so the code was compile-checked (Turbopack "Compiled
successfully") and linted, but not run against PostgreSQL. Please click through Roles (3 logins), Reports and a long
session after deploying.

## Update 3b
* Analytics overview redesigned (KPI cards + revenue area chart, top tests, status/expense donuts, branch comparison).
* Top-bar bell opens a dropdown under the button (mark read, open, view all); closes on outside click/Esc.
* Roles list error: `/api/roles?options=1` failed for Super Admin without a selected organization (fixed). API errors now say
  "run `npx prisma migrate deploy`" or "run `npx prisma generate`" when the real cause is an out-of-date database/client.
