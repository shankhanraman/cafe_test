import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useApp } from '../../app/app-context';
import { useListInventory, useAdjustStock } from '../../api/generated/inventory/inventory';
import type { InventoryResponse } from '../../api/generated/model/inventoryResponse';
import { isLowStock, previewAdjust } from './stock';
import { Card, Button, Badge, Pill, Modal } from '../../components/ui';
import { meta } from '../../lib/display';
import { IconPlus } from '../../lib/icons';

export function InventoryScreen() {
  const invQuery = useListInventory();
  const items = useMemo(() => invQuery.data?.data ?? [], [invQuery.data]);
  const [query, setQuery] = useState('');
  const [cat, setCat] = useState('All');
  const [adjustItem, setAdjustItem] = useState<InventoryResponse | null>(null);

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
        <Button><IconPlus size={16} /> Add item</Button>
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
                <Button variant="ghost" style={{ padding: '6px 12px' }} onClick={() => setAdjustItem(it)}>Adjust</Button>,
              ]}
            />
          );
        })}
      </Card>

      {adjustItem && <AdjustModal item={adjustItem} onClose={() => setAdjustItem(null)} />}
    </div>
  );
}

function Row({ cells, header }: { cells: React.ReactNode[]; header?: boolean }) {
  return (
    <div
      style={{
        display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 0.9fr 0.8fr', gap: 12, alignItems: 'center',
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
