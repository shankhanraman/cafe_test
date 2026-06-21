# Hooks reference

Harness-executed actions bound to Claude Code events, wired in `.claude/settings.json`.
Every hook is tied to a concrete failure mode on this project — none exist for decoration.

**Exit-code contract** (how a hook talks back to Claude):
- `exit 0` — allow. Anything written to stderr is shown as a non-blocking note.
- `exit 2` — block. For `PreToolUse` the tool call is denied; for `Stop` the turn is kept
  open; stderr is fed back to Claude as the reason.

All scripts read the event payload on stdin, normalise paths via `_util.mjs`, and **no-op
gracefully before `pnpm install`** (no `node_modules` → exit 0) so they never wedge a fresh
clone.

---

## H1 — Generated-code guard
- **Script:** `pre-edit-guard.mjs` · **Event:** `PreToolUse` · **Matcher:** `Edit|Write|MultiEdit`
- **Type:** feedforward (prevents before acting)
- **Trigger:** any write whose path is under `src/api/generated/`.
- **Behavior:** **denies** the write (exit 2) and tells Claude to edit `openapi.yaml` + run
  `pnpm gen`, or `src/api/http-client.ts` for custom request behavior.
- **Guards:** Claude hand-editing the Orval-generated client to make something compile, only
  for the next `pnpm gen` to silently erase it — drifting the client away from the contract.
- **Verified:** editing `src/api/generated/bills.ts` → blocked, exit 2.

## H5 — No-raw-network guard
- **Script:** `pre-edit-guard.mjs` (same guard, second rule) · **Event:** `PreToolUse` · **Matcher:** `Edit|Write|MultiEdit`
- **Type:** feedforward
- **Trigger:** new content introduces `fetch(`, `axios`, or `new XMLHttpRequest` in a file
  that is **not** under `src/api/` and is **not** a test.
- **Behavior:** **denies** the write (exit 2); directs Claude to the generated TanStack Query
  hook, or to add the endpoint to `openapi.yaml` if it doesn't exist yet.
- **Guards:** ad-hoc, untyped, unmocked, contract-blind network calls that break at
  integration. (ESLint `no-restricted-globals`/`no-restricted-imports` backstops this at CI;
  the hook catches it one step earlier, inside the agent loop.)
- **Verified:** raw `fetch` in `Dashboard.tsx` → blocked; `useListInventory()` → allowed.

## H4 — Edit-time format + lint-fix
- **Script:** `format-fix.mjs` · **Event:** `PostToolUse` · **Matcher:** `Edit|Write|MultiEdit`
- **Type:** feedback (verifies after acting)
- **Trigger:** the edited file matches `*.{ts,tsx,js,jsx,css,json,md}` and is not generated.
- **Behavior:** runs `prettier --write` then `eslint --fix` on **only that file**; surfaces
  any remaining ESLint findings as a non-blocking note.
- **Guards:** style/a11y-lint noise accumulating into bulk fixes at commit time. Scoped to one
  file so it's fast, and runs before Husky so commits are clean the first time.
- **Note:** reformats the file on disk, which can occasionally stale a follow-up `Edit`'s
  `old_string`. Known friction with format-on-save hooks; re-read the file if an edit misses.

## H2 — Contract→codegen sync
- **Script:** `regen-on-contract.mjs` · **Event:** `PostToolUse` · **Matcher:** `Edit|Write|MultiEdit`
- **Type:** feedback
- **Trigger:** the edited file is exactly `openapi.yaml`.
- **Behavior:** runs `npx orval` to regenerate the client, hooks, Zod schemas, and MSW mocks;
  reports success or the failure verbatim (a stale client is worse than a flagged one).
- **Guards:** Claude changing the contract but forgetting to regenerate, so types/hooks/mocks
  lag the spec for the rest of the session.

