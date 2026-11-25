# LabOS performance & audit report (honest status)

## What was and was NOT done
The sandbox this work ran in has **no network access**: dependencies could not be installed, so
`npm run build`, `npm run lint`, Prisma generation, migrations and benchmarks were **NOT run**.
Nothing below has been measured. No timings are claimed.

Only two small, low-risk code changes were made. A full redesign, new modules and the
industry comparison table were not delivered.

## Audit findings (from reading the code)
- Already good: server-side tenant scoping (`scope.js`: `scopeWhere`, `authorityWhere`,
  `resolveWriteTarget`), session re-validation cached for 30 s via `memo`, retry on DB blips,
  composite indexes on the main tables, dashboard stats queried in parallel, bcrypt cost 12.
- Likely causes of the ~10 s login/module delays (code analysis only, unverified):
  1. Neon cold start / compute auto-suspend plus a non-pooled or distant database host.
  2. `await connection()` in `(app)/layout.js` makes every app page dynamic, so each
     navigation waits on session + notification count queries.
  3. Login did two sequential DB lookups, then awaited a `lastLoginAt` write, and the login
     page navigated and then called `router.refresh()` (a second fetch of the dashboard).
  4. `bcryptjs` is pure JS; cost 12 is a real CPU cost (hundreds of ms on small servers).
- Not found: no middleware/proxy file doing extra work.

## Changes made
1. `src/app/api/auth/login/route.js`: super-admin and org/branch-user lookups now run in
   parallel; the `lastLoginAt` write no longer blocks the response (errors are logged).
   Password verification, role and status checks are unchanged.
2. `src/app/login/page.js`: removed the redundant `router.refresh()` after `router.replace()`.
   Untested: confirm sign-in still lands on the right dashboard.
3. `.env.example`: documents pooled-URL and same-region requirements.

4. `src/app/(app)/loading.js`: skeleton shown immediately on any module click (no such file existed).
5. `src/app/(app)/error.js` and `src/app/not-found.js`: friendly error/404 screens (none existed).
6. `.skeleton` shimmer styles added to `globals.css` (respects reduced-motion).
7. `StatCard` accepts optional `href`; Branch dashboard cards for Patients, Pending Samples,
   Pending Results and Reports are now clickable.
8. Branch dashboard: new "Lab Workflow" step strip (Register, Order, Collect, Enter, Verify,
   Print) with live waiting counts, so new staff see what to do next.
All of 4-8 are UNBUILT and UNTESTED (no network in sandbox): run `npm run build` first.

## Recommended next steps (not done)
- Run `npm ci && npx prisma generate && npm run build && npm run lint`.
- Measure login and module navigation with the browser Network tab against your Neon DB.
- Check Neon: pooled host, same region as hosting, auto-suspend disabled or a keep-warm ping.
- Consider cost 10-11 for bcrypt only if you accept the security trade-off (not changed).
- Consider `loading.js` boundaries per route so navigation shows content shell immediately.

## Setup
`cp .env.example .env`, fill the values, then `npm ci`, `npx prisma generate`,
`npx prisma migrate deploy`, `npm run dev` (or `npm run build && npm start`).

## SECURITY NOTE
The ZIP you uploaded contained a real `.env`. It is excluded from the delivered ZIP.
If it held production credentials, rotate them.
