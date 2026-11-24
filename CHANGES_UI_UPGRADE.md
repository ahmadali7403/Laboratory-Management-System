# LabOS UI/UX upgrade – what changed

- Sidebar: 208px wide, collapse to icon rail (tooltips), fully hide/reopen, grouped Catalog/Stock, short labels, rare modules at bottom. State remembered per browser.
- Single profile menu in the header (name, role, org, branch, settings, logout). User no longer repeated in sidebar.
- Floating (+) quick-add: actions built server-side from the user's own navigation (Add patient, Walk-in patient, New test entry, Add expense, ...). Opens the right form via `?new=1` / `?new=walkin`.
- `Select` component (ui.jsx): every dropdown is now searchable, keyboard navigable, with "No results found". Drop-in for `<select>`.
- Forms: 4-column desktop grid (2 tablet, 1 mobile), per-field `span`, input masks for name / phone / CNIC.
- Tables: compact rows, serial number column (# follows page/page-size, latest first).
- Pagination: "Show [10] entries", `1 2 3 … 11 12` with Prev/Next, search/filter preserved.
- Validation (client + server, `src/lib/validators.js`): names (letters, spaces, hyphen, apostrophe), phone (03XXXXXXXXX or +international), CNIC (13 digits, stored 12345-1234567-1, duplicate CNIC rejected per organization). Applied to patients, walk-ins, doctors, suppliers, staff.
- Walk-ins: reuse an existing patient (same branch + phone + name) instead of creating a duplicate; they remain in the Patients module.
- Expenses: payment method, date range + method filter, no future dates, amount > 0, total of the filtered result, search includes "added by".
  **Requires migration:** `npx prisma migrate deploy` (adds `Expense.paymentMethod`, default CASH – backward compatible).
- Toasts: sign-in message after login, sign-out message.

Not verified by running (no network / node_modules in the build sandbox): run `npm install && npx prisma migrate deploy && npm run build && npm run lint` before deploying.
