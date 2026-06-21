import { useListSales } from '../../api/generated/sales/sales';
import { useListMenu } from '../../api/generated/menu/menu';
import { useListInventory } from '../../api/generated/inventory/inventory';
import { Card, Badge, money } from '../../components/ui';
import { price } from '../../lib/display';

export function SalesHistoryScreen() {
  const sales = useListSales().data?.data ?? [];
  const menu = useListMenu().data?.data ?? [];
  const inventory = useListInventory().data?.data ?? [];

  const invName = (id: string) => inventory.find((i) => i.id === id)?.name ?? id;
  const depletedNames = (menuId: string, size?: string | null) => {
    const m = menu.find((x) => x.id === menuId);
    if (!m) return '—';
    if (m.type === 'RESALE') return m.resaleItemId ? invName(m.resaleItemId) : '—';
    const lines = (m.recipe ?? []).filter((l) => l.orderSize === size);
    return lines.map((l) => invName(l.inventoryItemId)).join(', ') || '—';
  };

  const today = new Date().toISOString().slice(0, 10);
  const todays = sales.filter((s) => s.soldAt.slice(0, 10) === today);
  const revenue = todays.reduce((sum, s) => sum + price(s.menuItemId) * s.quantity, 0);

  return (
    <div>
      <h1 className="display" style={{ fontSize: 26, fontWeight: 700, margin: '0 0 18px' }}>Sales history</h1>

      <div style={{ display: 'flex', gap: 16, marginBottom: 18 }}>
        <Card style={{ padding: '14px 18px', flex: '0 0 200px' }}>
          <div style={{ fontSize: 12.5, color: 'var(--muted)', fontWeight: 600 }}>Sales today</div>
          <div className="display mono" style={{ fontSize: 24, fontWeight: 700, color: 'var(--confident)' }}>{todays.length}</div>
        </Card>
        <Card style={{ padding: '14px 18px', flex: '0 0 200px' }}>
          <div style={{ fontSize: 12.5, color: 'var(--muted)', fontWeight: 600 }}>Revenue today</div>
          <div className="display mono" style={{ fontSize: 24, fontWeight: 700, color: 'var(--confident)' }}>{money(revenue)}</div>
        </Card>
      </div>

      <Card style={{ padding: 0, overflow: 'hidden' }}>
        <Row header cells={['Time', 'Item', 'Size', 'Qty', 'Depleted from stock', 'Amount']} />
        {sales.map((s) => {
          const m = menu.find((x) => x.id === s.menuItemId);
          const resale = m?.type === 'RESALE';
          return (
            <Row
              key={s.id}
              cells={[
                <span className="mono" style={{ color: 'var(--muted)' }}>{new Date(s.soldAt).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}</span>,
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  <Badge tone={resale ? 'resale' : 'confident'}>{resale ? 'R' : 'M'}</Badge>
                  <b style={{ fontWeight: 600 }}>{s.menuItemName}</b>
                </span>,
                <span style={{ color: 'var(--muted)' }}>{s.orderSize ? cap(s.orderSize) : '—'}</span>,
                <span className="mono">×{s.quantity}</span>,
                <span style={{ fontSize: 13, color: 'var(--faint)' }}>{depletedNames(s.menuItemId, s.orderSize)}</span>,
                <span className="mono" style={{ fontWeight: 600 }}>{money(price(s.menuItemId) * s.quantity)}</span>,
              ]}
            />
          );
        })}
      </Card>
    </div>
  );
}

function Row({ cells, header }: { cells: React.ReactNode[]; header?: boolean }) {
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '0.8fr 1.6fr 0.8fr 0.6fr 2fr 0.9fr', gap: 12, alignItems: 'center',
      padding: '12px 18px', borderBottom: '1px solid var(--divider)',
      fontSize: header ? 12 : 14, color: header ? 'var(--faint)' : 'var(--ink)',
      fontWeight: header ? 600 : 400, textTransform: header ? 'uppercase' : 'none', letterSpacing: header ? '0.04em' : 0,
    }}>
      {cells.map((c, i) => <div key={i}>{c}</div>)}
    </div>
  );
}
const cap = (s: string) => s.charAt(0) + s.slice(1).toLowerCase();
