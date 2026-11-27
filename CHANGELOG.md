# Changelog

All notable changes to this project are documented in this file.

## [Task 1] Performance Audit & Optimization
- **Next.js & Bundle Configuration (`next.config.mjs`)**: Enabled `compress: true`, disabled `poweredByHeader`, and added `experimental.optimizePackageImports` for `lucide-react` and `recharts`.
- **Database Indexes (`prisma/schema.prisma`, migration `20261128120000_performance_indexes`)**: Added composite B-tree indexes for fast lookups and reporting across `Patient` (org + name/phone), `LabOrder` (org + createdAt), `Payment` (org + createdAt), `Medicine` (org + branch + genericName/sku/updatedAt), `MedicineBatch` (org + branch + batchNumber), and `PharmacySale` (org + branch + soldByName, org + createdAt).
- **Backend Aggregation & Caching (`src/lib/stats.js`, `src/lib/pharmacy-stats.js`, `src/lib/memo.js`)**:
  - Replaced raw row fetches in `getDashboardCharts`, `getPlatformDashboardCharts`, and `getAnalytics` with timezone-aware PostgreSQL `to_char` / `AT TIME ZONE 'Asia/Karachi'` aggregations so only grouped date buckets cross the wire.
  - Added short-TTL `memo()` caching on `getLabStats`, `getPlatformStats`, `getDashboardCharts`, `getPlatformDashboardCharts`, `getAnalytics`, and `getPharmacyDashboard`, plus `invalidateStatsCache()` calls on order, sale, and medicine writes.
  - Enabled 30s server caching (`cacheTtlMs`) on Pharmacy Categories, Companies, and Suppliers CRUD endpoints.
  - Narrowed `recentSales` and `recentPurchases` column selection on the pharmacy dashboard.
- **Frontend Lazy Loading & Memoization (`src/components/dashboard-charts-lazy.jsx`, `src/components/dashboard-sections.jsx`, `src/components/ui.jsx`)**:
  - Split `recharts` dashboard charts behind `next/dynamic` (`ssr: false`) with skeleton fallbacks to reduce initial dashboard payload.
  - Memoized `Pagination` in `ui.jsx`.

## [Task 2] Pharmacy Inventory — 240+ Common Medicines Seed & Indexed Search
- **Common Medicines Catalog (`src/lib/medicine-defaults-data.mjs`, `src/lib/medicine-defaults.js`)**:
  - Added 240 commonly stocked Pakistani/South Asian pharmacy items across 12 categories: Painkillers & Fever, Antibiotics & Antimicrobials, Gastro & Digestive, Allergy/Cold/Cough, Diabetes & Endocrine, BP/Heart/Cholesterol, Vitamins & Supplements, Skin & Dermatology, Eye & Ear Drops, Injections & IV Fluids, First-Aid & Surgical, and Baby & Mother Care.
  - Includes brand names (Panadol, Brufen, Disprin, Ponstan, Voltral, Augmentin, Amoxil, Flagyl, Zithromax, Ciproxin, Septran, Risek, Nexum, Motilium, Gaviscon, Nimcol ORS, Avil, Zyrtec, Piriton, Ventolin, Benylin, Glucophage, Daonil, Januvia, Norvasc, Concor, Tenormin, Lipitor, Ecosprin, Cac-1000, SunnyD, Surbex-Z, Betnovate, Fucidin, Canesten, Tobradex, Rocephin, etc.), generic names, strength, dosage form, manufacturer, EAN-13 barcodes, SKUs, purchase/sale prices, low-stock reorder levels, batch numbers, staggered future expiries, and starter stock.
- **Idempotent CLI & Admin Seed (`scripts/seed-common-medicines.mjs`, `POST /api/pharmacy/medicines/seed-defaults`, `package.json` `db:seed:medicines`)**:
  - Uses deterministic UUID mapping and Prisma `upsert` across categories, companies, default wholesale supplier, medicines, and batches; re-runs never create duplicates or overwrite live stock balances.
- **Indexed Search & Fast Catalog Mode (`prisma/migrations/20261128130000_pharmacy_trigram_search`, `src/app/api/pharmacy/medicines/route.js`)**:
  - Enabled PostgreSQL `pg_trgm` GIN trigram indexes on `Medicine(name, genericName, barcode, sku)` and `MedicineBatch(batchNumber)` for rapid substring search.
  - Added `GET /api/pharmacy/medicines?catalog=1` with 15s cached compact payload for instant POS catalog preloading.

## [Task 3] Mouse-less (Keyboard-First) System Across POS, Lab, Modals, and Login
- **Global Keyboard Shortcuts & Navigation (`src/lib/shortcuts.js`, `src/components/keyboard-nav.jsx`, `src/components/shortcut-bar.jsx`, `src/components/app-shell.jsx`)**:
  - Added `F1` Shortcuts Guide modal (`ShortcutsHelpModal`), persistent `ShortcutBar` with `KeyBadge` indicators, global `F3` list search focus, and `Alt+1..9` role-gated quick navigation mapped strictly to routes permitted by the user's role.
- **Modals, Forms & Login (`src/components/ui.jsx`, `src/app/login/page.js`, `src/app/globals.css`)**:
  - Added `Tab` / `Shift+Tab` focus trapping inside `Modal`, clearer `:focus-visible` focus rings, and keyboard-first Login (`autoFocus` username, `Enter` advances to password or signs in).
- **Laboratory Workflows (`src/components/modules/lab-dialogs.jsx`, `src/components/data-module.jsx`, `src/components/modules/report-viewer.jsx`, `src/components/print-button.jsx`)**:
  - Added `Enter`-to-next-parameter result entry in `ResultDialog` (auto-submits on final result field or `Ctrl+Enter`), `ArrowDown`/`ArrowUp` + `Enter` row activation in `DataModule`, and `F9` / `Ctrl+P` report & invoice printing.
