# LABOS upgrade — Phase 2

NOT built or run (sandbox had no network). Run:
  npm install && npx prisma migrate deploy && npx prisma generate && npm run build
Migration `20261125090000_branch_scoped_roles` is additive (adds nullable Role.branchId, FK, index).

## Implemented
* Branch-admin Roles: sidebar group (Add New Role / Role List), create/view/edit/delete, permissions, assign to staff.
  Backend rules (src/app/api/roles*, staff*): branch roles get branchId from the SESSION; branch admin can only
  PATCH/DELETE roles whose branchId = its own branch (never org-wide or other-branch roles); GET lists org-wide
  (read-only) + own-branch roles; permission keys pass through grantableKeys(); staff role assignment only accepts
  org-wide roles or roles of the staff member's branch. Org/Super admin behaviour unchanged. Role names stay unique per organization.
* Role detail page /roles/[id].
* Eye button -> dedicated page /view/<module>/<id> for: patients, doctors, tests, suppliers, inventory, expenses,
  purchases, orders (incl. invoice/report lists), samples, results, staff, roles. Queries are filtered by actor authority.
  Patient page: visits, totals billed/paid/outstanding/discounts, orders, payments. Doctor page: referred orders + revenue.
* New Order: registered-patient picker is one searchable dropdown with server-side search (name / MRN / phone); details shown after selecting.
* Inventory: sidebar (Add Inventory, Inventory List, Stock Alert, Stock Report); /inventory/alerts and /inventory/report;
  server-side filters: stock status (Low/Out/Normal), supplier (last supplier from purchases), date range, search by name/code.
* Toasts moved to top-right, compact, slide-in animation; success ~1.2 s, errors 6 s.

## NOT done (be aware)
* Reports system (patient/doctor/test/sales/purchase/inventory/staff/billing/order/expense/supplier/sample/result,
  P&L, combined, date presets, print/PDF) — not started; needs its own phase.
* Dedicated pages replacing create/edit/enter-result modals — not done (forms still open as modals).
* Eye pages for Organizations and Branches lists — not added (they already have detail pages; not rewired).
* Inventory has no category or supplier column in the schema, so a Category filter is NOT available (supplier filter uses purchase history).
  No stock-movement/adjustment history table exists, so movement reports need new data structures.
* No Organization/Branch compact redesign, no performance work/measurements, no automated or browser testing.
* Edit/Delete buttons on detail pages are not included (use the list actions).
