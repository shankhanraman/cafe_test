// H3 — PostToolUse. When a mock/fixture changes, validate it against the contract's
// shape and the three-state coverage rule. Delegates to the shared fitness script so the
// same check runs in CI.
import { readInput, targetPath, run, ok, note } from './_util.mjs';

const input = await readInput();
const file = targetPath(input);

if (!/^src\/mocks\//.test(file) && !/fixtures\//.test(file)) ok();

const { code, out } = run('node', ['scripts/validate-fixtures.mjs']);
if (code !== 0) {
  note(`Blocked-soft (H3): fixture validation failed after editing ${file}.\n${out}`);
}
ok();
