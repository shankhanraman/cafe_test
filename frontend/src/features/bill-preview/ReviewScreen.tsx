import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useApp } from '../../app/app-context';
import { useAdjustStock } from '../../api/generated/inventory/inventory';
import {
  isRowResolved, isConfirmEnabled, unresolvedCount, type PreviewRow,
} from './state';
import { Card, Button, Badge, Avatar, money } from '../../components/ui';
import { IconArrowLeft, IconCheck } from '../../lib/icons';

interface Row extends PreviewRow {
  ocr: string;
  price: number;
  suggestions: { itemId: string; name: string }[];
  resolvedName?: string;
}

const SEED: Row[] = [
  {
    lineId: 'r1', ocr: 'DUDH  4000 ml  240', rawName: 'दूध', matchState: 'confident',
    quantity: 4000, unit: 'ml', resolvedItemId: 'inv-milk', resolvedName: 'Milk', skipped: false, newItemDraft: null,
    price: 240, suggestions: [{ itemId: 'inv-milk', name: 'Milk' }],
  },
  {
    lineId: 'r2', ocr: 'CARDAMOM  2 box  180', rawName: 'इलायची', matchState: 'confident',
    quantity: 100, unit: 'sachet', resolvedItemId: 'inv-cardamom', resolvedName: 'Cardamom', skipped: false, newItemDraft: null,
    price: 180, suggestions: [{ itemId: 'inv-cardamom', name: 'Cardamom' }],
  },
  {
    lineId: 'r3', ocr: 'TAMATAR  12 kg  480', rawName: 'टमाटर', matchState: 'needs_review',
    quantity: 36, unit: 'piece', resolvedItemId: null, skipped: false, newItemDraft: null,
    price: 480, suggestions: [{ itemId: 'inv-tomato', name: 'Tomatoes' }, { itemId: 'inv-ginger', name: 'Ginger' }],
  },
  {
    lineId: 'r4', ocr: 'ADRAK  2 kg  120', rawName: 'अदरक', matchState: 'needs_review',
    quantity: 20, unit: 'piece', resolvedItemId: null, skipped: false, newItemDraft: null,
    price: 120, suggestions: [{ itemId: 'inv-ginger', name: 'Ginger' }, { itemId: 'inv-tomato', name: 'Tomatoes' }],
  },
  {
    lineId: 'r5', ocr: 'KULHAD  100 pc  200', rawName: 'कुल्हड़', matchState: 'new',
    quantity: 100, unit: 'piece', resolvedItemId: null, skipped: false, newItemDraft: null,
    price: 200, suggestions: [],
  },
];

const railColor = (r: Row) =>
  isRowResolved(r) ? 'var(--confident)' : r.matchState === 'new' ? 'var(--flag)' : 'var(--review)';

