// Shared helpers for Claude Code hooks. Kept tiny and dependency-free.
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

/** Read the hook payload Claude Code sends on stdin. Never throws. */
export async function readInput() {
  let raw = '';
  for await (const chunk of process.stdin) raw += chunk;
  try {
    return JSON.parse(raw || '{}');
  } catch {
    return {};
  }
}

/** The file path a tool acted on, normalised to forward slashes & project-relative. */
export function targetPath(input) {
  const p = input?.tool_input?.file_path || input?.tool_input?.path || '';
  if (!p) return '';
  const root = process.env.CLAUDE_PROJECT_DIR || process.cwd();
  const rel = path.isAbsolute(p) ? path.relative(root, p) : p;
  return rel.split(path.sep).join('/');
}

/** All new text a write introduces (Edit, Write, or MultiEdit). */
export function newContent(input) {
  const t = input?.tool_input || {};
  if (typeof t.content === 'string') return t.content;
  if (typeof t.new_string === 'string') return t.new_string;
  if (Array.isArray(t.edits)) return t.edits.map((e) => e?.new_string || '').join('\n');
  return '';
}

/** Detect the package manager so hooks don't hard-code pnpm. */
export function pm() {
  if (existsSync('pnpm-lock.yaml')) return 'pnpm';
  if (existsSync('yarn.lock')) return 'yarn';
  return 'npm';
}

/** Run a command, returning {code, out}. Inherits nothing; captures output. */
export function run(cmd, args) {
  const r = spawnSync(cmd, args, { encoding: 'utf8', shell: process.platform === 'win32' });
  return { code: r.status ?? 1, out: `${r.stdout || ''}${r.stderr || ''}`.trim() };
}

/** True once dependencies are installed — lets hooks no-op gracefully pre-install. */
export const installed = () => existsSync('node_modules');

/** Block the tool / turn: message goes back to Claude, exit 2 stops the action. */
export function block(msg) {
  process.stderr.write(msg + '\n');
  process.exit(2);
}

/** Allow silently. */
export const ok = () => process.exit(0);

/** Allow but surface a note to Claude (non-blocking). */
export function note(msg) {
  process.stderr.write(msg + '\n');
  process.exit(0);
}
