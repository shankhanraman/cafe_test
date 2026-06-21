// H7 — SessionStart. If the contract is newer than the generated client, the backend dev
// likely pushed a new spec. Surface it once, at the only moment it's cleanly actionable.
import { existsSync, statSync } from 'node:fs';
import { readInput, ok, note } from './_util.mjs';

await readInput();

const spec = 'openapi.yaml';
const gen = 'src/api/generated';
if (!existsSync(spec) || !existsSync(gen)) ok();

const specTime = statSync(spec).mtimeMs;
const genTime = statSync(gen).mtimeMs;
if (specTime > genTime) {
  note(
    'H7: openapi.yaml is newer than src/api/generated — the contract may have changed.\n' +
      'Run `pnpm gen`, or use the `contract-sync` agent to regenerate and list broken call sites.'
  );
}
ok();
