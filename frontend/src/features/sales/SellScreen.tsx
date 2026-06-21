import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useApp } from '../../app/app-context';
import { useListMenu } from '../../api/generated/menu/menu';
import { useRecordSale } from '../../api/generated/sales/sales';
import type { MenuResponse } from '../../api/generated/model/menuResponse';
import type { OrderSize } from '../../api/generated/model/orderSize';
import { canRecordSale, type SaleDraft } from './sale-validation';
import { Card, Button, Badge, Pill, money } from '../../components/ui';
import { meta, price } from '../../lib/display';
import { IconSell, IconPlus, IconMinus, IconX, IconCheck } from '../../lib/icons';

interface Line {
  menuId: string;
  name: string;
  type: MenuResponse['type'];
  resaleItemId: string | null;
  size: OrderSize | null;
  qty: number;
  price: number;
}

const CATS: { key: string; label: string; cats: MenuResponse['category'][] }[] = [
  { key: 'all', label: 'All', cats: [] },
  { key: 'hot', label: 'Hot drinks', cats: ['TEA_COFFEE'] },
  { key: 'shakes', label: 'Shakes', cats: ['MILK_SHAKES'] },
  { key: 'coolers', label: 'Coolers', cats: ['JUICES', 'COLD_DRINKS'] },
  { key: 'packaged', label: 'Packaged', cats: ['SNACKS', 'CIGARETTES', 'KULHAD'] },
];

