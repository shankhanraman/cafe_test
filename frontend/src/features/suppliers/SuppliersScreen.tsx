import { useState } from 'react';
import { useListSuppliers } from '../../api/generated/suppliers/suppliers';
import { Card, Button, Avatar, money } from '../../components/ui';
import { IconPlus } from '../../lib/icons';

// Learned aliases + purchase history are part of the OCR flow (design-ahead-of-API); shown
// here from demo data per the handoff until those endpoints exist.
const ALIASES: Record<string, [string, string][]> = {
  'sup-greenleaf': [['Tamatar', 'Tomatoes'], ['Adrak', 'Ginger'], ['Tamaatar', 'Tomatoes'], ['Hari mirch', 'Green chilli'], ['Pyaaz', 'Onion']],
  'sup-acme': [['Dudh', 'Milk'], ['Doodh', 'Milk']],
  'sup-kirana': [['Chini', 'Sugar sachet'], ['Elaichi', 'Cardamom']],
};
const HISTORY: Record<string, { date: string; items: number; total: number }[]> = {
  'sup-greenleaf': [{ date: '21 Jun', items: 8, total: 1320 }, { date: '18 Jun', items: 6, total: 940 }],
  'sup-acme': [{ date: '21 Jun', items: 2, total: 640 }, { date: '20 Jun', items: 2, total: 640 }],
  'sup-kirana': [{ date: '17 Jun', items: 11, total: 2180 }],
};

export function SuppliersScreen() {
  const suppliers = useListSuppliers().data?.data ?? [];
  const [selId, setSelId] = useState<string>('');
  const sel = suppliers.find((s) => s.id === selId) ?? suppliers[0];

  return (
    <div>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
        <h1 className="display" style={{ fontSize: 26, fontWeight: 700, margin: 0 }}>Suppliers</h1>
        <Button><IconPlus size={16} /> Add supplier</Button>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: '330px 1fr', gap: 20, alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {suppliers.map((s) => {
            const hist = HISTORY[s.id] ?? [];
            const spend = hist.reduce((sum, h) => sum + h.total, 0);
            return (
              <button
                key={s.id}
                onClick={() => setSelId(s.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left', padding: 14, borderRadius: 14, cursor: 'pointer',
                  background: 'var(--card)', border: '1px solid', borderColor: s.id === sel?.id ? 'var(--pine-700)' : 'var(--border)',
                  boxShadow: s.id === sel?.id ? 'none' : 'var(--shadow-card)',
                  outline: s.id === sel?.id ? '1px solid var(--pine-700)' : 'none',
                }}
              >
                <Avatar label={initials(s.name)} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{s.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--faint)' }}>{(ALIASES[s.id] ?? []).length} aliases · {(HISTORY[s.id] ?? []).length} bills</div>
                </div>
                <span className="mono" style={{ fontSize: 13, fontWeight: 600 }}>{money(spend)}</span>
              </button>
            );
          })}
        </div>

        {sel && (
          <Card style={{ padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, paddingBottom: 16, borderBottom: '1px solid var(--divider)' }}>
              <Avatar label={initials(sel.name)} />
              <div>
                <div className="display" style={{ fontWeight: 700, fontSize: 18 }}>{sel.name}</div>
                <div style={{ fontSize: 13, color: 'var(--faint)' }}>{sel.phone ?? 'No phone'} · {sel.notes || 'Supplier'}</div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, paddingTop: 16 }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>Learned aliases</div>
                  <button style={{ background: 'none', border: 'none', color: 'var(--pine-700)', fontSize: 12.5, fontWeight: 600 }}>Add manually</button>
                </div>
                {(ALIASES[sel.id] ?? []).map(([from, to]) => (
                  <div key={from} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 0', fontSize: 13.5, borderBottom: '1px solid var(--divider)' }}>
                    <span className="dvn" style={{ color: 'var(--muted)' }}>{from}</span>
                    <span style={{ color: 'var(--faint)' }}>→</span>
                    <span style={{ fontWeight: 600 }}>{to}</span>
                  </div>
                ))}
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10 }}>Purchase history</div>
                {(HISTORY[sel.id] ?? []).map((h, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', fontSize: 13.5, borderBottom: '1px solid var(--divider)' }}>
                    <span style={{ color: 'var(--muted)' }}>{h.date}</span>
                    <span style={{ color: 'var(--faint)' }}>{h.items} items</span>
                    <span className="mono" style={{ fontWeight: 600 }}>{money(h.total)}</span>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

const initials = (name: string) => name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase();
