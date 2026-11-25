# Modal standardisation, delete fixes, session and cache changes

## Modals
- `Modal` width scale is now compact: `sm` (Bill Payment reference, 28rem), `md` 32rem, `lg` 42rem, `xl` 48rem, `doc` 56rem. Max height 90vh with internal scrolling.
- All Add/Edit forms (patients, doctors, tests, suppliers, inventory, expenses, staff, roles) use `md` (2 columns); long forms (tests with parameters) use `lg` (3 columns).
- New order, Enter/Edit result and New purchase reduced to `lg`/`md`.
- View now opens a modal everywhere (`src/components/record-view.jsx`, data from `GET /api/view/[module]/[id]`, same definitions and same authority filter as the old `/view/...` page, which still exists as a fallback).
- Invoice and Lab report open in a modal (iframe of `/embed/invoice/[id]` and `/embed/reports/[id]`, the existing printable pages without the app shell). Print works from inside the modal.
- Role view opens a modal (`RoleViewModal`).

## Delete
- `crud.js` DELETE checks linked records first (`dependents` per module). Records with history are deactivated (doctors, tests, suppliers, inventory) or refused with a clear message (patients with orders); unused records are deleted. Prisma P2003 and P2014 are both handled. The UI shows the server message and refreshes immediately.

## Session
- A missing/short AUTH_SECRET is now a server error instead of being treated as an invalid token (which signed everyone out).
- The client no longer logs out on the first 401: it asks /api/auth/refresh once (shared by concurrent requests), retries, and only signs out if the session is really invalid. Network errors never sign out.

## Cache
- Test catalog list has a 20 s per-scope cache (key includes role, user, organization, branch and query). Every create/update/delete, "Add common tests" and backup restore clear it.

## Not changed
- Organizations and Branches (Super Admin) keep their full-page forms and detail pages.
- No schema or migration changes.
