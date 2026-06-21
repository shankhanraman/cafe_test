import { describe, it, expect } from 'vitest';
import {
  isRowResolved,
  isConfirmEnabled,
  unresolvedCount,
  type PreviewRow,
} from './state';

// Fitness function for the product's trust promise. If this file goes red, the harness
// (Stop hook H6) refuses to let the turn finish.

const base = (over: Partial<PreviewRow>): PreviewRow => ({
  lineId: 'l1',
  rawName: 'Tamatar',
  matchState: 'confident',
  quantity: 2,
  unit: 'kg',
  resolvedItemId: 'item-tomato',
  skipped: false,
  newItemDraft: null,
  ...over,
});

describe('isRowResolved', () => {
  it('confident row with a matched item + measure is resolved', () => {
    expect(isRowResolved(base({}))).toBe(true);
  });

  it('needs_review row without a chosen item is NOT resolved', () => {
    expect(
      isRowResolved(base({ matchState: 'needs_review', resolvedItemId: null }))
    ).toBe(false);
  });

  it('new row is resolved once a draft exists', () => {
    expect(
      isRowResolved(
        base({
          matchState: 'new',
          resolvedItemId: null,
          newItemDraft: { name: 'Kulhad cups', unit: 'PIECE', reorderThreshold: 50 },
        })
      )
    ).toBe(true);
  });

  it('new row with neither draft nor item is NOT resolved', () => {
    expect(
      isRowResolved(base({ matchState: 'new', resolvedItemId: null, newItemDraft: null }))
    ).toBe(false);
  });

  it('a skipped row is resolved regardless of state', () => {
    expect(
      isRowResolved(base({ matchState: 'new', resolvedItemId: null, skipped: true }))
    ).toBe(true);
  });

  it('a row missing quantity or unit is NOT resolved', () => {
    expect(isRowResolved(base({ quantity: null }))).toBe(false);
    expect(isRowResolved(base({ unit: null }))).toBe(false);
    expect(isRowResolved(base({ quantity: 0 }))).toBe(false);
  });
});

describe('isConfirmEnabled — the gate', () => {
  it('enabled only when every row is resolved', () => {
    const rows = [base({ lineId: 'a' }), base({ lineId: 'b' })];
    expect(isConfirmEnabled(rows)).toBe(true);
  });

  it('disabled if a single row is unresolved', () => {
    const rows = [
      base({ lineId: 'a' }),
      base({ lineId: 'b', matchState: 'needs_review', resolvedItemId: null }),
    ];
    expect(isConfirmEnabled(rows)).toBe(false);
    expect(unresolvedCount(rows)).toBe(1);
  });

  it('disabled for an empty table', () => {
    expect(isConfirmEnabled([])).toBe(false);
  });

  it('disabled when every row is skipped (a no-op confirm writes nothing)', () => {
    const rows = [base({ skipped: true }), base({ lineId: 'b', skipped: true })];
    expect(isConfirmEnabled(rows)).toBe(false);
  });

  it('enabled with a mix of matched, created, and skipped rows', () => {
    const rows = [
      base({ lineId: 'a' }),
      base({
        lineId: 'b',
        matchState: 'new',
        resolvedItemId: null,
        newItemDraft: { name: 'Sugar sachet', unit: 'SACHET', reorderThreshold: 100 },
      }),
      base({ lineId: 'c', skipped: true }),
    ];
    expect(isConfirmEnabled(rows)).toBe(true);
  });
});
