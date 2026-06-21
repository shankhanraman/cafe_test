# AROGYA Inventory — API Contract

> **Live, interactive docs** (when the app is running):
> - Swagger UI: `http://localhost:8080/swagger-ui.html`
> - OpenAPI JSON (codegen-ready): `http://localhost:8080/v3/api-docs`
>
> This file is a hand summary; the OpenAPI spec above is generated from the code and authoritative.

Base URL `http://localhost:8080` · JSON in/out · IDs are UUID strings · quantities decimal ·
timestamps ISO-8601 UTC. Errors return RFC 7807 `ProblemDetail` (`application/problem+json`):
`404` unknown id, `400` validation. Body: `{ "status", "detail", ... }`.

## Suppliers — `/api/suppliers`
| Method | Path | Body | Returns |
|---|---|---|---|
| POST | `/api/suppliers` | `SupplierRequest` | 201 `SupplierResponse` |
| GET | `/api/suppliers` | — | `SupplierResponse[]` |
| GET | `/api/suppliers/{id}` | — | `SupplierResponse` |
| PUT | `/api/suppliers/{id}` | `SupplierRequest` | `SupplierResponse` |
| DELETE | `/api/suppliers/{id}` | — | 204 |

## Inventory — `/api/inventory`
| Method | Path | Body | Returns |
|---|---|---|---|
| POST | `/api/inventory` | `InventoryRequest` | 201 `InventoryResponse` |
| GET | `/api/inventory` | — | `InventoryResponse[]` |
| GET | `/api/inventory/low-stock` | — | `LowStockResponse[]` |
| GET | `/api/inventory/{id}` | — | `InventoryResponse` |
| PUT | `/api/inventory/{id}` | `InventoryRequest` | `InventoryResponse` |
| POST | `/api/inventory/{id}/adjust` | `AdjustRequest` | `InventoryResponse` (delivery/correction) |
| DELETE | `/api/inventory/{id}` | — | 204 |

## Menu — `/api/menu`
| Method | Path | Body | Returns |
|---|---|---|---|
| POST | `/api/menu` | `MenuRequest` | 201 `MenuResponse` |
| GET | `/api/menu` | — | `MenuResponse[]` |
| GET | `/api/menu/{id}` | — | `MenuResponse` |
| PUT | `/api/menu/{id}` | `MenuRequest` | `MenuResponse` |
| DELETE | `/api/menu/{id}` | — | 204 |
| GET | `/api/menu/{id}/recipe` | — | `MenuResponse` (with `recipe[]`) |
| PUT | `/api/menu/{id}/recipe` | `RecipeRequest` | `MenuResponse` (MADE only) |

## Sales — `/api/sales`
| Method | Path | Body | Returns |
|---|---|---|---|
| POST | `/api/sales` | `SaleRequest` | 201 `SaleResponse` (deducts stock in one txn) |
| GET | `/api/sales` | — | `SaleResponse[]` (latest 100) |

## Payload shapes

```jsonc
// SupplierRequest                         // SupplierResponse adds: "id"
{ "name": "Acme", "phone": "123", "notes": "" }

// InventoryRequest                        // InventoryResponse adds: "id"
{ "name": "Milk", "unit": "ML", "quantityOnHand": 1000,
  "reorderThreshold": 200, "supplierId": "uuid|null" }

// AdjustRequest  (delta may be negative; cannot drop stock below 0)
{ "delta": 250, "reason": "delivery" }

// LowStockResponse
{ "id":"uuid","name":"Milk","quantityOnHand":10,"reorderThreshold":200,
  "supplierId":"uuid|null","supplierName":"Acme|null" }

// MenuRequest                             // MenuResponse adds: "id","recipe":[RecipeLine]
{ "name":"Tea","category":"TEA_COFFEE","type":"MADE","resaleItemId":"uuid|null" }

// RecipeRequest / RecipeLine
{ "lines": [ { "orderSize":"REGULAR", "inventoryItemId":"uuid", "quantity":180 } ] }

// SaleRequest                             // SaleResponse adds: id, menuItemName, soldAt
{ "menuItemId":"uuid", "orderSize":"REGULAR|null", "quantity":2 }
```

## Enums (fixed string values)
- `unit`: `SACHET` · `ML` · `PIECE`
- `category`: `CIGARETTES` · `TEA_COFFEE` · `MILK_SHAKES` · `JUICES` · `COLD_DRINKS` · `SNACKS` · `KULHAD`
- `type`: `MADE` (has recipe) · `RESALE` (has `resaleItemId`)
- `orderSize`: `REGULAR` · `LESS` · `SERVING` — **required for MADE sales, null/omitted for RESALE**

## Behavior notes for the frontend
- A sale is **never blocked** by low stock; stock can go to/below zero and then appears in `low-stock`.
- `400` cases: negative qty, MADE sale missing/unknown `orderSize`, RESALE with no linked stock.
- `low-stock` = items where `quantityOnHand <= reorderThreshold`.
