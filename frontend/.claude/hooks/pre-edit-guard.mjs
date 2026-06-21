// H1 + H5 — PreToolUse guard. Denies writes that would corrupt the harness.
//  H1: no hand-editing Orval-generated code.
//  H5: no raw fetch/axios outside the api layer.
import { readInput, targetPath, newContent, block, ok } from './_util.mjs';

const input = await readInput();
const file = targetPath(input);
if (!file) ok();

// H1 — generated client is derived from openapi.yaml; edits here are wiped by `pnpm gen`.
if (file.includes('src/api/generated/')) {
  block(
    `Blocked (H1): ${file} is Orval-generated and regeneration will erase this edit.\n` +
      `Fix the source instead: edit openapi.yaml, then run \`pnpm gen\`. ` +
      `If you need custom request behaviour, edit src/api/http-client.ts.`
  );
}

// H5 — every network call must go through the generated, typed, mockable client.
const isApiLayer = file.startsWith('src/api/');
const isTest = /\.(test|spec)\.[tj]sx?$/.test(file);
if (!isApiLayer && !isTest) {
  const content = newContent(input);
  const raw = /\bfetch\s*\(|\baxios\b|new\s+XMLHttpRequest/;
  if (raw.test(content)) {
    block(
      `Blocked (H5): ${file} introduces a raw network call.\n` +
        `Use the generated TanStack Query hook for this endpoint (src/api/generated/**). ` +
        `If the endpoint doesn't exist yet, add it to openapi.yaml and run \`pnpm gen\`.`
    );
  }
}

ok();
