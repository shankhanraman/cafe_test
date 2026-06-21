# Agents reference

Subagents are separate Claude agents spawned for a scoped task. On this project each one earns
its place via something a single in-context pass can't give: **parallel fan-out**,
**filesystem isolation**, or an **independent adversarial lens**. The built-in `Explore`,
`Plan`, and `general-purpose` agents cover generic needs; the five below are the
project-specific ones, defined as `.claude/agents/*.md` (frontmatter = `name`, `description`,
`tools`, `model`; body = the agent's system prompt).

**How to invoke:** the Agent tool with `subagent_type: "<name>"`. Run independent agents in a
single message so they execute concurrently.

---

## contract-sync
- **File:** `contract-sync.md` · **Tools:** Read, Grep, Glob, Bash, Edit · **Model:** sonnet
- **Run when:** the backend dev ships a new `openapi.yaml` version.
- **Goal:** turn a sprawling spec diff into a bounded, reviewable migration. Diffs the
  contract, runs `pnpm gen`, then greps the codebase for **every frontend call site the change
  breaks** — reporting each as `path:line — what breaks — how to fix`, classified
  breaking-vs-additive, breaking-first.
- **Output:** a migration report (`N breaking, M additive`) + a change→call-sites→fix table,
  and flags any contract change that contradicts the product spec as a question for the backend
  dev rather than silently adapting.
- **Leverage:** isolation + focus on the FE/BE integration seam — the project's #1 risk.
- **Guardrail:** never hand-edits `src/api/generated`; fixes call sites or proposes a contract
  correction. No refactoring beyond the migration.

## preview-invariant-reviewer
- **File:** `preview-invariant-reviewer.md` · **Tools:** Read, Grep, Glob, Bash · **Model:** sonnet
- **Run when:** any diff touches `src/features/bill-preview`. Run **in parallel with**
  `/code-review`, not instead of it.
- **Goal:** verify ONE thing deeply — the gated Confirm and the three-row-state machine — and
  actively **try to break it**. Probes empty suggestions, defaulted `needs_review` rows,
  `new` rows neither created nor skipped, cleared quantity/unit, all-rows-skipped, and
  `unreadable`/`failed` jobs reaching a confirmable table.
- **Output:** a **PASS/FAIL** verdict; for each hole, the exact input/sequence that breaks the
  invariant + `file:line`. On PASS, it lists which adversarial cases it actually tried (so the
  pass is trustworthy).
- **Leverage:** an independent adversarial lens on the product's trust promise — "OCR proposes,
  a person confirms."

## sales-invariant-reviewer
- **File:** `sales-invariant-reviewer.md` · **Tools:** Read, Grep, Glob, Bash · **Model:** sonnet
- **Run when:** any diff touches `src/features/sales` or `src/features/inventory`. Run **in
  parallel with** `/code-review`.
- **Goal:** verify the second trust-critical write — recording a sale deducts stock in one
  transaction — and **try to break** its rules: the sale 400-cases (quantity > 0;
  MADE-requires-orderSize; RESALE-forbids-orderSize; RESALE-needs-linked-inventory), the
  "never blocked by low stock" rule, the `adjust`-cannot-go-below-zero floor (sales are the
  only path allowed below zero), and the `<=` low-stock boundary.
- **Output:** a **PASS/FAIL** verdict; for each hole, the exact input that breaks the rule +
  `file:line`. On PASS, lists the adversarial cases actually tried.
- **Leverage:** an independent adversarial lens on the sales/stock domain, where a wrong rule
  means wrong inventory or a wrongly-rejected sale.

## a11y-i18n-auditor
- **File:** `a11y-i18n-auditor.md` · **Tools:** Read, Grep, Glob, Bash · **Model:** sonnet
- **Run when:** any PR touches UI.
- **Goal:** catch the two failure modes generic review misses here. **Accessibility** — axe
  violations (serious/critical only), and keyboard operability + focus order of the bill-preview
  table, including that the disabled Confirm is announced. **i18n** — mixed Devanagari /
  romanized-Hindi / English renders with correct `lang` attributes, no ASCII assumptions, no
  grapheme-cluster truncation, no mojibake round-trips; locale-sane number/currency formatting.
- **Output:** a list scoped to the diff (`file:line — issue — fix`), a11y and i18n grouped,
  with an explicit statement of whether the zero-serious-issues bar is met.
- **Leverage:** a specialized, parallelizable lens for the multilingual-bill domain.

## screen-builder
- **File:** `screen-builder.md` · **Tools:** Read, Grep, Glob, Edit, Write, Bash · **Model:** sonnet
- **Run when:** building the supporting screens (dashboard, catalog, suppliers, purchases,
  manual adjustment). **Not** for the bill-preview flow — use the `/bill-preview` skill there.
- **Goal:** build ONE screen end-to-end against MSW mocks — design (`stitch` MCP +
  `frontend-design` skill), component, wiring to **generated hooks only** (no raw `fetch`),
  fixtures covering empty/error states, loading + error UI, a colocated Vitest/RTL test, and
  correct i18n/a11y.
- **Output:** the screen + its fixtures + its test, typechecking and passing in isolation, plus
  a report of what was built and any contract gaps hit.
- **Leverage:** **parallel fan-out** — spawn several at once with `isolation: "worktree"` so
  concurrent screen builds don't collide on shared files.

---

## At a glance

| Agent | Trigger | Leverage | Returns |
|---|---|---|---|
| `contract-sync` | new `openapi.yaml` | isolation/focus (integration seam) | migration report + broken call sites |
| `preview-invariant-reviewer` | preview-flow diff | adversarial lens | PASS/FAIL + repro steps |
| `sales-invariant-reviewer` | sales/inventory diff | adversarial lens | PASS/FAIL + repro steps |
| `a11y-i18n-auditor` | any UI diff | specialized lens | scoped a11y/i18n violations |
| `screen-builder` | supporting screens | parallel fan-out (worktrees) | one built+tested screen |

## Agents deliberately NOT created (kept the set honest)

- **`upload-security-reviewer`** — **merged**, not created. File-upload safety and XSS-via-
  rendered-OCR-text are real risks, but the existing `/security-review` skill covers diffs;
  a standing agent would duplicate it. Just run `/security-review` on upload/preview changes.
- **`fixture-forge` (mock-data generator)** — **demoted** to an as-needed one-shot, not a
  standing agent. Seeding realistic messy-bill fixtures is valuable but is a one-time task; a
  permanent agent for it would be vanity.
- **`test-writer` / `refactor` / `docs` generalists** — **rejected.** No project-specific edge;
  a normal Claude pass, `/simplify`, or `/code-review` already covers them. A named agent would
  add ceremony, not capability.
