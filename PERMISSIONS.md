# LabOS Roles, Permissions & Security Matrix

LabOS enforces tenant isolation (`organizationId` + `branchId`) and role-based access control server-side on every page and API route.

## Role Configuration Fields
| Field | Default | Purpose |
| :--- | :--- | :--- |
| `maxDiscountPct` | `100` | Maximum discount percentage a staff role may apply without Manager PIN override |
| `canEditPrice` | `true` | Controls medicine/test price modifications |
| `allowedMethods` | `[]` (All) | Restricts POS payment chips & server payment acceptance (e.g. `CASH`, `CARD`) |
| `requireShift` | `false` | Prompts/tracks cashier drawer shift open/close for Pharmacy POS |

## Granular POS & Cost Permissions
- `pos.discount`: Apply bill/item discounts up to `maxDiscountPct`.
- `pos.discount_override`: Authorize discounts exceeding a cashier's limit via 4–6 digit Manager PIN.
- `pos.void`: Void/cancel completed sales bills (or authorize via Manager PIN).
- `pos.refund`: Process medicine returns/refunds (or authorize via Manager PIN).
- `pos.shift_own`: Open/close own POS shift and print X/Z shift summary report.
- `inventory.cost_view`: View purchase prices (`purchasePrice`, `defaultPurchasePrice`, `costPrice`), stock valuation, and profit margins. Staff without this permission receive responses with cost/margin fields stripped server-side.

## Standard Role Matrix
| Role | Modules & Access | Max Disc % | Cost/Profit | Notes |
| :--- | :--- | :--- | :--- | :--- |
| **Super Admin** | Full platform across all organizations/branches | 100% | Yes | Seeded once via `npm run admin:seed` (`mustChangePassword: true`) |
| **Organization Admin** | Full access across all branches in own org | 100% | Yes | Manages org settings, roles, audit logs |
| **Branch Admin** | Full access within assigned branch | 100% | Yes | Can act as override PIN approver |
| **Pharmacy Manager** | Full Pharmacy modules + POS + Reports + `pos.*` | 100% | Yes | Full override & void/refund authority |
| **Pharmacist** | `pharmacy.view`, `pharmacy_pos.*`, `pharmacy_inventory.*`, `pos.refund` | 15% | No | No price edits or profit reports |
| **Pharmacy POS** | `pharmacy_pos.*`, `pos.discount`, `pos.shift_own` | 10% | **Stripped** | Cashier-only: POS + own sales & own shift report only; no inventory/reports/Lab access |
| **Store Keeper** | Lab & Pharmacy Inventory, Suppliers, Purchases | 0% | Yes | Back-office stock & purchasing only |
| **Lab Technician** | `samples.*`, `results.*`, view orders/patients/tests | 0% | No | Lab workflow only |
| **Lab POS** | `patients.*`, `orders.*`, `billing.*`, `reports.view`, `pos.discount` | 10% | No | Front-desk lab counter & billing only |
| **Accountant** | Read-only Financial, Billing, Expenses & Pharmacy Reports | 0% | Yes | Audit & reporting only |

## Security Controls
- **Quick PIN Login & Screen Auto-Lock**: Staff can sign in with `Username + 4-6 digit PIN`; active screens auto-lock after 15 minutes of inactivity (or `Alt+L`), requiring password or PIN to unlock without clearing active carts.
- **Rate Limiting**: Login (`/api/auth/login`) and screen unlock (`/api/auth/unlock`) throttle repeated failures (HTTP `429`).
- **Audit Trail (`/audit-logs`, `GET /api/audit-logs`)**: Logs login events, failed logins, screen unlocks, Manager PIN overrides, bill voids, returns/refunds, shift open/close, and role updates.
