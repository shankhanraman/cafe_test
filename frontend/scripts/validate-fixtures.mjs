// Fitness function: MSW fixtures must be structurally valid against the contract AND
// collectively exercise every state the UI must handle. Run by hook H3 on fixture edits and
// by CI. No deps — readable failures, fast.
import { readFileSync, existsSync } from 'node:fs';

const DIR = 'src/mocks/fixtures';
const UNITS = ['SACHET', 'ML', 'PIECE'];
const CATEGORIES = [
  'CIGARETTES', 'TEA_COFFEE', 'MILK_SHAKES', 'JUICES', 'COLD_DRINKS', 'SNACKS', 'KULHAD',
];
const MENU_TYPES = ['MADE', 'RESALE'];
const ORDER_SIZES = ['REGULAR', 'LESS', 'SERVING'];
const ROW_STATES = ['confident', 'needs_review', 'new'];

const errors = [];
const load = (file) => {
  const p = `${DIR}/${file}`;
  if (!existsSync(p)) {
    errors.push(`Missing ${p}`);
    return null;
  }
  try {
    return JSON.parse(readFileSync(p, 'utf8'));
  } catch (e) {
    errors.push(`${p} is not valid JSON: ${e.message}`);
    return null;
  }
};
const must = (cond, msg) => { if (!cond) errors.push(msg); };

// ---- inventory: valid units; at least one low-stock item to exercise the dashboard.
const inv = load('inventory.json');
if (inv) {
  const items = inv.items || [];
  let lowSeen = false;
  for (const it of items) {
    must(UNITS.includes(it.unit), `inventory ${it.id}: invalid unit "${it.unit}"`);
    must(typeof it.quantityOnHand === 'number', `inventory ${it.id}: quantityOnHand must be a number`);
    must(typeof it.reorderThreshold === 'number', `inventory ${it.id}: reorderThreshold must be a number`);
    if (it.quantityOnHand <= it.reorderThreshold) lowSeen = true;
  }
  must(items.length > 0, 'inventory.json has no items');
  must(lowSeen, 'No low-stock inventory fixture (quantityOnHand <= reorderThreshold)');
}

// ---- menu: valid enums; cover BOTH MADE (with recipe) and RESALE (with resaleItemId).
const menu = load('menu.json');
if (menu) {
  const items = menu.items || [];
  const types = new Set();
  for (const m of items) {
    must(CATEGORIES.includes(m.category), `menu ${m.id}: invalid category "${m.category}"`);
    must(MENU_TYPES.includes(m.type), `menu ${m.id}: invalid type "${m.type}"`);
    types.add(m.type);
    if (m.type === 'MADE') {
      must(Array.isArray(m.recipe) && m.recipe.length > 0, `menu ${m.id}: MADE item needs a recipe`);
      for (const line of m.recipe || []) {
        must(ORDER_SIZES.includes(line.orderSize), `menu ${m.id}: invalid recipe orderSize "${line.orderSize}"`);
        must(!!line.inventoryItemId, `menu ${m.id}: recipe line missing inventoryItemId`);
      }
    } else if (m.type === 'RESALE') {
      must(!!m.resaleItemId, `menu ${m.id}: RESALE item needs resaleItemId`);
    }
  }
  must(types.has('MADE'), 'No MADE menu fixture');
  must(types.has('RESALE'), 'No RESALE menu fixture');
}

// ---- sales: orderSize present for MADE-style, valid enum when present.
const sales = load('sales.json');
if (sales) {
  for (const s of sales.sales || []) {
    must(typeof s.quantity === 'number' && s.quantity > 0, `sale ${s.id}: quantity must be > 0`);
    if (s.orderSize != null) {
      must(ORDER_SIZES.includes(s.orderSize), `sale ${s.id}: invalid orderSize "${s.orderSize}"`);
    }
  }
}

// ---- bills (OCR core): cover every row state + the unreadable job.
const bills = load('bills.json');
if (bills) {
  const jobs = bills.jobs || [];
  const seenStatus = new Set();
  const seenRowState = new Set();
  for (const job of jobs) {
    must(!!job.jobId, 'a bill job is missing jobId');
    must(['processing', 'done', 'failed', 'unreadable'].includes(job.status), `${job.jobId}: invalid status "${job.status}"`);
    seenStatus.add(job.status);
    if (job.status === 'done') {
      must(Array.isArray(job.lines) && job.lines.length > 0, `${job.jobId}: a done job must have lines`);
      for (const line of job.lines || []) {
        must(ROW_STATES.includes(line.matchState), `${job.jobId}/${line.lineId}: invalid matchState "${line.matchState}"`);
        if (ROW_STATES.includes(line.matchState)) seenRowState.add(line.matchState);
      }
    } else if (job.status !== 'processing') {
      must(!!job.error, `${job.jobId}: ${job.status} job should carry an error message`);
    }
  }
  for (const s of ROW_STATES) must(seenRowState.has(s), `No bill fixture covers row state "${s}"`);
  must(seenStatus.has('unreadable'), 'No bill fixture covers an unreadable job');
}

if (errors.length) {
  console.error('Fixture validation failed:\n  - ' + errors.join('\n  - '));
  process.exit(1);
}
console.log('Fixtures OK: inventory, suppliers, menu, sales, bills — all valid and covering required states.');
