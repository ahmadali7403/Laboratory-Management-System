# LabOS — Multi-tenant Laboratory Management (implementation notes)

## Deploy steps
```bash
npm install
cp .env.example .env            # fill real values (never commit .env)
npx prisma migrate deploy       # applies 20261118090000_add_laboratory_modules (additive only)
npx prisma generate
npm run build && npm start
```
The migration only CREATEs new enums/tables/indexes/foreign keys. It does not alter or drop any
existing table, so existing organizations, branches, users and roles are preserved.

## Security model (src/lib/scope.js)
* `getActor()` – role comes from the DB-validated session (status, org, branch re-checked each request).
* `resolveScope()` – the Org/Branch selector is stored in an httpOnly cookie as a *request only*; it is
  re-verified against the DB on every call. A branch of another org is silently dropped (cookie) or 404 (explicit).
* `scopeWhere()` – list/dashboard filter. `authorityWhere()` – access-by-id filter (IDOR guard), independent of the selector.
* `resolveWriteTarget()` – organizationId/branchId of new rows are derived server-side; body `branchId` is only verified.
* DB layer: composite FKs `(id, organizationId)` make cross-tenant links impossible (tested in PGlite).
* Order prices, totals, balances are computed on the server; payments use a row lock (`FOR UPDATE`).

## Roles → views
| Role | Dashboard | Data scope |
|---|---|---|
| SUPER_ADMIN | /dashboard | all; org + branch selector |
| ORGANIZATION_ADMIN | /organization/dashboard | own org; All branches / branch selector |
| BRANCH_ADMIN | /branch/dashboard | assigned branch only (selector locked) |

## Fixes to existing code
* Org / branch creation now store the AES-256-GCM encrypted password (credential viewing worked only after a reset before).
  Creation no longer fails if `CREDENTIALS_ENCRYPTION_KEY` is missing.
* UUID validation on organization/account routes (malformed ids returned 500).
* Organization pages redirect non-super users to their own dashboard instead of /login.
* Existing /organizations/** pages moved into the `(app)` route group (URLs unchanged) to share the new shell.

## Known limitations (be aware)
* Staff records are a directory — they cannot log in. Only the three admin roles sign in, so
  Roles & Permissions are stored/assigned but not yet enforced anywhere (no staff login exists).
* Orders with payments cannot be cancelled and there is no refund flow.
* No login rate limiting (recommended before production).
* Day boundaries ("today") use Asia/Karachi (UTC+5).

## UI and demo-data update (2026-11-20)
* Responsive module lists now use stacked record cards on phone/tablet widths and a wrapping table only on wide screens.
* Organization and all-branches lists use the same responsive pattern; the order-detail item list and branch comparison are also mobile-safe.
* Global layout clips horizontal page overflow and constrains form controls/media to the available width.
* Optional demo records are inserted into an existing organization/branch by `npm run db:seed:demo`. Configure `DEMO_ORGANIZATION_ID` (and optionally `DEMO_BRANCH_ID`) in `.env` first. See `DEMO_DATA_SETUP.md`; use a development/test database and back it up first.

## Update: multi-parameter tests + PDF-style report
* **Migration `20261121090000_add_test_parameters`** (additive): `TestParameter`, `LabResult`, and two nullable
  columns on `Organization` (`reportConsultants`, `reportFooterNote`). Run `npx prisma migrate deploy` then `npx prisma generate`.
* **Test Catalog:** a test can have many parameters (name, unit, low/high or text range). Tests with no parameters still work as single-value tests.
* **Starter panels:** CBC, LFT, RFT, Serum Electrolytes. New organizations get them automatically; for existing
  organizations click **Add common tests** in Test Catalog (safe to click repeatedly). Prices are placeholders — edit them.
* **Orders** snapshot every parameter, so editing the catalog later never changes old reports.
* **Results:** panel tests show one table with all parameters; numeric values are flagged High/Low automatically.
* **Report** (`/reports/[id]`): header, patient/lab blocks, one section per test, ↓/↑ in blue bold for abnormal values,
  two previous results of the same patient as extra columns, repeating header/footer on every printed page,
  consultants + footer note from **Organization Settings**.
* Not included: logo image, barcodes and QR code.

## Update 3: walk-in, 25 starter tests, backup/restore, export/print
* **Migration `20261122090000_walkin_and_report_fields`** (additive): `Patient.fatherName`, `Patient.isWalkIn`, `LabOrder.referredBy`.
  Run `npx prisma migrate deploy` and `npx prisma generate`.
* **Walk-in patients:** New order dialog has a "Walk-in patient" tab (name, age, gender, phone); the patient is created automatically.
* **25 starter tests (93 parameters):** added to every new organization automatically. Existing organizations: use
  **Add common tests** in Test Catalog, or run `npm run db:seed:tests` (all organizations, idempotent).
* **Test ownership:** Branch admin tests are branch-only. Organization/Super admin tests are organization-wide by default.
* **Every list page:** Data menu -> Export to Excel (CSV), Print list, Download backup, Restore from backup.
* **Backup & Restore page** (all roles): complete backup, per-section backup, restore (merge / overwrite). Super admin can also
  back up all organizations at once. Restore re-validates every row against the actor's authority; ids that belong to another
  organization abort the whole (transactional) restore. Backups contain no passwords.
* Qualitative parameters (e.g. expected "Negative") are flagged ABNORMAL automatically when a different value is entered.
* Test status: 181 integration checks (login, redirects, tenant/IDOR attacks, walk-in order, results, payments, suspension,
  backup/restore attacks, server-rendered pages) were run against a real PostgreSQL engine (PGlite) with the real route handlers.
  Browser click-through on a live Neon database has not been done.
