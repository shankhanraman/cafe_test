# Arogya Amrutalya Inventory — Frontend

Web client for a wellness-cafe inventory system. Two product pillars:

1. **OCR bill intake** — *"OCR proposes, a person confirms."* Upload a supplier bill, the
   backend OCR-extracts line items, the user resolves every line before anything writes to
   stock. (The original core; still here.)
2. **Menu, recipes & sales** (added v0.2) — a catalog of menu items (`MADE` items have a
   recipe of inventory draws; `RESALE` items map to one inventory item), and sales that
   **deduct stock in one transaction**.

The backend (Java/Spring) is built **in parallel by another developer**. We never wait on it:
we build against `openapi.yaml` and mock everything from it.

---

## Stack

- **React + Vite + TypeScript** (`strict: true`).
- **TanStack Query** for all server state. No server state in component state or a store.
- **Orval** generates the typed client, Query hooks, Zod schemas, and MSW mocks from
  `openapi.yaml`. Run `pnpm gen` after any contract change.
- **MSW** serves the whole app with mock data so we develop backend-free.
- **React Hook Form + Zod** (reuse generated Zod) for forms.
- **Vitest + RTL** (unit/component), **Playwright** (3–5 critical flows).
- Package manager **pnpm**. Backend base URL `http://localhost:8080`; errors are RFC 7807
  ProblemDetail (`application/problem+json`) — handled in `src/api/http-client.ts`.

## Domains & folder layout

```
openapi.yaml                  # THE contract — co-owned with the backend dev
src/
  api/
    http-client.ts            # fetch mutator: base URL + ProblemDetail (editable)
    generated/                # Orval output — GENERATED, never hand-edit
  features/
    bill-preview/  state.ts   # OCR confirm gate (invariant)
    sales/         sale-validation.ts   # sale 400-cases (invariant)
    inventory/     stock.ts   # low-stock + adjust-not-below-zero (invariant)
    menu/  suppliers/  dashboard/
  mocks/
    browser.ts  handlers.ts
    fixtures/                 # inventory · suppliers · menu · sales · bills
  components/
scripts/  e2e/  .claude/
```

## Hard rules (the harness enforces these — don't fight it)

1. **Never edit `src/api/generated/**`.** Change `openapi.yaml`, then `pnpm gen`. *(Hook H1.)*
2. **Never call `fetch`/`axios` outside `src/api/`.** Use the generated Query hook. *(Hook H5 +
   ESLint.)*
3. **The contract is shared.** Spec edits are deliberate, versioned acts. *(H2 regenerates;
   H7 warns on drift.)*
4. **Fixtures match the contract** and cover the states each screen must handle. *(H3 +
   `pnpm validate:fixtures`.)*

### Domain invariants — never re-derive inline; import the helper

- **OCR confirm gate** (`features/bill-preview/state.ts`): Confirm is disabled while any row is
  unresolved. Use `isConfirmEnabled`.
- **Sale rules** (`features/sales/sale-validation.ts`): use `validateSale` / `canRecordSale`.
  - quantity must be **> 0**;
  - **MADE** sale → `orderSize` required and must be a valid enum;
  - **RESALE** sale → `orderSize` must be omitted, and the item must have a linked
    `resaleItemId` (no linked inventory → cannot sell);
  - a sale is **never blocked by low stock** — stock may go to/below zero, then the item shows
    in low-stock. Do not add a client-side stock-availability block on sales.
- **Stock rules** (`features/inventory/stock.ts`): `isLowStock` = `quantityOnHand <=
  reorderThreshold`; `previewAdjust` — an **adjust** may be negative but must not drop stock
  below zero (sales are the only path allowed to). Use these, don't reimplement.

### Other rules

- **OCR is async** (submit-job + poll): `POST /api/bills` → `jobId`, then `GET /api/bills/{jobId}`
  until `status` is `done | failed | unreadable`. Sales/inventory/menu are synchronous.
- **Enums** come from the contract: `unit` SACHET·ML·PIECE; `category` CIGARETTES·TEA_COFFEE·
  MILK_SHAKES·JUICES·COLD_DRINKS·SNACKS·KULHAD; `type` MADE·RESALE; `orderSize`
  REGULAR·LESS·SERVING. Drive dropdowns from the generated enum types, never hard-coded strings.
- **Multilingual text** (item/bill names: Devanagari, romanized Hindi, English) — correct
  `lang` attributes, never assume ASCII, never mangle Unicode.

## Endpoints (see `openapi.yaml` for shapes)

| Domain | Endpoints |
|---|---|
| Suppliers | `GET/POST /api/suppliers`, `GET/PUT/DELETE /api/suppliers/{id}` |
| Inventory | `GET/POST /api/inventory`, `GET /api/inventory/low-stock`, `GET/PUT/DELETE /api/inventory/{id}`, `POST /api/inventory/{id}/adjust` |
| Menu | `GET/POST /api/menu`, `GET/PUT/DELETE /api/menu/{id}`, `GET/PUT /api/menu/{id}/recipe` (recipe PUT = MADE only) |
| Sales | `POST /api/sales` (deducts stock), `GET /api/sales` (latest 100) |
| Bills (OCR) | `POST /api/bills`, `GET /api/bills/{jobId}`, `POST /api/bills/{jobId}/confirm` |

## Workflow

- Design a screen with the `stitch` MCP + `frontend-design` skill before coding it.
- Implement the OCR flow via the `/bill-preview` skill; implement sale recording via the
  `/sales-entry` skill — each encodes its invariant so implementations stay consistent.
- On a PR: `/code-review` + `/security-review` (latter on uploads), and let the
  `preview-invariant-reviewer`, `sales-invariant-reviewer`, and `a11y-i18n-auditor` agents
  review in parallel.
- When the backend ships a new `openapi.yaml`, run the `contract-sync` agent.
- Fan out supporting screens with `screen-builder` agents in worktrees.

## Commands

| Command | What |
|---|---|
| `pnpm gen` | Regenerate client/hooks/Zod/mocks from `openapi.yaml` |
| `pnpm dev` | Vite dev server (MSW on) |
| `pnpm typecheck` / `pnpm test` / `pnpm test:affected` | tsc / Vitest |
| `pnpm validate:fixtures` | Fitness check: fixtures typed + cover required states |
| `pnpm lint` / `pnpm format` / `pnpm e2e` | ESLint / Prettier / Playwright |

## Harness map (what runs when)

- **Before a write:** H1 (block generated edits), H5 (block raw network).
- **After a write:** H4 (format+lint-fix), H2 (regen on contract change), H3 (validate fixtures).
- **End of turn:** H6 (typecheck + affected tests; forces the bill-preview, sales, and inventory
  invariants when those features changed).
- **Session start:** H7 (contract-drift warning).
- Agents: `contract-sync`, `preview-invariant-reviewer`, `sales-invariant-reviewer`,
  `a11y-i18n-auditor`, `screen-builder`.
- Skills: `/bill-preview`, `/sales-entry`.
