// Trust-critical rules for recording a sale. The backend enforces these and returns RFC 7807
// 400s; the frontend mirrors them so the user is stopped BEFORE submit with a precise message.
// This is the sales-domain analog of the bill-preview confirm gate. Import these helpers;
// never re-derive the rules inline (the harness greps for bypasses).

export type MenuType = 'MADE' | 'RESALE';
export type OrderSize = 'REGULAR' | 'LESS' | 'SERVING';

const ORDER_SIZES: OrderSize[] = ['REGULAR', 'LESS', 'SERVING'];

export interface SaleMenuItem {
  id: string;
  name: string;
  type: MenuType;
  /** The inventory item a RESALE menu item draws down. Null for MADE. */
  resaleItemId: string | null;
}

export interface SaleDraft {
  menuItem: SaleMenuItem | null;
  orderSize: OrderSize | null;
  quantity: number | null;
}

export type SaleViolation =
  | 'NO_MENU_ITEM'
  | 'NON_POSITIVE_QUANTITY'
  | 'MADE_REQUIRES_ORDER_SIZE'
  | 'MADE_UNKNOWN_ORDER_SIZE'
  | 'RESALE_ORDER_SIZE_NOT_ALLOWED'
  | 'RESALE_NO_LINKED_INVENTORY';

export const VIOLATION_MESSAGES: Record<SaleViolation, string> = {
  NO_MENU_ITEM: 'Pick a menu item.',
  NON_POSITIVE_QUANTITY: 'Quantity must be greater than zero.',
  MADE_REQUIRES_ORDER_SIZE: 'This made-to-order item needs an order size.',
  MADE_UNKNOWN_ORDER_SIZE: 'Choose a valid order size (Regular, Less, or Serving).',
  RESALE_ORDER_SIZE_NOT_ALLOWED: 'Resale items are sold as-is — leave order size empty.',
  RESALE_NO_LINKED_INVENTORY: 'This resale item has no linked inventory and cannot be sold.',
};

/** Every rule the backend would 400 on, returned together so the UI can show them at once. */
export function validateSale(draft: SaleDraft): SaleViolation[] {
  const v: SaleViolation[] = [];

  if (!draft.menuItem) {
    v.push('NO_MENU_ITEM');
    // Without a menu item we can't reason about type rules; quantity still checkable.
  }
  if (draft.quantity == null || draft.quantity <= 0) {
    v.push('NON_POSITIVE_QUANTITY');
  }

  const item = draft.menuItem;
  if (item?.type === 'MADE') {
    if (draft.orderSize == null) v.push('MADE_REQUIRES_ORDER_SIZE');
    else if (!ORDER_SIZES.includes(draft.orderSize)) v.push('MADE_UNKNOWN_ORDER_SIZE');
  } else if (item?.type === 'RESALE') {
    if (draft.orderSize != null) v.push('RESALE_ORDER_SIZE_NOT_ALLOWED');
    if (!item.resaleItemId) v.push('RESALE_NO_LINKED_INVENTORY');
  }

  return v;
}

/** The Record-sale button gate: enabled only when the draft has zero violations. */
export function canRecordSale(draft: SaleDraft): boolean {
  return validateSale(draft).length === 0;
}
