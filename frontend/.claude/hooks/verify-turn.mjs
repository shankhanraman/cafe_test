// H6 — Stop. Close the loop within the session: typecheck + affected tests before the
// turn yields. If the bill-preview flow changed, force its invariant tests to run.
// Exit 2 keeps Claude working until it's green.
import { existsSync } from 'node:fs';
import { readInput, run, installed, pm, ok, block } from './_util.mjs';

const input = await readInput();

// Loop guard: if this Stop was itself triggered by a previous blocking Stop hook, don't
// block again — otherwise an unfixable typecheck/test error loops the session forever.
if (input.stop_hook_active) ok();

if (!installed() || !existsSync('tsconfig.json')) ok();

const PM = pm();

const tc = run(PM, ['run', '-s', 'typecheck']);
if (tc.code !== 0) {
  block(`H6: typecheck failed — fix before finishing.\n${tc.out.slice(-4000)}`);
}

// Only run tests if a test runner is configured.
const hasTests = existsSync('vite.config.ts') || existsSync('vitest.config.ts');
if (hasTests) {
  const changed = run('git', ['diff', '--name-only', 'HEAD']).out
    .split('\n')
    .map((f) => f.trim())
    .filter(Boolean);

  // Trust-critical invariants: when a domain's feature code changes, force its fitness tests
  // to run regardless of what else changed.
  const INVARIANTS = [
    { match: 'features/bill-preview/', path: 'src/features/bill-preview' }, // gated confirm
    { match: 'features/sales/', path: 'src/features/sales' }, // sale 400-cases
    { match: 'features/inventory/', path: 'src/features/inventory' }, // stock / low-stock rules
  ];
  const forced = INVARIANTS.filter((i) => changed.some((f) => f.includes(i.match))).map((i) => i.path);

  let args;
  if (forced.length > 0) {
    args = ['exec', 'vitest', 'run', ...forced];
  } else {
    const changedSrc = changed.filter((f) => /\.(ts|tsx)$/.test(f));
    if (changedSrc.length === 0) ok(); // nothing testable changed
    args = ['exec', 'vitest', 'related', '--run', ...changedSrc];
  }
  const t = run(PM, args);
  if (t.code !== 0) {
    block(`H6: tests failed — fix before finishing.\n${t.out.slice(-4000)}`);
  }
}

ok();
