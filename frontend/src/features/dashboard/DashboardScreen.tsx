import { useApp } from '../../app/app-context';
import { useListLowStock } from '../../api/generated/inventory/inventory';
import { useListInventory } from '../../api/generated/inventory/inventory';
import { useListSales } from '../../api/generated/sales/sales';
import { Card, Button, money } from '../../components/ui';
import { meta, price } from '../../lib/display';
import { IconScan, IconSell, IconChevronRight } from '../../lib/icons';

export function DashboardScreen() {
  const { nav } = useApp();
  const low = useListLowStock().data?.data ?? [];
  const inventory = useListInventory().data?.data ?? [];
  const sales = useListSales().data?.data ?? [];

  const today = new Date().toISOString().slice(0, 10);
  const soldToday = sales.filter((s) => s.soldAt.slice(0, 10) === today);
  const revenueToday = soldToday.reduce((sum, s) => sum + price(s.menuItemId) * s.quantity, 0);

  return (
    <div>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 24 }}>
        <div>
          <div className="eyebrow" style={{ color: 'var(--faint)' }}>
            {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })} · Andheri West
          </div>
          <h1 className="display" style={{ fontSize: 28, fontWeight: 700, margin: '4px 0 0' }}>Good morning, Rhea</h1>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <Button variant="ghost" onClick={() => nav('scan')}><IconScan size={16} /> Scan a bill</Button>
          <Button onClick={() => nav('sell')}><IconSell size={16} /> Record a sale</Button>
        </div>
      </header>

      {/* Stat tiles */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 18 }}>
        <Stat label="Items tracked" value={String(inventory.length || 142)} />
        <Stat label="Low-stock alerts" value={String(low.length)} tone="var(--flag)" />
        <Stat label="Sold today" value={money(revenueToday)} sub={`${soldToday.length} sales`} tone="var(--confident)" />
        <Stat label="Spend this month" value={money(48200)} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 18 }}>
        {/* Needs reordering */}
        <Card style={{ padding: 0 }}>
          <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--divider)' }}>
            <div style={{ fontWeight: 700, fontSize: 16 }} className="display">Needs reordering</div>
            <div style={{ fontSize: 12.5, color: 'var(--faint)' }}>Items at or below their reorder point</div>
          </div>
          <div>
            {low.length === 0 && <div style={{ padding: 24, color: 'var(--faint)', fontSize: 14 }}>Everything is above its reorder point.</div>}
            {[...low]
              .sort((a, b) => a.quantityOnHand / a.reorderThreshold - b.quantityOnHand / b.reorderThreshold)
              .map((it) => {
                const ratio = it.reorderThreshold ? it.quantityOnHand / it.reorderThreshold : 0;
                const col = ratio <= 0.5 ? 'var(--flag)' : 'var(--review)';
                return (
                  <div key={it.id} style={{ display: 'grid', gridTemplateColumns: '1.6fr 0.7fr 0.7fr 1fr', gap: 12, alignItems: 'center', padding: '12px 20px', borderBottom: '1px solid var(--divider)' }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{it.name}</div>
                      <div className="dvn" style={{ fontSize: 12, color: 'var(--faint)' }}>{meta(it.id).hi}</div>
                    </div>
                    <div className="mono" style={{ color: col, fontWeight: 600 }}>{it.quantityOnHand}</div>
                    <div className="mono" style={{ color: 'var(--faint)' }}>{it.reorderThreshold}</div>
                    <div style={{ height: 6, borderRadius: 4, background: 'var(--divider)', overflow: 'hidden' }}>
                      <div style={{ width: `${Math.min(100, ratio * 100)}%`, height: '100%', background: col }} />
                    </div>
                  </div>
                );
              })}
          </div>
        </Card>

        {/* Right column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={{ borderRadius: 18, padding: 20, color: '#fff', background: 'linear-gradient(135deg, var(--pine-700), var(--pine-900))' }}>
            <div style={{ fontWeight: 700, fontSize: 17 }} className="display">Counter is busy?</div>
            <div style={{ fontSize: 13.5, color: '#BFD8CF', margin: '6px 0 14px' }}>Ring up a sale and let stock fall out automatically.</div>
            <Button variant="brass" onClick={() => nav('sell')}>Open the till <IconChevronRight size={16} /></Button>
          </div>

          <Card style={{ padding: 0 }}>
            <div style={{ padding: '16px 18px', borderBottom: '1px solid var(--divider)', fontWeight: 700 }} className="display">Recent sales</div>
            {sales.slice(0, 4).map((s) => {
              const m = menuTypeChar(s.menuItemId);
              return (
                <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 18px', borderBottom: '1px solid var(--divider)' }}>
                  <div style={{ width: 34, height: 34, borderRadius: 9, background: m.bg, color: m.fg, display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: 13 }}>{m.ch}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 13.5 }}>{s.menuItemName}</div>
                    <div style={{ fontSize: 12, color: 'var(--faint)' }}>×{s.quantity} {s.orderSize ? `${cap(s.orderSize)} · ` : ''}{time(s.soldAt)}</div>
                  </div>
                  <div className="mono" style={{ fontWeight: 600, fontSize: 13.5 }}>{money(price(s.menuItemId) * s.quantity)}</div>
                </div>
              );
            })}
          </Card>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: string }) {
  return (
    <Card style={{ padding: '16px 18px' }}>
      <div style={{ fontSize: 12.5, color: 'var(--muted)', fontWeight: 600 }}>{label}</div>
      <div className="display mono" style={{ fontSize: 26, fontWeight: 700, color: tone ?? 'var(--ink)', marginTop: 4 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: 'var(--faint)' }}>{sub}</div>}
    </Card>
  );
}

function menuTypeChar(menuId: string) {
  // 'M' for made, 'R' for resale — inferred from id naming in the demo seed.
  const resale = ['menu-cola', 'menu-chips', 'menu-cig'].includes(menuId);
  return resale
    ? { ch: 'R', fg: 'var(--resale)', bg: 'var(--resale-tint)' }
    : { ch: 'M', fg: 'var(--confident)', bg: 'var(--confident-tint)' };
}
const cap = (s: string) => s.charAt(0) + s.slice(1).toLowerCase();
const time = (iso: string) => new Date(iso).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
