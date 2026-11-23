# LabOS demo records

The demo-data command inserts real records into the selected PostgreSQL database. It does not add fake rows to the React UI and it does not create a new organization or branch.

## Before running

1. Back up the database first.
2. Copy `.env.example` to `.env` if you have not already done so, then set `DATABASE_URL` and `DATABASE_URL_UNPOOLED`.
3. Set `DEMO_ORGANIZATION_ID` to the UUID of the organization you want to populate.
4. Optionally set `DEMO_BRANCH_ID` to an active branch in that organization. If omitted, the active Head Office is selected first, otherwise the oldest active branch.
5. Install dependencies and make sure Prisma Client is generated (`npx prisma generate`).

Run:

```bash
npm run db:seed:demo
```

The command is idempotent for its fixed demo identifiers: rerunning it reuses the demo patients, tests, orders, inventory, purchase, role, staff directory record, and notification instead of intentionally creating a new set each time. It will add demo records to the selected live organization, so use a development/test organization and database, not a production laboratory's real data.

## Records added

- Patients, referring doctor and organization-wide tests
- Supplier, inventory items, expenses and a purchase
- One completed order with verified results and payment, plus one active order with a pending sample/result workflow
- A sample staff directory entry, a custom demo role with permission metadata, and a notification

The current Staff Management module is a directory only. Staff accounts created by this script do not have login credentials; the current login/scope implementation supports Super Admin, Organization Admin and Branch Admin only. Role permission records are stored, but they are not yet enforced as staff login permissions across the APIs.

The script does not delete or overwrite existing records. Remove demo records manually only after reviewing their relationships.

## Full branch test data (`db:seed:branch`)
Fills ONE branch with data for every module (panel tests, walk-in patients, orders in every status, payments, expenses,
inventory, purchases, staff, notifications). Use a test organization, not a real laboratory.

```bash
npx prisma migrate deploy && npx prisma generate
npm run db:seed:branch -- --branch=LHR              # branch code
npm run db:seed:branch -- --branch=LHR --org=ALPHA  # when the code exists in several organizations
```
* Re-running is refused once demo data exists in that branch (add `--force` for another set).
* Adds: 25 starter tests + 1 branch-only panel, 3 doctors, 2 suppliers, 8 inventory items, 11 patients (3 walk-in),
  ~20 orders (registered, sample collected, in progress, completed, rejected sample, cancelled; unpaid/partial/paid),
  3 CBC reports for one patient (history columns), 6 expenses, 3 purchases, 3 staff, notifications.
* Demo records are marked `[DEMO]` in patient/order notes.
