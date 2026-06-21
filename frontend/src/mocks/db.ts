// In-memory stateful store for the MSW mock backend. This is the demo "source of truth":
// sales deplete it, confirmed deliveries & positive adjusts increase it. All shapes match the
// generated contract models exactly.
import type { InventoryResponse } from '../api/generated/model/inventoryResponse';
import type { MenuResponse } from '../api/generated/model/menuResponse';
import type { SupplierResponse } from '../api/generated/model/supplierResponse';
import type { SaleResponse } from '../api/generated/model/saleResponse';

export const db: {
  inventory: InventoryResponse[];
  menu: MenuResponse[];
  suppliers: SupplierResponse[];
  sales: SaleResponse[];
} = {
  suppliers: [
    { id: 'sup-greenleaf', name: 'Green Leaf Sabzi Mandi', phone: '90000 00001', notes: 'Daily vegetables' },
    { id: 'sup-acme', name: 'Acme Dairy', phone: '90000 00002', notes: 'Morning milk' },
    { id: 'sup-kirana', name: 'Sharma Kirana', phone: '90000 00003', notes: 'Dry goods' },
  ],
  inventory: [
    inv('inv-milk', 'Milk', 'ML', 6400, 2000, 'sup-acme'),
    inv('inv-teabag', 'Tea bags', 'PIECE', 320, 60, 'sup-kirana'),
    inv('inv-sugar', 'Sugar sachet', 'SACHET', 70, 120, 'sup-kirana'),
    inv('inv-tomato', 'Tomatoes', 'PIECE', 18, 40, 'sup-greenleaf'),
    inv('inv-ginger', 'Ginger', 'PIECE', 9, 20, 'sup-greenleaf'),
    inv('inv-cardamom', 'Cardamom', 'SACHET', 240, 50, 'sup-kirana'),
    inv('inv-cola', 'Cola bottle', 'PIECE', 48, 24, 'sup-kirana'),
    inv('inv-chips', 'Potato chips', 'PIECE', 5, 15, 'sup-kirana'),
    inv('inv-cig', 'Cigarette', 'PIECE', 12, 20, 'sup-kirana'),
    inv('inv-kulhad', 'Kulhad cups', 'PIECE', 140, 80, 'sup-greenleaf'),
  ],
  menu: [
    made('menu-chai', 'Masala Chai', 'TEA_COFFEE', 25, [
      r('LESS', 'inv-milk', 120), r('LESS', 'inv-teabag', 1), r('LESS', 'inv-sugar', 1),
      r('REGULAR', 'inv-milk', 180), r('REGULAR', 'inv-teabag', 1), r('REGULAR', 'inv-sugar', 1), r('REGULAR', 'inv-ginger', 1),
      r('SERVING', 'inv-milk', 320), r('SERVING', 'inv-teabag', 2), r('SERVING', 'inv-sugar', 2), r('SERVING', 'inv-cardamom', 1),
    ]),
    made('menu-shake', 'Banana Shake', 'MILK_SHAKES', 70, [
      r('REGULAR', 'inv-milk', 250), r('REGULAR', 'inv-sugar', 2),
      r('SERVING', 'inv-milk', 400), r('SERVING', 'inv-sugar', 3),
    ]),
    resale('menu-cola', 'Cola (chilled)', 'COLD_DRINKS', 40, 'inv-cola'),
    resale('menu-chips', 'Potato chips', 'SNACKS', 20, 'inv-chips'),
    resale('menu-cig', 'Cigarette (single)', 'CIGARETTES', 18, 'inv-cig'),
  ],
  sales: [
    sale('sale-1', 'menu-chai', 'Masala Chai', 'REGULAR', 2, '2026-06-21T03:55:00Z'),
    sale('sale-2', 'menu-cola', 'Cola (chilled)', null, 1, '2026-06-21T04:20:00Z'),
    sale('sale-3', 'menu-shake', 'Banana Shake', 'SERVING', 1, '2026-06-21T04:48:00Z'),
  ],
};

function inv(
  id: string,
  name: string,
  unit: InventoryResponse['unit'],
  quantityOnHand: number,
  reorderThreshold: number,
  supplierId: string
): InventoryResponse {
  return { id, name, unit, quantityOnHand, reorderThreshold, supplierId };
}
function made(id: string, name: string, category: MenuResponse['category'], _price: number, recipe: MenuResponse['recipe']): MenuResponse {
  return { id, name, category, type: 'MADE', resaleItemId: null, recipe };
}
function resale(id: string, name: string, category: MenuResponse['category'], _price: number, resaleItemId: string): MenuResponse {
  return { id, name, category, type: 'RESALE', resaleItemId, recipe: [] };
}
function r(orderSize: 'REGULAR' | 'LESS' | 'SERVING', inventoryItemId: string, quantity: number) {
  return { orderSize, inventoryItemId, quantity };
}
function sale(
  id: string,
  menuItemId: string,
  menuItemName: string,
  orderSize: SaleResponse['orderSize'] | null,
  quantity: number,
  soldAt: string
): SaleResponse {
  return { id, menuItemId, menuItemName, orderSize: orderSize ?? undefined, quantity, soldAt };
}

let saleSeq = 100;
export const nextSaleId = () => `sale-${saleSeq++}`;

/** Recipe lines for a given order size (MADE items). */
export function recipeForSize(menuId: string, size: string) {
  const m = db.menu.find((x) => x.id === menuId);
  return (m?.recipe ?? []).filter((l) => l.orderSize === size);
}

/** Deplete stock for a sale. MADE → recipe[size] × qty; RESALE → qty from resaleItemId.
 *  Never blocked by low stock: quantities may go to/below zero. Returns depleted item names. */
export function depleteForSale(menuId: string, size: string | null, qty: number): string[] {
  const m = db.menu.find((x) => x.id === menuId);
  if (!m) return [];
  const touched: string[] = [];
  const apply = (invId: string, amount: number) => {
    const it = db.inventory.find((i) => i.id === invId);
    if (!it) return;
    it.quantityOnHand = it.quantityOnHand - amount; // may go below zero — intentional
    if (!touched.includes(it.name)) touched.push(it.name);
  };
  if (m.type === 'RESALE' && m.resaleItemId) {
    apply(m.resaleItemId, qty);
  } else if (m.type === 'MADE' && size) {
    for (const line of recipeForSize(menuId, size)) apply(line.inventoryItemId, line.quantity * qty);
  }
  return touched;
}
