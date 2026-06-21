The user clicks "Scan bill" and uploads a photo or PDF of the supplier's bill (the slip the sabzi vendor, dairy supplier, or kirana wholesaler handed over).
The system runs OCR in the background and parses the bill into line items, pulling out item name, quantity, unit, and price for each row. A short processing state is shown so the user knows it's working.
If the scan is too blurry or unreadable to parse, the user is told the image couldn't be read and is prompted to re-upload a clearer photo or enter the items manually. Otherwise the flow continues.
The user is taken to a preview screen — a table of every extracted line item. Each row is auto-classified into one of three states:

Confident match (green): the line maps cleanly to an existing inventory item; the row is pre-filled and ready.
Needs review (amber): a value is uncertain or the name fuzzy-matches several items; the row shows a ranked suggestion dropdown and highlights the unsure field.
New item (flagged): no match in the catalog; the user can create a new inventory item inline (name, unit, category) or skip the line.


The user reviews the table top to bottom, correcting any wrong quantity or unit, accepting or overriding suggestions, and resolving every flagged new item. The confirm button stays disabled until no row is left in an unresolved state — nothing ambiguous can reach stock.
Optionally, the user selects or confirms the supplier for this bill. If the supplier is new, they add it; if it's known, the system has already applied that supplier's learned name aliases to improve matching.
The user clicks Confirm. The system updates the stock quantities for each item, saves a purchase record (with totals and the bill image attached for audit), links it to the supplier, and stores any new name mappings so the same bill matches more confidently next time.
The user sees a success summary — how many items were updated, how many new items were added, and the total cost — then returns to the dashboard, where stock levels now reflect the new delivery.

Supporting flows alongside the main one:
From the dashboard, the user can also browse the stock overview to check current quantities and see which items are below their reorder threshold. They can open the item catalog to add, edit, or set reorder thresholds on ingredients. They can manually adjust stock without a bill — for example logging spoilage or a quick correction — through a simple add/remove entry. And they can open the purchase log to review the history of confirmed bills for cost tracking, or revisit a past bill's stored image.
The whole design keeps one promise throughout: OCR only ever proposes, and a person confirms before anything is written to stock — which is what makes staff trust it enough to drop the paper register.

---

## v0.2 flows — Menu, Recipes & Sales

These run alongside the OCR flow above (they don't replace it).

**Building the menu.** From the menu screen the user adds a menu item and picks its type. A
`MADE` item (a prepared drink/dish) gets a **recipe**: for each order size (Regular, Less,
Serving) the user lists the inventory items and quantities it consumes — e.g. a regular Masala
Chai draws 180 ML milk, 1 tea bag, 1 sugar sachet. A `RESALE` item (sold as-is, like a single
cigarette) instead links to one inventory item; it has no recipe, and the screen won't let the
user attach one.

**Recording a sale.** The user opens the sales screen, picks a menu item, and enters a
quantity. If the item is `MADE`, an order-size selector appears and must be chosen; if it's
`RESALE`, no order size is shown. The Record button stays disabled until the entry is valid —
quantity above zero, an order size for made items, none for resale items. On Record, the system
deducts stock in a single transaction (a made item draws down each recipe ingredient; a resale
item draws down its linked inventory) and shows a short confirmation. Crucially, a sale is
**never blocked** by low stock: it always goes through, stock can fall to or below zero, and the
item then appears in the low-stock list so staff know to reorder. Manual stock corrections via
adjust, by contrast, can never push stock below zero — only sales can.

The sales flow adds its own promise to the OCR one: an invalid sale is stopped before it ever
touches stock, so the numbers staff act on stay trustworthy.