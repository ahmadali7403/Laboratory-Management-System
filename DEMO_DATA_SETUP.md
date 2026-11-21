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
