create table supplier (
    id    uuid primary key,
    name  varchar(200) not null,
    phone varchar(50),
    notes text
);

create table inventory_item (
    id                 uuid primary key,
    name               varchar(200) not null,
    unit               varchar(20)  not null,   -- SACHET, ML, PIECE
    quantity_on_hand   numeric(12,2) not null default 0,
    reorder_threshold  numeric(12,2) not null default 0,
    supplier_id        uuid references supplier(id)
);

create table menu_item (
    id              uuid primary key,
    name            varchar(200) not null,
    category        varchar(30)  not null,       -- CIGARETTES, TEA_COFFEE, ...
    type            varchar(10)  not null,       -- MADE, RESALE
    resale_item_id  uuid references inventory_item(id)
);

create table recipe_line (
    id                uuid primary key,
    menu_item_id      uuid not null references menu_item(id),
    order_size        varchar(20) not null,      -- REGULAR, LESS, SERVING
    inventory_item_id uuid not null references inventory_item(id),
    quantity          numeric(12,2) not null
);

create table sale (
    id           uuid primary key,
    menu_item_id uuid not null references menu_item(id),
    order_size   varchar(20),                    -- null for resale
    quantity     int not null default 1,
    sold_at      timestamptz not null
);

create index idx_inventory_low_stock on inventory_item (quantity_on_hand, reorder_threshold);
create index idx_recipe_menu_item on recipe_line (menu_item_id);
create index idx_sale_sold_at on sale (sold_at);
