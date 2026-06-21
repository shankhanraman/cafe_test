// The trust-critical state machine for the bill-preview flow.
// "OCR proposes, a person confirms" — Confirm is disabled until EVERY row is resolved.
// This is the single most important invariant in the app. Import these helpers; never
// recompute the gate inline (the harness greps for bypasses).

export type RowMatchState = 'confident' | 'needs_review' | 'new';

/** Inventory unit enum from the contract. The OCR-read free-text unit is mapped to one of
 *  these when the user creates a new item (e.g. "litre" → ML, "piece" → PIECE). */
export type Unit = 'SACHET' | 'ML' | 'PIECE';

export interface PreviewRow {
  lineId: string;
  rawName: string;
  matchState: RowMatchState;
  quantity: number | null;
  /** OCR-read free-text unit (e.g. "litre"); informational until mapped on create. */
  unit: string | null;
  /** Set once the user accepts a match, picks a suggestion, or creates a new item. */
  resolvedItemId: string | null;
  /** A `new` row the user chose not to add. A skipped row counts as resolved. */
  skipped: boolean;
  /** Inline new-item form for a `new` row. Mirrors InventoryRequest: the contract dropped
   *  `category` (that lives on Menu now) and requires a Unit enum + reorder threshold.
   *  `quantityOnHand` is not captured here — it is sourced from the line quantity at confirm. */
  newItemDraft: { name: string; unit: Unit; reorderThreshold: number } | null;
}

/** A row is resolved when it can no longer change what reaches stock. */
export function isRowResolved(row: PreviewRow): boolean {
  if (row.skipped) return true;

  // Quantity and unit must be present for anything that will be written.
  const measured = row.quantity != null && row.quantity > 0 && !!row.unit;
  if (!measured) return false;

  switch (row.matchState) {
    case 'confident':
    case 'needs_review':
      // Must point at a real inventory item.
      return !!row.resolvedItemId;
    case 'new':
      // Either created inline (resolvedItemId) or a complete draft to create on confirm.
      return !!row.resolvedItemId || !!row.newItemDraft;
    default:
      return false;
  }
}

/** The Confirm button's enabled state. Disabled while ANY row is unresolved. */
export function isConfirmEnabled(rows: PreviewRow[]): boolean {
  if (rows.length === 0) return false;
  // A bill where every line was skipped writes nothing — don't allow a no-op confirm.
  if (rows.every((r) => r.skipped)) return false;
  return rows.every(isRowResolved);
}

/** Count of rows still blocking confirm — useful for the "N rows need attention" hint. */
export function unresolvedCount(rows: PreviewRow[]): number {
  return rows.filter((r) => !isRowResolved(r)).length;
}
