// H4 — PostToolUse. Format + lint-fix the single file Claude just edited.
// Fast (one file), runs before Husky so commits are clean the first time.
import { readInput, targetPath, run, installed, ok, note } from './_util.mjs';

const input = await readInput();
const file = targetPath(input);

if (!file || !/\.(ts|tsx|js|jsx|css|json|md)$/.test(file)) ok();
if (file.includes('src/api/generated/')) ok(); // leave generated output alone
if (!installed()) ok(); // pre-install: nothing to run

run('npx', ['prettier', '--write', file]);
if (/\.(ts|tsx|js|jsx)$/.test(file)) {
  const { out } = run('npx', ['eslint', '--fix', file]);
  if (out) note(`eslint left findings on ${file}:\n${out}`);
}
ok();