export function SellScreen() {
  const { showToast } = useApp();
  const qc = useQueryClient();
  const menuQuery = useListMenu();
  const menu = useMemo(() => menuQuery.data?.data ?? [], [menuQuery.data]);
  const recordSale = useRecordSale();
  const [cat, setCat] = useState('all');
  const [ticket, setTicket] = useState<Line[]>([]);

  const filtered = useMemo(() => {
    const set = CATS.find((c) => c.key === cat)?.cats ?? [];
    return set.length ? menu.filter((m) => set.includes(m.category)) : menu;
  }, [menu, cat]);

  const add = (m: MenuResponse) => {
    setTicket((t) => {
      const existing = t.find((l) => l.menuId === m.id);
      if (existing) return t.map((l) => (l.menuId === m.id ? { ...l, qty: l.qty + 1 } : l));
      return [
        ...t,
        {
          menuId: m.id,
          name: m.name,
          type: m.type,
          resaleItemId: m.resaleItemId ?? null,
          size: m.type === 'MADE' ? 'REGULAR' : null,
          qty: 1,
          price: price(m.id),
        },
      ];
    });
  };
  const setQty = (id: string, d: number) =>
    setTicket((t) => t.map((l) => (l.menuId === id ? { ...l, qty: Math.max(1, l.qty + d) } : l)));
  const setSize = (id: string, size: OrderSize) =>
    setTicket((t) => t.map((l) => (l.menuId === id ? { ...l, size } : l)));
  const remove = (id: string) => setTicket((t) => t.filter((l) => l.menuId !== id));

  const total = ticket.reduce((s, l) => s + l.price * l.qty, 0);
  const itemCount = ticket.reduce((s, l) => s + l.qty, 0);

  const draftOf = (l: Line): SaleDraft => ({
    menuItem: { id: l.menuId, name: l.name, type: l.type, resaleItemId: l.resaleItemId },
    orderSize: l.size,
    quantity: l.qty,
  });
  const allValid = ticket.length > 0 && ticket.every((l) => canRecordSale(draftOf(l)));

  const record = async () => {
    for (const l of ticket) {
      await recordSale.mutateAsync({
        data: { menuItemId: l.menuId, orderSize: l.size, quantity: l.qty },
      });
    }
    await Promise.all([
      qc.invalidateQueries({ queryKey: ['/api/inventory'] }),
      qc.invalidateQueries({ queryKey: ['/api/inventory/low-stock'] }),
      qc.invalidateQueries({ queryKey: ['/api/sales'] }),
    ]);
    showToast({ title: 'Sale recorded · stock updated', sub: `${itemCount} items · ${money(total)}` });
    setTicket([]);
  };

  return (
    <div style={{ maxWidth: 1280, margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 362px', gap: 22, alignItems: 'start' }}>
      {/* Menu */}
      <div>
        <h1 className="display" style={{ fontSize: 26, fontWeight: 700, margin: '0 0 4px' }}>Sell</h1>
        <p style={{ color: 'var(--muted)', fontSize: 14, margin: '0 0 16px' }}>Tap items to build a ticket. Stock falls out when you record.</p>
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          {CATS.map((c) => (
            <Pill key={c.key} active={cat === c.key} onClick={() => setCat(c.key)}>{c.label}</Pill>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
          {filtered.map((m) => {
            const made = m.type === 'MADE';
            return (
              <button
                key={m.id}
                onClick={() => add(m)}
                style={{ textAlign: 'left', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, padding: 16, transition: 'border-color .15s, box-shadow .15s', cursor: 'pointer' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <Badge tone={made ? 'confident' : 'resale'}>{made ? 'Made' : 'Resale'}</Badge>
                  <span className="mono" style={{ fontWeight: 600 }}>{money(price(m.id))}</span>
                </div>
                <div className="display" style={{ fontWeight: 600, fontSize: 16 }}>{m.name}</div>
                <div className="dvn" style={{ fontSize: 12.5, color: 'var(--faint)' }}>{meta(m.id).hi}</div>
                <div style={{ fontSize: 12, color: 'var(--faint)', marginTop: 8 }}>
                  {made ? `${m.recipe?.filter((r) => r.orderSize === 'REGULAR').length ?? 0} ingredients` : '1:1 · linked stock'}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Ticket */}
      <Card style={{ padding: 0, position: 'sticky', top: 90 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 18px', borderBottom: '1px solid var(--divider)' }}>
          <div style={{ fontWeight: 700 }} className="display">Current ticket</div>
          {itemCount > 0 && <Badge tone="pine">{itemCount}</Badge>}
        </div>

        {ticket.length === 0 ? (
          <div style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--faint)' }}>
            <IconSell size={28} />
            <div style={{ marginTop: 10, fontSize: 14 }}>No items yet</div>
          </div>
        ) : (
          <div style={{ maxHeight: 420, overflowY: 'auto' }}>
            {ticket.map((l) => (
              <div key={l.menuId} style={{ padding: '12px 18px', borderBottom: '1px solid var(--divider)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{l.name}</div>
                    <div className="dvn" style={{ fontSize: 12, color: 'var(--faint)' }}>{meta(l.menuId).hi}</div>
                  </div>
                  <button onClick={() => remove(l.menuId)} aria-label="Remove" style={{ background: 'none', border: 'none', color: 'var(--faint)' }}><IconX size={16} /></button>
                </div>
                {l.type === 'MADE' && (
                  <div style={{ display: 'flex', gap: 4, marginTop: 8, background: 'var(--divider)', borderRadius: 9, padding: 3 }}>
                    {(['LESS', 'REGULAR', 'SERVING'] as OrderSize[]).map((s) => (
                      <button
                        key={s}
                        onClick={() => setSize(l.menuId, s)}
                        style={{ flex: 1, padding: '5px 0', borderRadius: 7, border: 'none', fontSize: 12, fontWeight: 600, background: l.size === s ? 'var(--card)' : 'transparent', color: l.size === s ? 'var(--pine-700)' : 'var(--muted)', boxShadow: l.size === s ? 'var(--shadow-card)' : 'none' }}
                      >
                        {s.charAt(0) + s.slice(1).toLowerCase()}
                      </button>
                    ))}
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, border: '1px solid var(--border)', borderRadius: 9, padding: '3px 8px' }}>
                    <button onClick={() => setQty(l.menuId, -1)} aria-label="Decrease" style={stepBtn}><IconMinus size={14} /></button>
                    <span className="mono" style={{ minWidth: 16, textAlign: 'center', fontWeight: 600 }}>{l.qty}</span>
                    <button onClick={() => setQty(l.menuId, 1)} aria-label="Increase" style={stepBtn}><IconPlus size={14} /></button>
                  </div>
                  <span className="mono" style={{ fontWeight: 600 }}>{money(l.price * l.qty)}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        <div style={{ padding: 18, borderTop: '1px solid var(--divider)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13.5, color: 'var(--muted)', marginBottom: 4 }}>
            <span>Items</span><span className="mono">{itemCount}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14 }}>
            <span style={{ fontWeight: 700 }}>Total</span>
            <span className="display mono" style={{ fontSize: 20, fontWeight: 700 }}>{money(total)}</span>
          </div>
          <Button block disabled={!allValid || recordSale.isPending} onClick={record}>
            <IconCheck size={16} /> Record sale &amp; deplete stock
          </Button>
          {ticket.length > 0 && (
            <button onClick={() => setTicket([])} style={{ width: '100%', marginTop: 8, background: 'none', border: 'none', color: 'var(--faint)', fontSize: 13 }}>
              Clear ticket
            </button>
          )}
        </div>
      </Card>
    </div>
  );
}

const stepBtn: React.CSSProperties = { background: 'none', border: 'none', color: 'var(--muted)', display: 'grid', placeItems: 'center', padding: 2 };
