// Inventory stock rules shared by the catalog, adjust, and dashboard screens.
// Two contract rules live here so the UI never contradicts the backend:
//   - low-stock = quantityOnHand <= reorderThreshold
//   - /adjust delta may be negative but cannot drop stock below zero (sales are the ONLY
//     path allowed to take stock to/below zero — see sale-validation.ts).

export interface StockLevel {
  quantityOnHand: number;
  reorderThreshold: number;
}

/** Mirrors GET /api/inventory/low-stock membership. */
export function isLowStock(item: StockLevel): boolean {
  return item.quantityOnHand <= item.reorderThreshold;
}

/** Sort helper for the dashboard: low-stock first, then by how far below threshold. */
export function lowStockFirst<T extends StockLevel>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const aLow = isLowStock(a) ? 0 : 1;
    const bLow = isLowStock(b) ? 0 : 1;
    if (aLow !== bLow) return aLow - bLow;
    return a.quantityOnHand - a.reorderThreshold - (b.quantityOnHand - b.reorderThreshold);
  });
}

export type AdjustResult =
  | { ok: true; nextQuantity: number }
  | { ok: false; reason: 'BELOW_ZERO' };

/** Client-side guard mirroring the backend: an adjust may not drop stock below zero. */
export function previewAdjust(current: number, delta: number): AdjustResult {
  const next = current + delta;
  if (next < 0) return { ok: false, reason: 'BELOW_ZERO' };
  return { ok: true, nextQuantity: next };
}