export function ReviewScreen() {
  const { nav, showToast } = useApp();
  const qc = useQueryClient();
  const adjust = useAdjustStock();
  const [rows, setRows] = useState<Row[]>(SEED);

  const update = (id: string, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r) => (r.lineId === id ? { ...r, ...patch } : r)));

  const pick = (id: string, s: { itemId: string; name: string }) =>
    update(id, { resolvedItemId: s.itemId, resolvedName: s.name });
  const addNew = (id: string) => {
    const r = rows.find((x) => x.lineId === id)!;
    update(id, { newItemDraft: { name: r.rawName || 'New item', unit: 'PIECE', reorderThreshold: 20 }, resolvedName: 'New item' });
  };
  const skip = (id: string) => update(id, { skipped: true });

  const resolved = rows.filter(isRowResolved).length;
  const unresolved = unresolvedCount(rows);
  const ready = isConfirmEnabled(rows);
  const billTotal = rows.reduce((s, r) => s + r.price, 0);

  const confirm = async () => {
    // Bills fill inventory: apply each resolved, non-skipped, matched row as a +delivery adjust.
    for (const r of rows) {
      if (!r.skipped && r.resolvedItemId && r.quantity) {
        await adjust.mutateAsync({ id: r.resolvedItemId, data: { delta: r.quantity, reason: 'delivery' } });
      }
    }
    const updated = rows.filter((r) => !r.skipped && r.resolvedItemId).length;
    const added = rows.filter((r) => !r.skipped && r.newItemDraft).length;
    await Promise.all([
      qc.invalidateQueries({ queryKey: ['/api/inventory'] }),
      qc.invalidateQueries({ queryKey: ['/api/inventory/low-stock'] }),
    ]);
    showToast({ title: 'Delivery confirmed · stock updated', sub: `${updated} updated · ${added} new · ${money(billTotal)}` });
    nav('dashboard');
  };

  return (
    <div style={{ maxWidth: 1280, margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 328px', gap: 22, alignItems: 'start' }}>
      <div>
        <button onClick={() => nav('scan')} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: 'var(--muted)', fontSize: 13, marginBottom: 8 }}>
          <IconArrowLeft size={15} /> Back to scan
        </button>
        <h1 className="display" style={{ fontSize: 26, fontWeight: 700, margin: '0 0 12px' }}>Review extracted lines</h1>
        <div style={{ display: 'flex', gap: 16, marginBottom: 16, fontSize: 12.5 }}>
          <Legend tone="confident" label="Confident" />
          <Legend tone="review" label="Needs review" />
          <Legend tone="flag" label="New item" />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {rows.map((r) => {
            const done = isRowResolved(r);
            return (
              <Card key={r.lineId} style={{ padding: 0, display: 'flex', overflow: 'hidden' }}>
                <div style={{ width: 5, background: railColor(r), flexShrink: 0 }} />
                <div style={{ padding: 16, flex: 1 }}>
                  <div className="mono" style={{ fontSize: 12, color: 'var(--faint)', marginBottom: 10 }}>OCR · {r.ocr}</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 0.7fr 0.7fr', gap: 12, alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      {r.skipped ? <Badge tone="muted">Skipped</Badge> : done ? <Badge tone="confident"><IconCheck size={12} /> {r.newItemDraft ? 'Added' : 'Matched'}</Badge> : <Badge tone={r.matchState === 'new' ? 'flag' : 'review'}>{r.matchState === 'new' ? 'New item' : 'Needs review'}</Badge>}
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 14, textDecoration: r.skipped ? 'line-through' : 'none', color: r.skipped ? 'var(--faint)' : 'var(--ink)' }}>
                          {r.resolvedName ?? r.suggestions[0]?.name ?? r.rawName}
                        </div>
                        <div className="dvn" style={{ fontSize: 12, color: 'var(--faint)' }}>{r.rawName}</div>
                      </div>
                    </div>
                    <div className="mono" style={{ fontSize: 13.5 }}>
                      +{r.quantity} <span style={{ color: 'var(--faint)' }}>{r.unit}</span>
                    </div>
                    <div className="mono" style={{ fontSize: 13.5 }}>{money(r.price)}</div>
                  </div>

                  {!done && !r.skipped && r.matchState === 'needs_review' && (
                    <div style={{ borderTop: '1px solid var(--divider)', marginTop: 12, paddingTop: 12 }}>
                      <div style={{ fontSize: 12.5, color: 'var(--muted)', marginBottom: 8 }}>Confirm the match:</div>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {r.suggestions.map((s) => (
                          <button key={s.itemId} onClick={() => pick(r.lineId, s)} style={chip}>{s.name}</button>
                        ))}
                      </div>
                    </div>
                  )}
                  {!done && !r.skipped && r.matchState === 'new' && (
                    <div style={{ borderTop: '1px solid var(--divider)', marginTop: 12, paddingTop: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 12.5, color: 'var(--muted)' }}>No catalog match.</span>
                      <Button onClick={() => addNew(r.lineId)} style={{ padding: '7px 12px' }}>Add as new item</Button>
                      <button onClick={() => skip(r.lineId)} style={{ background: 'none', border: 'none', color: 'var(--faint)', fontSize: 13 }}>Skip line</button>
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Summary */}
      <Card style={{ padding: 18, position: 'sticky', top: 90 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingBottom: 14, borderBottom: '1px solid var(--divider)' }}>
          <Avatar label="GL" />
          <div>
            <div style={{ fontWeight: 600, fontSize: 14 }}>Green Leaf Sabzi Mandi</div>
            <div style={{ fontSize: 12, color: 'var(--faint)' }}>5 learned aliases applied</div>
          </div>
        </div>
        <div style={{ padding: '14px 0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
            <span style={{ fontWeight: 600 }}>{resolved} of {rows.length} resolved</span>
            <span className="mono" style={{ color: 'var(--faint)' }}>{Math.round((resolved / rows.length) * 100)}%</span>
          </div>
          <div style={{ height: 7, borderRadius: 4, background: 'var(--divider)', overflow: 'hidden' }}>
            <div style={{ width: `${(resolved / rows.length) * 100}%`, height: '100%', background: 'var(--confident)', transition: 'width .25s' }} />
          </div>
        </div>
        <SummaryRow label="Lines on bill" value={String(rows.length)} />
        <SummaryRow label="Bill total" value={money(billTotal)} mono />
        <div
          style={{
            margin: '14px 0', padding: '10px 12px', borderRadius: 10, fontSize: 13, fontWeight: 600,
            background: ready ? 'var(--confident-tint)' : 'var(--review-tint)',
            color: ready ? 'var(--confident)' : 'var(--review)',
          }}
        >
          {ready ? 'All lines resolved — ready to confirm' : `${unresolved} line(s) still need a decision`}
        </div>
        <Button block disabled={!ready || adjust.isPending} onClick={confirm}>
          <IconCheck size={16} /> Confirm &amp; update stock
        </Button>
      </Card>
    </div>
  );
}

function Legend({ tone, label }: { tone: 'confident' | 'review' | 'flag'; label: string }) {
  const c = { confident: 'var(--confident)', review: 'var(--review)', flag: 'var(--flag)' }[tone];
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--muted)' }}>
      <span style={{ width: 9, height: 9, borderRadius: 3, background: c }} /> {label}
    </span>
  );
}
function SummaryRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', fontSize: 13.5 }}>
      <span style={{ color: 'var(--muted)' }}>{label}</span>
      <span className={mono ? 'mono' : undefined} style={{ fontWeight: 600 }}>{value}</span>
    </div>
  );
}
const chip: React.CSSProperties = {
  padding: '6px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--card)',
  fontSize: 13, fontWeight: 600, color: 'var(--pine-700)', cursor: 'pointer',
};
