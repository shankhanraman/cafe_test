create table goods_receipt (
    id           uuid primary key,
    supplier_id  uuid references supplier(id),
    bill_number  varchar(100),
    bill_date    varchar(50),
    engine_used  varchar(50),
    status       varchar(30) not null,        -- APPLIED, PARTIAL, UNMATCHED_SUPPLIER
    raw_json     jsonb,
    created_at   timestamptz not null,
    constraint uq_goods_receipt_supplier_bill unique (supplier_id, bill_number)
);

create table goods_receipt_line (
    id               uuid primary key,
    receipt_id       uuid not null references goods_receipt(id),
    description      varchar(500),
    scanned_quantity numeric(12,2),
    scanned_unit     varchar(50),
    matched_item_id  uuid references inventory_item(id),
    applied_quantity numeric(12,2),
    line_status      varchar(30) not null,    -- APPLIED, UNMATCHED_ITEM, NEEDS_REVIEW
    note             varchar(500)
);

create index idx_goods_receipt_supplier on goods_receipt (supplier_id);
create index idx_goods_receipt_line_receipt on goods_receipt_line (receipt_id);
