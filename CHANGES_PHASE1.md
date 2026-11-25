# LABOS upgrade — Phase 1 (what is actually in this ZIP)

NOT built or run: the sandbox had no network, so `npm install`/`next build` could not be executed.
Run `npm install && npx prisma generate && npm run build` locally and report any error.

## Done
* Sidebar: grouped dropdowns (Patients, Orders, Samples, Results, Billing, Expenses, Tests, Doctors,
  Inventory, Suppliers, Staff), one open at a time, animated, active-page highlight, menu search box.
* Dedicated pages: /samples/{collect,receive,reject,list}, /results/{enter,edit,verify,reopen,list},
  /billing/pay (unpaid + partial bills; API `paymentStatus=OPEN`). Each shows only its own rows/actions.
* Add-X menu items open the existing create form (`?new=1`) on the list page.
* Success toasts now ~1.2 s (errors 6 s).
* Backup of the original: BACKUP_original_lmsupdated.zip (separate file).

## NOT done yet (needs further phases)
Searchable patient/order picker on workflow pages; Analytics & Reports pages (patient/doctor/purchase/
supplier/expense/billing/P&L, date filters, print/PDF); expense categories module; Branch Admin role
management and role enforcement in APIs; compact redesign of Organizations/Branches pages;
eye/detail pages for every list; sort + page-size review; dashboard chart rework; performance pass;
Edit Test / Edit Doctor entries (editing is available from each list row).
No schema changes were made.
