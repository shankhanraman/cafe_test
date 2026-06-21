Arogya Amrutalya Inventory is a web-based inventory management system for a wellness cafe, built around one core idea: the cafe's supplier bills update the inventory automatically. Instead of a staff member reading a paper bill and typing each item into a register, they photograph or upload the bill, and the system reads it, proposes the stock changes, and lets a person confirm them in a few clicks.
The problem it solves is the daily friction of manual stock-keeping. A cafe receives bills from many suppliers — vegetable vendors, dairy, dry-goods wholesalers — often handwritten, often mixing Hindi, romanized Hindi, and English. Entering these by hand is slow, error-prone, and usually skipped, which means stock records drift away from reality. This system removes the typing while keeping a human in control of accuracy.
The heart of the product is the bill-scanning flow. A user uploads a photo or PDF of a supplier bill; OCR extracts each line item's name, quantity, unit, and price; and the system presents a preview where every line is matched against the existing inventory. Confident matches are pre-filled, uncertain ones surface ranked suggestions, and unrecognized items are flagged so the user can add them as new ingredients or skip them. Nothing is written to stock until the user confirms, and the confirm action is locked until every line is resolved. Crucially, the system remembers corrections per supplier — once "Tamatar" is mapped to "Tomatoes" for a given vendor, future bills match it automatically — so it gets more accurate the more it's used.
Around that core, the system includes a small set of supporting features: a dashboard showing current stock with low-stock items surfaced first; an ingredient catalog with units and reorder thresholds; a supplier list with each supplier's purchase history and learned name aliases; a purchase log storing every confirmed bill (including the original image) for cost tracking and audit; and simple manual stock adjustments for things like spoilage or quick corrections.
The guiding principle throughout is OCR proposes, a person confirms — automation does the tedious extraction, but a human always approves before stock changes. That's what makes the system trustworthy enough to actually replace the paper register.
For the first version, the scope is deliberately lean: a single cafe, a single web dashboard, the bill-scanning flow, and the supporting screens above. Deeper capabilities — recipe-level ingredient depletion when dishes are sold, waste analytics, multiple outlets, or supplier reordering — are natural later additions once the bill-scanning habit is established.

---

## Update — v0.2 scope (Menu, Recipes & Sales)

Management has pulled forward two of those "later" additions; they are now in active build
**alongside** (not replacing) the OCR bill-scanning core, against the approved API contract
(`frontend/openapi.yaml`, drawn from the API spec PDF):

- **Menu catalog** — items are either `MADE` (a prepared drink/dish with a **recipe** of
  inventory draws, keyed by order size) or `RESALE` (sold as-is, linked to one inventory item).
  Categories: cigarettes, tea/coffee, milkshakes, juices, cold drinks, snacks, kulhad.
- **Recipes** — for `MADE` items, the per-order-size list of inventory items and quantities a
  sale consumes (e.g. one regular chai = 180 ML milk + 1 tea bag + 1 sugar sachet).
- **Sales** — recording a sale **deducts stock in one transaction**. A sale is *never blocked*
  by low stock: stock may fall to or below zero, after which the item surfaces in low-stock.
  `MADE` sales require an order size; `RESALE` sales must omit it and need a linked inventory
  item. Inventory units are SACHET / ML / PIECE; manual `adjust` may be negative but cannot
  drop stock below zero.

The guiding promise is unchanged for the OCR flow — *OCR proposes, a person confirms* — and the
sales flow adds its own guardrail: invalid sales are stopped before they ever deduct stock.