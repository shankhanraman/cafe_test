---
name: bill-preview
description: Implement or modify the bill-preview flow — the core "OCR proposes, a person confirms" screen. Encodes the three-row-state machine, the gated Confirm, inline new-item creation, supplier-alias display, and the async OCR poll. Invoke whenever building or changing anything under src/features/bill-preview.
---

# Bill-preview flow

This is the heart of the product. Get it right; the harness guards it (preview-invariant
tests in H6, the `preview-invariant-reviewer` agent on PRs).

## The async lifecycle (never synchronous)

1. User uploads a photo/PDF → `POST /bills` (multipart) → `{ jobId, status: "processing" }`.
2. Poll `GET /bills/{jobId}` (TanStack Query with `refetchInterval` while `processing`) until:
   - `done` → show the preview table with `lines`.
   - `unreadable` → show "couldn't read this image", offer re-upload or manual entry. **Never
     render a confirmable table.**
   - `failed` → generic error + retry.
3. On confirm → `POST /bills/{jobId}/confirm` with resolved lines + supplierId →
   `{ purchaseId, updatedCount, newItemsCount, total }` → success summary → dashboard.

## The three row states

| State | Meaning | UI | Resolved when |
|---|---|---|---|
| `confident` (green) | clean match to an inventory item | pre-filled, editable | accepted → has `resolvedItemId` |
| `needs_review` (amber) | fuzzy/uncertain; ranked suggestions | suggestion dropdown, unsure field highlighted | user picks/overrides → has `resolvedItemId` |
| `new` (flagged) | no catalog match | inline create (name, **Unit enum**, reorderThreshold) **or** skip | created → `resolvedItemId`; or `skipped: true` |

## The invariant (do not reimplement — import it)

All resolve/gate logic lives in `src/features/bill-preview/state.ts`. Use:
- `isRowResolved(row)` — per-row.
- `isConfirmEnabled(rows)` — gates the Confirm button. **Confirm is disabled while any row is
  unresolved.** Never compute this inline.

Tests in `state.test.ts` lock this down. If you change the rules, change them there first.

## Supplier & learned aliases

- Let the user confirm/select the supplier (or add a new one) before confirm.
- A known supplier's learned aliases are already applied server-side to improve matching;
  surface them read-only (e.g. "matched via this supplier's alias 'Tamatar' → Tomatoes").
- On confirm, new corrections are persisted server-side so the next bill matches better — the
  frontend just sends the resolved mappings; it doesn't manage the alias store.

## Build checklist

- [ ] Upload + processing/poll states (no synchronous assumption).
- [ ] Three row states render and are reachable; `unreadable`/`failed` never confirmable.
- [ ] Per-row edit (quantity, unit), suggestion dropdown, inline new-item, skip.
- [ ] Inline new-item maps to `InventoryRequest`: name + **Unit enum** (map OCR free-text unit
      like "litre"→ML) + reorderThreshold; `quantityOnHand` is sourced from the line quantity
      at confirm. No `category` field (that belongs to Menu now).
- [ ] Confirm gated via `isConfirmEnabled`.
- [ ] Success summary (updated / new / total), then dashboard reflects new stock.
- [ ] Mixed-script item names render with correct `lang`; keyboard-operable table.
- [ ] All data via generated hooks; fixtures cover every state.
