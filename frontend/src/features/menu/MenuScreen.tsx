import { useMemo, useState } from 'react';
import { useApp } from '../../app/app-context';
import { useListMenu } from '../../api/generated/menu/menu';
import { useListInventory } from '../../api/generated/inventory/inventory';
import type { MenuResponse } from '../../api/generated/model/menuResponse';
import { Card, Button, Badge, Pill, Modal, money } from '../../components/ui';
import { meta, price } from '../../lib/display';
import { IconPlus, IconChevronRight } from '../../lib/icons';

export function MenuScreen() {
  const { nav } = useApp();
  const menuQuery = useListMenu();
  const menu = useMemo(() => menuQuery.data?.data ?? [], [menuQuery.data]);
  const inventory = useListInventory().data?.data ?? [];
  const [cat, setCat] = useState<'All' | MenuResponse['category']>('All');
  const [addOpen, setAddOpen] = useState(false);

  const cats = useMemo(() => ['All', ...new Set(menu.map((m) => m.category))] as const, [menu]);
  const filtered = cat === 'All' ? menu : menu.filter((m) => m.category === cat);
  const invName = (id?: string | null) => inventory.find((i) => i.id === id)?.name ?? '—';

  return (
    <div>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
        <h1 className="display" style={{ fontSize: 26, fontWeight: 700, margin: 0 }}>Menu &amp; recipes</h1>
        <Button onClick={() => setAddOpen(true)}><IconPlus size={16} /> Add menu item</Button>
      </header>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {cats.map((c) => (
          <Pill key={c} active={cat === c} onClick={() => setCat(c)}>{c === 'All' ? 'All' : pretty(c)}</Pill>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
        {filtered.map((m) => {
          const made = m.type === 'MADE';
          const ingredientCount = new Set((m.recipe ?? []).map((r) => r.inventoryItemId)).size;
          return (
            <Card key={m.id} style={{ padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <Badge tone={made ? 'confident' : 'resale'}>{made ? 'Made' : 'Resale'}</Badge>
                <span className="mono" style={{ fontWeight: 600 }}>{money(price(m.id))}</span>
              </div>
              <div className="display" style={{ fontWeight: 600, fontSize: 16 }}>{m.name}</div>
              <div className="dvn" style={{ fontSize: 12.5, color: 'var(--faint)' }}>{meta(m.id).hi}</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--divider)' }}>
                {made ? (
                  <>
                    <span style={{ fontSize: 13, color: 'var(--muted)' }}>{ingredientCount} ingredients</span>
                    <button onClick={() => nav('recipe', { menuId: m.id })} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', color: 'var(--pine-700)', fontWeight: 600, fontSize: 13 }}>
                      Edit recipe <IconChevronRight size={14} />
                    </button>
                  </>
                ) : (
                  <span style={{ fontSize: 13, color: 'var(--muted)' }}>1:1 · {invName(m.resaleItemId)}</span>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      {addOpen && <AddMenuModal onClose={() => setAddOpen(false)} />}
    </div>
  );
}

function AddMenuModal({ onClose }: { onClose: () => void }) {
  const [type, setType] = useState<'MADE' | 'RESALE'>('MADE');
  return (
    <Modal title="Add menu item" width={460} onClose={onClose}>
      <div className="eyebrow" style={{ color: 'var(--faint)', marginBottom: 8 }}>Type</div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <Pill active={type === 'MADE'} onClick={() => setType('MADE')}>Made to order</Pill>
        <Pill active={type === 'RESALE'} onClick={() => setType('RESALE')}>Resale</Pill>
      </div>
      <div style={{ padding: '10px 12px', borderRadius: 10, fontSize: 12.5, marginBottom: 16, background: type === 'MADE' ? 'var(--confident-tint)' : 'var(--resale-tint)', color: type === 'MADE' ? 'var(--confident)' : 'var(--resale)' }}>
        {type === 'MADE'
          ? 'A recipe is required — ingredient lines per order size (Less / Regular / Serving).'
          : 'Links 1:1 to one inventory item and is sold as-is. No order size.'}
      </div>
      {['Name', 'Hindi name', 'Category', 'Price'].map((f) => (
        <div key={f} style={{ marginBottom: 10 }}>
          <div className="eyebrow" style={{ color: 'var(--faint)', marginBottom: 6 }}>{f}</div>
          <input aria-label={f} style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border)', fontSize: 14 }} />
        </div>
      ))}
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button onClick={onClose}>Save &amp; continue</Button>
      </div>
    </Modal>
  );
}

const pretty = (c: string) => c.split('_').map((w) => w.charAt(0) + w.slice(1).toLowerCase()).join(' ');
