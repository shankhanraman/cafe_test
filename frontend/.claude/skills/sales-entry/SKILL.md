---
name: sales-entry
description: Implement or modify the sale-recording flow — pick a menu item, set quantity (and order size for MADE items), and record a sale that deducts stock in one transaction. Encodes the MADE/RESALE order-size rules, the non-negative-quantity rule, and the "never blocked by low stock" rule. Invoke whenever building or changing anything under src/features/sales.
---

# Sale-entry flow

Recording a sale is the second trust-critical write in the app (after the OCR confirm gate).
A sale **deducts inventory stock in one backend transaction** (`POST /api/sales`), so the
frontend's job is to stop invalid sales *before* submit with precise messages — mirroring the
backend's RFC 7807 400s.

## The rules (do not reimplement — import them)

All validation lives in `src/features/sales/sale-validation.ts`. Use `validateSale(draft)` →
`SaleViolation[]` and `canRecordSale(draft)` to gate the Record button. `VIOLATION_MESSAGES`
maps each violation to user-facing copy.

| Rule | Why |
|---|---|
| `quantity > 0` | negative/zero quantity → 400 |
| **MADE** item ⇒ `orderSize` required and a valid enum | a made drink/dish needs a size to know the recipe draw |
| **RESALE** item ⇒ `orderSize` omitted | resale items are sold as-is |
| **RESALE** item ⇒ has `resaleItemId` | an item with no linked inventory can't be sold |

## What the UI must do

- Menu item picker drives the form: when a **MADE** item is chosen, show the order-size
  selector (REGULAR / LESS / SERVING) and require it; when a **RESALE** item is chosen, hide
  order size entirely.
- Quantity input rejects ≤ 0 and shows `VIOLATION_MESSAGES.NON_POSITIVE_QUANTITY`.
- Record button gated by `canRecordSale`.
- **Never** block the sale because stock is low or zero — a sale always proceeds; stock may go
  to/below zero, after which the item surfaces in low-stock. Do not add a stock-availability
  check here.
- On success (`SaleResponse`), show a short confirmation (item name, qty, time) and let the
  dashboard/low-stock reflect the deduction. Invalidate the inventory and low-stock queries.
- Surface backend 400s from `ApiError.problem.detail` in case server-side state differs from
  the client's view (e.g. the menu item changed type).

## Build checklist

- [ ] Form adapts to MADE vs RESALE (order size shown/required only for MADE).
- [ ] `validateSale` drives inline errors; Record gated by `canRecordSale`.
- [ ] No client-side low-stock block on sales.
- [ ] All data via generated hooks; inventory + low-stock queries invalidated after a sale.
- [ ] Backend ProblemDetail surfaced; quantities are decimals.
- [ ] Colocated Vitest test for the MADE/RESALE/quantity branches.
