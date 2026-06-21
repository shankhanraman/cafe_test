// H2 — PostToolUse. When the contract changes, regenerate its derivatives immediately
// so client/hooks/Zod/mocks never lag the spec within a session.
import { readInput, targetPath, run, installed, ok, note } from './_util.mjs';

const input = await readInput();
const file = targetPath(input);

if (file !== 'openapi.yaml') ok();
if (!installed()) note('Contract changed but node_modules is missing — run install then `pnpm gen`.');

const { code, out } = run('npx', ['orval', '--config', 'orval.config.ts']);
if (code !== 0) {
  note(`H2: contract changed but \`pnpm gen\` failed. Generated client is now stale.\n${out}`);
}
note('H2: openapi.yaml changed — regenerated src/api/generated. Review the diff and re-run affected tests.');
