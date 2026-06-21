import { describe, it, expect } from 'vitest';
import { validateSale, canRecordSale, type SaleDraft, type SaleMenuItem } from './sale-validation';

// Fitness function for the sales 400-cases. Red here → H6 keeps the turn open.

const made: SaleMenuItem = { id: 'm1', name: 'Tea', type: 'MADE', resaleItemId: null };
const resale: SaleMenuItem = { id: 'm2', name: 'Cigarette', type: 'RESALE', resaleItemId: 'inv-cig' };
const resaleUnlinked: SaleMenuItem = { id: 'm3', name: 'Chips', type: 'RESALE', resaleItemId: null };

const draft = (over: Partial<SaleDraft>): SaleDraft => ({
  menuItem: made,
  orderSize: 'REGULAR',
  quantity: 2,
  ...over,
});

describe('validateSale — the 400 cases', () => {
  it('accepts a valid MADE sale with an order size', () => {
    expect(validateSale(draft({}))).toEqual([]);
    expect(canRecordSale(draft({}))).toBe(true);
  });

  it('accepts a valid RESALE sale with no order size', () => {
    const d = draft({ menuItem: resale, orderSize: null });
    expect(validateSale(d)).toEqual([]);
  });

  it('rejects non-positive quantity', () => {
    expect(validateSale(draft({ quantity: 0 }))).toContain('NON_POSITIVE_QUANTITY');
    expect(validateSale(draft({ quantity: -3 }))).toContain('NON_POSITIVE_QUANTITY');
    expect(validateSale(draft({ quantity: null }))).toContain('NON_POSITIVE_QUANTITY');
  });

  it('MADE sale requires an order size', () => {
    expect(validateSale(draft({ orderSize: null }))).toContain('MADE_REQUIRES_ORDER_SIZE');
  });

  it('MADE sale rejects an unknown order size', () => {
    expect(
      validateSale(draft({ orderSize: 'HUGE' as unknown as SaleDraft['orderSize'] }))
    ).toContain('MADE_UNKNOWN_ORDER_SIZE');
  });

  it('RESALE sale rejects a provided order size', () => {
    expect(
      validateSale(draft({ menuItem: resale, orderSize: 'REGULAR' }))
    ).toContain('RESALE_ORDER_SIZE_NOT_ALLOWED');
  });

  it('RESALE item with no linked inventory cannot be sold', () => {
    expect(
      validateSale(draft({ menuItem: resaleUnlinked, orderSize: null }))
    ).toContain('RESALE_NO_LINKED_INVENTORY');
  });

  it('blocks recording when any violation exists', () => {
    expect(canRecordSale(draft({ orderSize: null }))).toBe(false);
    expect(canRecordSale(draft({ menuItem: null }))).toBe(false);
  });
});
