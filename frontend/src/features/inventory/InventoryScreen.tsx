import { useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useApp } from '../../app/app-context';
import {
  useListInventory,
  useAdjustStock,
  useCreateInventoryItem,
  useUpdateInventoryItem,
  useDeleteInventoryItem,
  useGetInventoryItem,
} from '../../api/generated/inventory/inventory';
import { useListSuppliers } from '../../api/generated/suppliers/suppliers';
import type { InventoryResponse } from '../../api/generated/model/inventoryResponse';
import { Unit } from '../../api/generated/model/unit';
import { ApiError } from '../../api/http-client';
import { isLowStock, previewAdjust } from './stock';
import { Card, Button, Badge, Pill, Modal } from '../../components/ui';
import { meta } from '../../lib/display';
import { IconPlus, IconEdit } from '../../lib/icons';

const UNITS = Object.values(Unit);

export function InventoryScreen() {
  const invQuery = useListInventory();
  const items = useMemo(() => invQuery.data?.data ?? [], [invQuery.data]);
  const [query, setQuery] = useState('');
  const [cat, setCat] = useState('All');
  const [adjustItem, setAdjustItem] = useState<InventoryResponse | null>(null);
  const [form, setForm] = useState<{ mode: 'create' } | { mode: 'edit'; id: string } | null>(null);

  const cats = useMemo(() => ['All', ...new Set(items.map((i) => meta(i.id).sub).filter(Boolean))], [items]);
  const filtered = items.filter(
    (i) =>
      (cat === 'All' || meta(i.id).sub === cat) &&
      (query === '' || i.name.toLowerCase().includes(query.toLowerCase()))
  );

  return (
    <div>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
        <h1 className="display" style={{ fontSize: 26, fontWeight: 700, margin: 0 }}>Inventory</h1>
        <Button onClick={() => setForm({ mode: 'create' })}><IconPlus size={16} /> Add item</Button>
      </header>

      <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search items…"
          aria-label="Search items"
          style={{ padding: '9px 13px', borderRadius: 10, border: '1px solid var(--border)', fontSize: 13.5, minWidth: 220 }}
        />
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {cats.map((c) => (
            <Pill key={c} active={cat === c} onClick={() => setCat(c)}>{c}</Pill>
          ))}
        </div>
      </div>

      <Card style={{ padding: 0, overflow: 'hidden' }}>
        <Row header cells={['Item', 'Category', 'In stock', 'Reorder at', 'Status', '']} />
        {filtered.map((it) => {
          const low = isLowStock(it);
          return (
            <Row
              key={it.id}
              cells={[
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{it.name}</div>
                  <div className="dvn" style={{ fontSize: 12, color: 'var(--faint)' }}>{meta(it.id).hi}</div>
                </div>,
                <span style={{ color: 'var(--muted)', fontSize: 13.5 }}>{meta(it.id).sub || '—'}</span>,
                <span className="mono" style={{ fontWeight: 600, color: low ? 'var(--flag)' : 'var(--confident)' }}>{it.quantityOnHand} {it.unit}</span>,
                <span className="mono" style={{ color: 'var(--faint)' }}>{it.reorderThreshold}</span>,
                low ? <Badge tone="flag">Low</Badge> : <Badge tone="confident">In stock</Badge>,
                <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                  <Button variant="ghost" style={{ padding: '6px 10px' }} onClick={() => setAdjustItem(it)}>Adjust</Button>
                  <Button variant="ghost" style={{ padding: '6px 10px' }} aria-label={`Edit ${it.name}`} onClick={() => setForm({ mode: 'edit', id: it.id })}><IconEdit size={15} /></Button>
                  <DeleteItemButton item={it} />
                </div>,
              ]}
            />
          );
        })}
      </Card>

      {adjustItem && <AdjustModal item={adjustItem} onClose={() => setAdjustItem(null)} />}
      {form && (
        <ItemFormModal
          mode={form.mode}
          id={form.mode === 'edit' ? form.id : undefined}
          onClose={() => setForm(null)}
        />
      )}
    </div>
  );
}

