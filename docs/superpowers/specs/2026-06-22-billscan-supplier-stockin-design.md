# Supplier-Invoice Stock-In via billscan

**Date:** 2026-06-22
**Status:** Approved (design)

## Goal

Let the cafe backend accept a supplier's bill/invoice image or PDF, call the
**billscan** service to extract structured data, **auto-apply** the line items as
stock increases against that supplier's inventory items, and persist a
goods-receipt record as an audit trail.

## Context

- **billscan** — standalone FastAPI service (`billscan/`). `POST /scan` (multipart
  `file`, optional `engine=auto|glmocr|tesseract|gemini`) returns structured JSON:
  vendor, bill number/date, `line_items[]` (description, quantity, unit_price,
  amount), subtotal, tax, total. See `billscan/app/models.py`.
- **Backend** — Spring Boot (`com.arogya.cafe`), modules: inventory, menu, sales,
  supplier. Postgres + Flyway. House conventions in `backend/CLAUDE.md`.
- **Relevant entities:**
  - `InventoryItem`: id, name, `unit` (enum `SACHET|ML|PIECE`), `quantityOnHand`,
    `reorderThreshold`, optional `supplier` FK. Has `adjust(delta)`; service guards
    against negative stock.
  - `Supplier`: id, name, phone, notes.

## Key decisions

| Decision | Choice |
|----------|--------|
| What happens after scan | Stock-in from supplier invoices |
| Matching → stock | **Auto-apply** by name match, scoped to the supplier's items |
| Supplier identification | Caller may pass `supplierId`; else match scanned `vendor_name`/contact to a `Supplier` |
| Audit trail | Persist a goods-receipt record |
| billscan deployment | **Sidecar** container in the backend pod; backend calls `http://localhost:8000` (configurable) |
| Quantity/units | **Unit-aware**: map scanned unit to `Unit` enum; only apply when unit matches, else flag |

## Architecture & connectivity

- **billscan** runs as a **sidecar container** in the backend pod (FastAPI on
  `localhost:8000`; already has a Dockerfile). Backend reaches it at a configurable
  `billscan.base-url` (default `http://localhost:8000`) in `application.yml`.
- New backend module **`com.arogya.cafe.receiving`**
  (controller/service/dto/entity/repository, per house conventions) owns the
  integration: calls billscan, matches to inventory, applies stock, persists the
  receipt.
- New `RestClient` (or `WebClient`) bean for the multipart call to billscan,
  behind a `BillScanClient` interface so it is mockable in tests.

## billscan change (Python)

Add `unit: Optional[str] = None` to `LineItem` (`billscan/app/models.py`).
Populate it from the bill text (e.g. "2 kg", "5 ltr", "12 pcs") in:

- the **LLM structurer** (`billscan/app/structurer.py`), and
- the **regex fallback** parser (`billscan/app/parsing.py`).

Backwards-compatible: optional field, defaults to `null`.

## Backend flow — `POST /api/receiving/scan` (multipart)

Request: `file` (image/pdf), optional `supplierId`, optional `engine` (default `auto`).

1. **Resolve supplier** — if `supplierId` given, load it; else match scanned
   `vendor_name`/`vendor_contact` to a `Supplier`. If neither resolves → receipt
   saved with status `UNMATCHED_SUPPLIER`, **no stock changes**.
2. **Call billscan** `POST /scan` with the file → structured `BillData`.
3. **Per line item**, scoped to that supplier's `InventoryItem`s:
   - **Match by name** — normalized, case-insensitive equals/contains against the
     supplier's items.
   - **Map unit** via a synonym table → `Unit`:
     - `ML` ← `ml`, `milliliter`; `l`/`ltr`/`litre` → ML **×1000**
     - `PIECE` ← `pcs`, `pc`, `piece`, `nos`, `unit`, `ea`
     - `SACHET` ← `sachet`, `sachets`, `packet`
     - anything else (e.g. kg/grams) → no mapping
   - **Line status:**
     - name matched **and** mapped unit == item's `unit` → **APPLIED**:
       `item.adjust(+quantity)`
     - name not matched → **UNMATCHED_ITEM** (no stock change)
     - matched but unit missing/incompatible → **NEEDS_REVIEW** (no stock change)
4. **Persist** one `GoodsReceipt` + its `GoodsReceiptLine`s; return a summary.

A single scan may **partially apply**: confident lines update stock; ambiguous
lines are recorded but held.

## Data model (new tables, Flyway migration)

**`goods_receipt`**
- id (UUID, PK)
- supplier_id (UUID, FK → supplier, nullable)
- bill_number (text, nullable)
- bill_date (text, nullable)
- engine_used (text)
- status (text: `APPLIED` | `PARTIAL` | `UNMATCHED_SUPPLIER`)
- raw_json (jsonb) — full parsed billscan response
- created_at (timestamptz)
- **Unique `(supplier_id, bill_number)`** — prevents double-applying the same
  bill; a second attempt returns `409`/`DUPLICATE`.

**`goods_receipt_line`**
- id (UUID, PK)
- receipt_id (UUID, FK → goods_receipt)
- description (text)
- scanned_quantity (numeric, nullable)
- scanned_unit (text, nullable)
- matched_item_id (UUID, FK → inventory_item, nullable)
- applied_quantity (numeric, nullable)
- line_status (text: `APPLIED` | `UNMATCHED_ITEM` | `NEEDS_REVIEW`)
- note (text, nullable)

## Response DTO

`record` DTOs only (no JPA entities over the wire):

- receipt id, resolved supplier (id + name or null), overall status
- counts: `applied`, `needsReview`, `unmatched`
- per-line results: description, matched item (id + name or null),
  scanned qty/unit, applied qty, line status, note

## Error handling

- billscan unreachable/timeout → `502` ProblemDetail via `@RestControllerAdvice`;
  nothing persisted.
- Unsupported file / too large → surfaced from billscan as `4xx`.
- Duplicate bill `(supplier_id, bill_number)` → `409`.
- Stock never goes negative (operations here are additive; existing guard remains).

## Testing

- **Unit:** name-matching, unit-mapping table (incl. litre→ML ×1000),
  line-status decision logic, duplicate detection — `BillScanClient` mocked.
- **Integration (Testcontainers):** full flow with `BillScanClient` stubbed
  (WireMock or mock bean) → asserts stock adjusted, receipt + lines persisted,
  statuses correct, duplicate returns `409`.

## Out of scope

- Review/correction UI for `NEEDS_REVIEW` / `UNMATCHED_ITEM` lines (future).
- Auto-creating inventory items from unmatched line items.
- Unit conversions beyond the synonym/litre→ML table.
- Price/cost tracking from `unit_price`/`amount`.

## Implementation note

Follow the `spring-boot-spec-driven` workflow: update `docs/datamodel.md` (with
Mermaid E-R), `dataflow.md`, then `architecture.md` before writing code.
