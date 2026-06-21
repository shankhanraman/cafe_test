import { describe, it, expect } from 'vitest';
import { isLowStock, lowStockFirst, previewAdjust } from './stock';

describe('isLowStock', () => {
  it('is true when at or below the reorder threshold', () => {
    expect(isLowStock({ quantityOnHand: 200, reorderThreshold: 200 })).toBe(true);
    expect(isLowStock({ quantityOnHand: 10, reorderThreshold: 200 })).toBe(true);
  });
  it('is false above the threshold', () => {
    expect(isLowStock({ quantityOnHand: 201, reorderThreshold: 200 })).toBe(false);
  });
});

describe('lowStockFirst', () => {
  it('surfaces low-stock items before healthy ones', () => {
    const items = [
      { name: 'ok', quantityOnHand: 500, reorderThreshold: 100 },
      { name: 'low', quantityOnHand: 5, reorderThreshold: 100 },
    ];
    expect(lowStockFirst(items).map((i) => i.name)).toEqual(['low', 'ok']);
  });
});

describe('previewAdjust — cannot drop below zero', () => {
  it('allows a positive delivery', () => {
    expect(previewAdjust(100, 250)).toEqual({ ok: true, nextQuantity: 350 });
  });
  it('allows a negative correction that stays >= 0', () => {
    expect(previewAdjust(100, -100)).toEqual({ ok: true, nextQuantity: 0 });
  });
  it('rejects an adjust that would go below zero', () => {
    expect(previewAdjust(100, -101)).toEqual({ ok: false, reason: 'BELOW_ZERO' });
  });
});