function Row({ cells, header }: { cells: React.ReactNode[]; header?: boolean }) {
  return (
    <div
      style={{
        display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 0.9fr 1.2fr', gap: 12, alignItems: 'center',
        padding: '12px 18px', borderBottom: '1px solid var(--divider)',
        fontSize: header ? 12 : 14, color: header ? 'var(--faint)' : 'var(--ink)',
        fontWeight: header ? 600 : 400, textTransform: header ? 'uppercase' : 'none', letterSpacing: header ? '0.04em' : 0,
      }}
    >
      {cells.map((c, i) => (
        <div key={i}>{c}</div>
      ))}
    </div>
  );
}

function DeleteItemButton({ item }: { item: InventoryResponse }) {
  const { showToast } = useApp();
  const qc = useQueryClient();
  const del = useDeleteInventoryItem();
  const remove = async () => {
    if (!window.confirm(`Delete "${item.name}"? This removes it from inventory.`)) return;
    try {
      await del.mutateAsync({ id: item.id });
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['/api/inventory'] }),
        qc.invalidateQueries({ queryKey: ['/api/inventory/low-stock'] }),
      ]);
      showToast({ title: 'Item deleted', sub: item.name });
    } catch (e) {
      showToast({ title: 'Could not delete item', sub: errMsg(e) });
    }
  };
  return (
    <Button variant="danger" style={{ padding: '6px 10px' }} disabled={del.isPending} onClick={remove}>Delete</Button>
  );
}

