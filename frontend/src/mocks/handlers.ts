// Stateful MSW backend for backend-free development. Implements the real depletion / adjust /
// validation behavior the design specifies, against the generated contract shapes.
import { http, HttpResponse, delay } from 'msw';
import { db, depleteForSale, nextSaleId } from './db';
import type { LowStockResponse } from '../api/generated/model/lowStockResponse';
import type { SaleResponse } from '../api/generated/model/saleResponse';

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
  http.get(u('/api/inventory/:id'), ({ params }) => {
    const it = db.inventory.find((i) => i.id === params.id);
    return it ? HttpResponse.json(it) : problem(404, 'Unknown inventory id');
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
  http.get(u('/api/menu/:id'), ({ params }) => {
    const m = db.menu.find((x) => x.id === params.id);
    return m ? HttpResponse.json(m) : problem(404, 'Unknown menu id');
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

  // ---- OCR bills (design-ahead-of-API; simple demo handlers)
  http.post(u('/api/bills'), () => HttpResponse.json({ jobId: 'job-demo', status: 'processing' }, { status: 202 })),
  http.get(u('/api/bills/:jobId'), async () => {
    await delay(300);
    return HttpResponse.json({ jobId: 'job-demo', status: 'done', supplierId: 'sup-greenleaf', lines: [] });
  }),
  http.post(u('/api/bills/:jobId/confirm'), () =>
    HttpResponse.json({ purchaseId: 'pur-demo', updatedCount: 0, newItemsCount: 0, total: 0 })
  ),
];