## H3 — Fixture validation
- **Script:** `validate-fixtures.mjs` · **Event:** `PostToolUse` · **Matcher:** `Edit|Write|MultiEdit`
- **Type:** feedback
- **Trigger:** the edited file is under `src/mocks/` or any `fixtures/` path.
- **Behavior:** runs `scripts/validate-fixtures.mjs` (the same fitness check CI runs) and notes
  any failure.
- **Guards:** mock data drifting from the contract (wrong enums, non-ISO dates, missing
  fields) or losing state coverage. The fixtures *are* the backend-free dev environment — a
  wrong fixture produces a green build that breaks on real integration.
- **Fitness rules enforced** (`scripts/validate-fixtures.mjs`): valid `unit`/`category`/`type`/
  `orderSize` enums; at least one **low-stock** inventory item; menu fixtures cover **both**
  `MADE` (with a recipe) and `RESALE` (with `resaleItemId`); positive sale quantities; and bill
  fixtures cover `confident`/`needs_review`/`new` rows **plus** an `unreadable` job.

## H6 — Turn-end verification
- **Script:** `verify-turn.mjs` · **Event:** `Stop`
- **Type:** feedback (the in-loop equivalent of CI)
- **Trigger:** Claude attempts to finish its turn.
- **Behavior:** runs `pnpm typecheck`, then affected Vitest. For each trust-critical domain
  whose feature code changed this session, it **forces** that domain's invariant tests to run:
  `features/bill-preview` (the OCR confirm gate), `features/sales` (the sale 400-cases), and
  `features/inventory` (low-stock + adjust-not-below-zero). Otherwise it runs `vitest related`
  on changed `.ts/.tsx` files. Any failure **blocks** the turn (exit 2) with the tail of the
  output so Claude fixes before yielding.
- **Loop guard:** if the payload carries `stop_hook_active: true` (this Stop was triggered by a
  previous blocking Stop), it exits 0 — preventing an unfixable error from looping the session.
- **Guards:** declaring a screen "done" while it doesn't typecheck or the confirm gate is
  broken — the most damaging silent regression in the app.
- **Verified:** `stop_hook_active:true` → exit 0; missing `node_modules` → exit 0.

## H7 — Session-start drift check
- **Script:** `check-drift.mjs` · **Event:** `SessionStart`
- **Type:** feedforward
- **Trigger:** start of a session, when both `openapi.yaml` and `src/api/generated` exist.
- **Behavior:** if the spec's mtime is newer than the generated dir, prints a one-line warning
  to run `pnpm gen` or the `contract-sync` agent. Read-only; never blocks.
- **Guards:** starting a session building against a stale client because the backend dev pushed
  a new spec version since the last codegen.

---

## Event → hook map (`.claude/settings.json`)

| Event | Matcher | Hooks (in order) |
|---|---|---|
| `PreToolUse` | `Edit\|Write\|MultiEdit` | `pre-edit-guard` (H1 + H5) |
| `PostToolUse` | `Edit\|Write\|MultiEdit` | `format-fix` (H4), `regen-on-contract` (H2), `validate-fixtures` (H3) |
| `Stop` | — | `verify-turn` (H6) |
| `SessionStart` | — | `check-drift` (H7) |

The three `PostToolUse` scripts each self-filter by path, so every one runs on every edit but
only the relevant one acts.

---

## Hooks deliberately NOT added (kept the set honest)

- **Pre-commit lint/test hook** — Husky + lint-staged already gate commits; a Claude hook would
  duplicate and double-run it.
- **Commit-message / conventional-commits hook** — belongs to `commitlint` in Husky, not the
  agent loop.
- **Full Playwright E2E on edit/Stop** — too slow (2–5 s/test) for in-loop; that's CI's job.
- **`UserPromptSubmit` context injector** — duplicates `CLAUDE.md` and the `/bill-preview`
  skill; just burns tokens.
- **Run-on-every-`Bash` / `Notification` / `PreCompact` hooks** — no project-specific failure
  mode; pure noise.