function ItemFormModal({ mode, id, onClose }: { mode: 'create' | 'edit'; id?: string; onClose: () => void }) {
  const { showToast } = useApp();
  const qc = useQueryClient();
  const create = useCreateInventoryItem();
  const update = useUpdateInventoryItem();
  const suppliers = useListSuppliers().data?.data ?? [];
  // Load the current record by id when editing — exercises GET /api/inventory/{id}.
  const existing = useGetInventoryItem(id ?? '', { query: { enabled: mode === 'edit' && !!id } });

  const [name, setName] = useState('');
  const [unit, setUnit] = useState<Unit>('PIECE');
  const [qty, setQty] = useState('0');
  const [threshold, setThreshold] = useState('0');
  const [supplierId, setSupplierId] = useState('');

  useEffect(() => {
    const res = existing.data;
    if (mode === 'edit' && res?.status === 200) {
      const it = res.data;
      setName(it.name);
      setUnit(it.unit);
      setQty(String(it.quantityOnHand));
      setThreshold(String(it.reorderThreshold));
      setSupplierId(it.supplierId ?? '');
    }
  }, [mode, existing.data]);

  const pending = create.isPending || update.isPending;
  const save = async () => {
    const data = {
      name: name.trim(),
      unit,
      quantityOnHand: Number(qty) || 0,
      reorderThreshold: Number(threshold) || 0,
      supplierId: supplierId || null,
    };
    try {
      if (mode === 'edit' && id) await update.mutateAsync({ id, data });
      else await create.mutateAsync({ data });
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['/api/inventory'] }),
        qc.invalidateQueries({ queryKey: ['/api/inventory/low-stock'] }),
      ]);
      showToast({ title: mode === 'edit' ? 'Item updated' : 'Item added', sub: data.name });
      onClose();
    } catch (e) {
      showToast({ title: 'Could not save item', sub: errMsg(e) });
    }
  };

  const loading = mode === 'edit' && existing.isLoading;
  return (
    <Modal title={mode === 'edit' ? 'Edit item' : 'Add item'} width={460} onClose={onClose}>
      {loading ? (
        <div style={{ padding: 24, color: 'var(--faint)', fontSize: 14 }}>Loading…</div>
      ) : (
        <>
          <Label>Name</Label>
          <input aria-label="Name" value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
            <div>
              <Label>Unit</Label>
              <select aria-label="Unit" value={unit} onChange={(e) => setUnit(e.target.value as Unit)} style={inputStyle}>
                {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <div>
              <Label>Supplier</Label>
              <select aria-label="Supplier" value={supplierId} onChange={(e) => setSupplierId(e.target.value)} style={inputStyle}>
                <option value="">— None —</option>
                {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
            <div>
              <Label>Quantity on hand</Label>
              <input aria-label="Quantity on hand" type="number" value={qty} onChange={(e) => setQty(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <Label>Reorder threshold</Label>
              <input aria-label="Reorder threshold" type="number" value={threshold} onChange={(e) => setThreshold(e.target.value)} style={inputStyle} />
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 18 }}>
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button disabled={!name.trim() || pending} onClick={save}>{mode === 'edit' ? 'Save changes' : 'Add item'}</Button>
          </div>
        </>
      )}
    </Modal>
  );
}

const REASONS = ['delivery', 'spoilage', 'correction'] as const;
const STEPS = [-1, -0.5, 0.5, 1, 5];

function AdjustModal({ item, onClose }: { item: InventoryResponse; onClose: () => void }) {
  const { showToast } = useApp();
  const qc = useQueryClient();
  const adjust = useAdjustStock();
  const [delta, setDelta] = useState(0);
  const [reason, setReason] = useState<(typeof REASONS)[number]>('delivery');

  const preview = previewAdjust(item.quantityOnHand, delta);
  const nextQty = preview.ok ? preview.nextQuantity : 0;

  const apply = async () => {
    await adjust.mutateAsync({ id: item.id, data: { delta, reason } });
    await Promise.all([
      qc.invalidateQueries({ queryKey: ['/api/inventory'] }),
      qc.invalidateQueries({ queryKey: ['/api/inventory/low-stock'] }),
    ]);
    showToast({ title: 'Stock adjusted', sub: `${item.name} · ${reason} · ${delta >= 0 ? '+' : ''}${delta}` });
    onClose();
  };

  return (
    <Modal title="Adjust stock" width={420} onClose={onClose}>
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontWeight: 600 }}>{item.name}</div>
        <div className="dvn" style={{ fontSize: 12.5, color: 'var(--faint)' }}>{meta(item.id).hi}</div>
        <div className="mono" style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>On hand: {item.quantityOnHand} {item.unit}</div>
      </div>

      <Label>Reason</Label>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {REASONS.map((r) => (
          <Pill key={r} active={reason === r} onClick={() => setReason(r)}>{r.charAt(0).toUpperCase() + r.slice(1)}</Pill>
        ))}
      </div>

      <Label>Change</Label>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {STEPS.map((s) => (
          <button
            key={s}
            onClick={() => setDelta((d) => d + s)}
            style={{
              padding: '8px 14px', borderRadius: 9, fontWeight: 600, fontSize: 13, cursor: 'pointer',
              border: '1px solid var(--border)',
              background: s < 0 ? 'var(--flag-tint)' : 'var(--confident-tint)',
              color: s < 0 ? 'var(--flag)' : 'var(--confident)',
            }}
          >
            {s > 0 ? `+${s}` : s}
          </button>
        ))}
        <button onClick={() => setDelta(0)} style={{ padding: '8px 12px', borderRadius: 9, border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--muted)', fontSize: 13 }}>Reset</button>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 12px', borderRadius: 10, background: 'var(--surface)', fontSize: 13.5, marginBottom: 18 }}>
        <span style={{ color: 'var(--muted)' }}>Change <b className="mono" style={{ color: delta < 0 ? 'var(--flag)' : 'var(--confident)' }}>{delta >= 0 ? '+' : ''}{delta}</b></span>
        <span>New on-hand <b className="mono">{nextQty} {item.unit}</b>{!preview.ok && <span style={{ color: 'var(--flag)' }}> (clamped)</span>}</span>
      </div>

      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button disabled={delta === 0 || adjust.isPending} onClick={apply}>Apply</Button>
      </div>
    </Modal>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <div className="eyebrow" style={{ color: 'var(--faint)', marginBottom: 8 }}>{children}</div>;
}

const inputStyle: React.CSSProperties = { width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border)', fontSize: 14 };
const errMsg = (e: unknown) => (e instanceof ApiError ? e.problem?.detail || e.message : 'Unexpected error');