- **POS Shortcuts, Hold/Resume, Undo & Scanner Support (`src/lib/use-pos-keyboard.js`, `src/lib/pos-hold.js`, `src/components/held-bills-modal.jsx`, `PharmacyPOS.jsx`, `pos-order.jsx`)**:
  - Added `F1` Help, `F2` New Bill, `F3` Search, `F4` Customer/Patient, `F5` Hold/Resume Bill (prevents browser refresh), `F6` Discount, `F8` Cycle Payment Method, `F9` Save & Print, `F10` Save Only, `Ctrl+Delete` Remove Item, `Ctrl+Z` Undo Last Action, `Esc` Clear/Close, hardware barcode scanner burst detection, and add-item → quantity auto-focus → `Enter` back to search.

## [Task 4] Fastest POS Pages (Preload Cache, Virtualization, Optimistic Cart & Fast Print)
- **Local Memory + IndexedDB Catalog Cache (`src/lib/pos-cache.js`)**:
  - Preloads and persists branch medicines (`/api/pharmacy/medicines?catalog=1`) and lab test catalogs in memory + IndexedDB (`labos-pos-v1`), providing instant (`< 5ms`) prefix + multi-token fuzzy + exact barcode matching via `useDeferredValue` with quiet background network revalidation.
  - Added `optimisticDecrementMedicineCache` to update local batch stock immediately after sale completion.
- **Zero-Dependency Virtualized Lists (`src/components/virtual-rows.jsx`)**:
  - Replaced full-DOM result tables in `MedicineSearch.jsx` and `pos-order.jsx` with fixed-height virtualized row rendering (`VirtualRows`) and automatic `scrollToIndex` tracking.
- **Instant Client Receipt Printing & Slim POS Bundles (`src/lib/fast-print.js`, `PharmacyPOS.jsx`, `pos-order.jsx`)**:
  - Built client-side thermal/A5 receipt printing (`printPharmacyReceipt`, `printLabReceipt`) for `F9` Save & Print with zero extra invoice HTTP round-trips (retaining full A4 invoice print link on the confirmation banner).
  - Lazy-loaded `BatchSelector` and `HeldBillsModal` via `next/dynamic` (`ssr: false`).

## [Task 5] Zero-Scroll (`100dvh × 100vw`) 3-Zone Modern POS Design + Light/Dark Theme
- **Zero-Scroll POS Viewport (`src/components/app-main.jsx`, `src/components/app-shell.jsx`)**:
  - Updated `AppShell` to `h-[100dvh]` and added `AppMain` so `/pharmacy/pos` and `/orders/new` occupy a strict full-viewport flex column (`overflow-hidden`, `min-h-0`) with internal-only cart & catalog scrolling.
- **Shared Reusable POS Components (`src/components/pos/*`) & Scoped Theme Tokens (`src/app/globals.css`, `src/lib/use-pos-theme.js`)**:
  - Created `SearchBar`, `CartPanel`, `TotalsCard`, and `PaymentChips` shared uniformly by `PharmacyPOS` and `PosOrder` alongside `ShortcutBar` and `KeyBadge`.
  - Added `.pos-theme` Light/Dark CSS custom properties and persisted Light/Dark toggle.
  - Applied consistent 3-zone layout across both POS pages: compact customer/shift top bar, ~62% left Search + Category pills + Quick-access cards + virtualized catalog, ~38% right Cart + Totals/Discount + Payment Chips + `Save & Print [F9]` / `Save Only [F10]` actions, and sticky bottom shortcut bar.

## [Task 6] Extended RBAC, Shifts, PIN Overrides, Auto-Lock & Audit Logs
- **Schema Extensions (`prisma/schema.prisma`, migration `20261128140000_rbac_shifts_audit`)**:
  - Added `User.pinHash`, `User.mustChangePassword`, `PlatformAdmin.mustChangePassword`, `Role.maxDiscountPct`, `Role.canEditPrice`, `Role.allowedMethods`, `Role.requireShift`, `Role.settings`, `PharmacyShift`, and `AuditLog` cleanly without breaking existing data.
- **Granular Permissions, Cost Stripping & Roles (`src/lib/permissions.js`, `src/lib/default-roles.js`, `src/lib/scope.js`, `src/lib/nav.js`, `PERMISSIONS.md`)**:
  - Added `pos.discount`, `pos.discount_override`, `pos.void`, `pos.refund`, `pos.shift_own`, and `inventory.cost_view`.
  - Added `Pharmacy POS` (cashier-only: POS + own sales + own shift, max 10% discount, cost/profit stripped), `Pharmacist`, `Lab POS`, and `Accountant` roles alongside existing standard roles.
  - Enforced server-side discount % limits, allowed payment methods, cashier own-sales filtering, and cost/profit stripping on `/api/pharmacy/medicines`, `/api/pharmacy/batches`, `/api/pharmacy/sales`, and `/api/orders`.
- **PIN Login, Overrides, Shifts, Auto-Lock & Audit Trail**:
  - Added Login Password/PIN mode (`src/app/login/page.js`, `/api/auth/login` rate-limited), inactivity auto-lock + `Alt+L` lock (`src/components/session-lock.jsx`, `/api/auth/unlock`), Manager PIN Override modal (`PinOverrideModal.jsx`, `verifyManagerOverride`), Cashier Shift Open/Close + X/Z report (`/api/pharmacy/shifts`, `ShiftModal.jsx`), Security & Audit Logs UI (`/audit-logs`, `/api/audit-logs`), Staff PIN management, extended Role limits editor, and `scripts/seed-super-admin.mjs` (`npm run admin:seed`).
