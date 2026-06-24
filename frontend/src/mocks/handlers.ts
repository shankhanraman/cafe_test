// Stateful MSW backend for backend-free development. Implements the real depletion / adjust /
// validation behavior the design specifies, against the generated contract shapes.
import { http, HttpResponse, delay } from 'msw';
import {
  db,
  depleteForSale,
  nextSaleId,
  nextSupplierId,
  nextInventoryId,
  nextMenuId,
} from './db';
import type { LowStockResponse } from '../api/generated/model/lowStockResponse';
import type { SaleResponse } from '../api/generated/model/saleResponse';
import type { SupplierRequest } from '../api/generated/model/supplierRequest';
import type { SupplierResponse } from '../api/generated/model/supplierResponse';
import type { InventoryRequest } from '../api/generated/model/inventoryRequest';
import type { InventoryResponse } from '../api/generated/model/inventoryResponse';
import type { MenuRequest } from '../api/generated/model/menuRequest';
import type { MenuResponse } from '../api/generated/model/menuResponse';
import type { ScanReceiptResponse } from '../api/generated/model/scanReceiptResponse';

// Same-origin paths: the app calls `/api/...` on the dev server, so MSW intercepts here in
// mock mode, and the Vite proxy forwards to the real backend when mocks are off.
const u = (path: string) => path;

const problem = (status: number, detail: string) =>
  HttpResponse.json({ status, detail, title: status === 400 ? 'Validation failure' : 'Not found' }, {
    status,
    headers: { 'content-type': 'application/problem+json' },
  });

