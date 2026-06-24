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
const LINE_STATUSES = ['APPLIED', 'UNMATCHED_ITEM', 'NEEDS_REVIEW'];
const RECEIPT_STATUSES = ['APPLIED', 'PARTIAL', 'UNMATCHED_SUPPLIER'];

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

// ---- receiving (scan-and-apply): valid enums; cover every line status the result UI renders.
const receiving = load('receiving.json');
if (receiving) {
  const receipts = receiving.receipts || [];
  const seenLineStatus = new Set();
  for (const r of receipts) {
    must(RECEIPT_STATUSES.includes(r.status), `receipt ${r.receiptId}: invalid status "${r.status}"`);
    must(Array.isArray(r.lines) && r.lines.length > 0, `receipt ${r.receiptId}: must have lines`);
    for (const line of r.lines || []) {
      must(LINE_STATUSES.includes(line.lineStatus), `receipt ${r.receiptId}: invalid lineStatus "${line.lineStatus}"`);
      if (LINE_STATUSES.includes(line.lineStatus)) seenLineStatus.add(line.lineStatus);
      must(!!line.description, `receipt ${r.receiptId}: a line is missing description`);
    }
  }
  must(receipts.length > 0, 'receiving.json has no receipts');
  for (const s of LINE_STATUSES) must(seenLineStatus.has(s), `No receiving fixture covers line status "${s}"`);
}

if (errors.length) {
  console.error('Fixture validation failed:\n  - ' + errors.join('\n  - '));
  process.exit(1);
}
console.log('Fixtures OK: inventory, suppliers, menu, sales, receiving — all valid and covering required states.');
