import { useState } from 'react';
import { useApp } from '../../app/app-context';
import { useListMenu } from '../../api/generated/menu/menu';
import { useListInventory } from '../../api/generated/inventory/inventory';
import type { OrderSize } from '../../api/generated/model/orderSize';
import { Card, Button, money } from '../../components/ui';
import { meta, price } from '../../lib/display';
import { IconArrowLeft, IconPlus } from '../../lib/icons';

const SIZES: OrderSize[] = ['LESS', 'REGULAR', 'SERVING'];

export function RecipeEditorScreen() {
  const { nav, params } = useApp();
  const menu = (useListMenu().data?.data ?? []).filter((m) => m.type === 'MADE');
  const inventory = useListInventory().data?.data ?? [];
  const [selId, setSelId] = useState<string>((params.menuId as string) || menu[0]?.id || '');
  const [size, setSize] = useState<OrderSize>('REGULAR');

  const sel = menu.find((m) => m.id === selId) ?? menu[0];
  const invOf = (id: string) => inventory.find((i) => i.id === id);
  const lines = (sel?.recipe ?? []).filter((l) => l.orderSize === size);

  return (
    <div style={{ maxWidth: 1080, margin: '0 auto' }}>
      <button onClick={() => nav('menu')} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: 'var(--muted)', fontSize: 13, marginBottom: 10 }}>
        <IconArrowLeft size={15} /> Back to menu
      </button>

      <div style={{ display: 'grid', gridTemplateColumns: '248px 1fr', gap: 20, alignItems: 'start' }}>
        <Card style={{ padding: 8 }}>
          {menu.map((m) => (
            <button
              key={m.id}
              onClick={() => setSelId(m.id)}
              style={{
                display: 'block', width: '100%', textAlign: 'left', padding: '10px 12px', borderRadius: 10, marginBottom: 2,
                border: '1px solid', borderColor: m.id === sel?.id ? 'var(--pine-700)' : 'transparent',
                background: m.id === sel?.id ? 'var(--pine-tint)' : 'transparent', cursor: 'pointer',
              }}
            >
              <div style={{ fontWeight: 600, fontSize: 14 }}>{m.name}</div>
              <div className="dvn" style={{ fontSize: 12, color: 'var(--faint)' }}>{meta(m.id).hi}</div>
            </button>
          ))}
        </Card>

        {sel && (
          <Card style={{ padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div>
                <div className="display" style={{ fontWeight: 700, fontSize: 19 }}>{sel.name}</div>
                <div className="dvn" style={{ fontSize: 13, color: 'var(--faint)' }}>{meta(sel.id).hi} · {new Set((sel.recipe ?? []).map((r) => r.inventoryItemId)).size} ingredients</div>
              </div>
              <span className="mono" style={{ fontWeight: 600 }}>{money(price(sel.id))}</span>
            </div>

            <div style={{ display: 'flex', gap: 4, background: 'var(--divider)', borderRadius: 9, padding: 3, width: 'fit-content', marginBottom: 8 }}>
              {SIZES.map((s) => (
                <button
                  key={s}
                  onClick={() => setSize(s)}
                  style={{ padding: '6px 18px', borderRadius: 7, border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer', background: size === s ? 'var(--card)' : 'transparent', color: size === s ? 'var(--pine-700)' : 'var(--muted)', boxShadow: size === s ? 'var(--shadow-card)' : 'none' }}
                >
                  {s.charAt(0) + s.slice(1).toLowerCase()}
                </button>
              ))}
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--faint)', marginBottom: 14 }}>Selling one {size.toLowerCase()} deducts each of these from stock.</div>

            <div style={{ border: '1px solid var(--divider)', borderRadius: 12, overflow: 'hidden' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 12, padding: '10px 14px', background: 'var(--surface)', fontSize: 12, color: 'var(--faint)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                <div>Ingredient</div><div>Per order</div><div>Available</div>
              </div>
              {lines.length === 0 && <div style={{ padding: 16, color: 'var(--faint)', fontSize: 13.5 }}>No ingredients for this size yet.</div>}
              {lines.map((l, i) => {
                const it = invOf(l.inventoryItemId);
                return (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 12, padding: '11px 14px', borderTop: '1px solid var(--divider)', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13.5 }}>{it?.name ?? l.inventoryItemId}</div>
                      <div className="dvn" style={{ fontSize: 12, color: 'var(--faint)' }}>{meta(l.inventoryItemId).hi}</div>
                    </div>
                    <div className="mono" style={{ fontSize: 13.5 }}>{l.quantity} {it?.unit}</div>
                    <div className="mono" style={{ fontSize: 13.5, color: 'var(--muted)' }}>{it?.quantityOnHand ?? '—'}</div>
                  </div>
                );
              })}
            </div>
            <Button variant="ghost" style={{ marginTop: 14 }}><IconPlus size={15} /> Add ingredient</Button>
          </Card>
        )}
      </div>
    </div>
  );
}