export const handlers = [
  // ---- inventory
  http.get(u('/api/inventory'), () => HttpResponse.json(db.inventory)),
  http.get(u('/api/inventory/low-stock'), () => {
    const low: LowStockResponse[] = db.inventory
      .filter((i) => i.quantityOnHand <= i.reorderThreshold)
      .map((i) => ({
        id: i.id,
        name: i.name,
        quantityOnHand: i.quantityOnHand,
        reorderThreshold: i.reorderThreshold,
        supplierId: i.supplierId ?? null,
        supplierName: db.suppliers.find((s) => s.id === i.supplierId)?.name ?? null,
      }));
    return HttpResponse.json(low);
  }),
  http.post(u('/api/inventory'), async ({ request }) => {
    const body = (await request.json()) as InventoryRequest;
    if (!body.name?.trim()) return problem(400, 'Item name is required');
    const created: InventoryResponse = {
      id: nextInventoryId(),
      name: body.name,
      unit: body.unit,
      quantityOnHand: body.quantityOnHand,
      reorderThreshold: body.reorderThreshold,
      supplierId: body.supplierId ?? null,
    };
    db.inventory.push(created);
    return HttpResponse.json(created, { status: 201 });
  }),
  http.get(u('/api/inventory/:id'), ({ params }) => {
    const it = db.inventory.find((i) => i.id === params.id);
    return it ? HttpResponse.json(it) : problem(404, 'Unknown inventory id');
  }),
  http.put(u('/api/inventory/:id'), async ({ params, request }) => {
    const it = db.inventory.find((i) => i.id === params.id);
    if (!it) return problem(404, 'Unknown inventory id');
    const body = (await request.json()) as InventoryRequest;
    if (!body.name?.trim()) return problem(400, 'Item name is required');
    it.name = body.name;
    it.unit = body.unit;
    it.quantityOnHand = body.quantityOnHand;
    it.reorderThreshold = body.reorderThreshold;
    it.supplierId = body.supplierId ?? null;
    return HttpResponse.json(it);
  }),
  http.delete(u('/api/inventory/:id'), ({ params }) => {
    const i = db.inventory.findIndex((x) => x.id === params.id);
    if (i === -1) return problem(404, 'Unknown inventory id');
    db.inventory.splice(i, 1);
    return new HttpResponse(null, { status: 204 });
  }),
  http.post(u('/api/inventory/:id/adjust'), async ({ params, request }) => {
    const it = db.inventory.find((i) => i.id === params.id);
    if (!it) return problem(404, 'Unknown inventory id');
    const body = (await request.json()) as { delta: number; reason: string };
    const next = it.quantityOnHand + body.delta;
    if (next < 0) return problem(400, 'Adjustment would drop stock below zero');
    it.quantityOnHand = next;
    return HttpResponse.json(it);
  }),

  // ---- menu & recipes
  http.get(u('/api/menu'), () => HttpResponse.json(db.menu)),
  http.post(u('/api/menu'), async ({ request }) => {
    const body = (await request.json()) as MenuRequest;
    if (!body.name?.trim()) return problem(400, 'Menu item name is required');
    if (body.type === 'RESALE' && !body.resaleItemId)
      return problem(400, 'Resale items must link an inventory item');
    if (body.type === 'MADE' && body.resaleItemId)
      return problem(400, 'Made-to-order items must not link an inventory item');
    const created: MenuResponse = {
      id: nextMenuId(),
      name: body.name,
      category: body.category,
      type: body.type,
      resaleItemId: body.type === 'RESALE' ? body.resaleItemId : null,
      recipe: [],
    };
    db.menu.push(created);
    return HttpResponse.json(created, { status: 201 });
  }),
  http.get(u('/api/menu/:id'), ({ params }) => {
    const m = db.menu.find((x) => x.id === params.id);
    return m ? HttpResponse.json(m) : problem(404, 'Unknown menu id');
  }),
  http.put(u('/api/menu/:id'), async ({ params, request }) => {
    const m = db.menu.find((x) => x.id === params.id);
    if (!m) return problem(404, 'Unknown menu id');
    const body = (await request.json()) as MenuRequest;
    if (!body.name?.trim()) return problem(400, 'Menu item name is required');
    if (body.type === 'RESALE' && !body.resaleItemId)
      return problem(400, 'Resale items must link an inventory item');
    if (body.type === 'MADE' && body.resaleItemId)
      return problem(400, 'Made-to-order items must not link an inventory item');
    m.name = body.name;
    m.category = body.category;
    m.type = body.type;
    m.resaleItemId = body.type === 'RESALE' ? body.resaleItemId : null;
    if (body.type === 'RESALE') m.recipe = [];
    return HttpResponse.json(m);
  }),
  http.delete(u('/api/menu/:id'), ({ params }) => {
    const i = db.menu.findIndex((x) => x.id === params.id);
    if (i === -1) return problem(404, 'Unknown menu id');
    db.menu.splice(i, 1);
    return new HttpResponse(null, { status: 204 });
  }),
  http.get(u('/api/menu/:id/recipe'), ({ params }) => {
    const m = db.menu.find((x) => x.id === params.id);
    return m ? HttpResponse.json(m) : problem(404, 'Unknown menu id');
  }),
  http.put(u('/api/menu/:id/recipe'), async ({ params, request }) => {
    const m = db.menu.find((x) => x.id === params.id);
    if (!m) return problem(404, 'Unknown menu id');
    if (m.type !== 'MADE') return problem(400, 'Only MADE items can have a recipe');
    const body = (await request.json()) as { lines: NonNullable<typeof m.recipe> };
    m.recipe = body.lines;
    return HttpResponse.json(m);
  }),

  // ---- suppliers
  http.get(u('/api/suppliers'), () => HttpResponse.json(db.suppliers)),
  http.get(u('/api/suppliers/:id'), ({ params }) => {
    const s = db.suppliers.find((x) => x.id === params.id);
    return s ? HttpResponse.json(s) : problem(404, 'Unknown supplier id');
  }),
  http.post(u('/api/suppliers'), async ({ request }) => {
    const body = (await request.json()) as SupplierRequest;
    if (!body.name?.trim()) return problem(400, 'Supplier name is required');
    const created: SupplierResponse = {
      id: nextSupplierId(),
      name: body.name,
      phone: body.phone ?? null,
      notes: body.notes ?? null,
    };
    db.suppliers.push(created);
    return HttpResponse.json(created, { status: 201 });
  }),
  http.put(u('/api/suppliers/:id'), async ({ params, request }) => {
    const s = db.suppliers.find((x) => x.id === params.id);
    if (!s) return problem(404, 'Unknown supplier id');
    const body = (await request.json()) as SupplierRequest;
    if (!body.name?.trim()) return problem(400, 'Supplier name is required');
    s.name = body.name;
    s.phone = body.phone ?? null;
    s.notes = body.notes ?? null;
    return HttpResponse.json(s);
  }),
  http.delete(u('/api/suppliers/:id'), ({ params }) => {
    const i = db.suppliers.findIndex((x) => x.id === params.id);
    if (i === -1) return problem(404, 'Unknown supplier id');
    db.suppliers.splice(i, 1);
    return new HttpResponse(null, { status: 204 });
  }),

  // ---- sales (the POS write — deducts stock; mirrors the 400 cases)
  http.get(u('/api/sales'), () => HttpResponse.json(db.sales.slice(0, 100))),
  http.post(u('/api/sales'), async ({ request }) => {
    const body = (await request.json()) as {
      menuItemId: string;
      orderSize?: string | null;
      quantity: number;
    };
    const m = db.menu.find((x) => x.id === body.menuItemId);
    if (!m) return problem(404, 'Unknown menu item');
    if (body.quantity == null || body.quantity <= 0) return problem(400, 'Quantity must be greater than zero');
    if (m.type === 'MADE' && !body.orderSize) return problem(400, 'Order size is required for made-to-order items');
    if (m.type === 'RESALE' && body.orderSize) return problem(400, 'Resale items must not carry an order size');
    if (m.type === 'RESALE' && !m.resaleItemId) return problem(400, 'Resale item has no linked inventory');

    depleteForSale(m.id, body.orderSize ?? null, body.quantity);
    const saleRes: SaleResponse = {
      id: nextSaleId(),
      menuItemId: m.id,
      menuItemName: m.name,
      orderSize: (body.orderSize as SaleResponse['orderSize']) ?? undefined,
      quantity: body.quantity,
      soldAt: new Date().toISOString(),
    };
    db.sales.unshift(saleRes);
    return HttpResponse.json(saleRes, { status: 201 });
  }),

  // ---- receiving: scan a supplier bill and apply matched lines to stock (mirrors the backend's
  // synchronous scan-and-apply). Matched lines bump db.inventory; the rest are flagged.
  http.post(u('/api/receiving/scan'), async ({ request }) => {
    await request.formData(); // consume the multipart upload (file ignored in the mock)
    await delay(600);

    const apply = (id: string, qty: number, scannedUnit: string) => {
      const it = db.inventory.find((i) => i.id === id);
      if (it) it.quantityOnHand += qty;
      return {
        description: it?.name ?? id,
        scannedQuantity: qty,
        scannedUnit,
        matchedItemId: id,
        appliedQuantity: qty,
        lineStatus: 'APPLIED' as const,
        note: null,
      };
    };

    const lines: ScanReceiptResponse['lines'] = [
      apply('inv-milk', 4000, 'ml'),
      apply('inv-cardamom', 100, 'box'),
      {
        description: 'टमाटर (Tamatar)',
        scannedQuantity: 12,
        scannedUnit: 'kg',
        matchedItemId: null,
        appliedQuantity: null,
        lineStatus: 'NEEDS_REVIEW',
        note: 'Ambiguous match — confirm the item in Inventory.',
      },
      {
        description: 'Imported olives',
        scannedQuantity: 2,
        scannedUnit: 'jar',
        matchedItemId: null,
        appliedQuantity: null,
        lineStatus: 'UNMATCHED_ITEM',
        note: 'No inventory item matched this line.',
      },
    ];

    const applied = lines.filter((l) => l.lineStatus === 'APPLIED').length;
    const needsReview = lines.filter((l) => l.lineStatus === 'NEEDS_REVIEW').length;
    const unmatched = lines.filter((l) => l.lineStatus === 'UNMATCHED_ITEM').length;

    const receipt: ScanReceiptResponse = {
      receiptId: nextSaleId().replace('sale', 'rcpt'),
      supplierId: 'sup-greenleaf',
      status: applied > 0 && (needsReview > 0 || unmatched > 0) ? 'PARTIAL' : 'APPLIED',
      applied,
      needsReview,
      unmatched,
      lines,
    };
    return HttpResponse.json(receipt);
  }),
];
