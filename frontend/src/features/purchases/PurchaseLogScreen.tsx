import { useState } from 'react';
import { useApp } from '../../app/app-context';
import { Card, Button, Badge, Avatar, money } from '../../components/ui';
import { IconScan } from '../../lib/icons';

// The purchase log is the audit trail of confirmed OCR bills. Those endpoints are
// design-ahead-of-API (the bill-scanning contract isn't finalized), so this renders demo data.
interface Bill {
  id: string;
  supplier: string;
  date: string;
  time: string;
  total: number;
  lines: { name: string; hi: string; qty: string; cost: number }[];
}
const BILLS: Bill[] = [
  {
    id: 'b1', supplier: 'Green Leaf Sabzi Mandi', date: '21 Jun 2026', time: '8:05 AM', total: 1320,
    lines: [
      { name: 'Tomatoes', hi: 'टमाटर', qty: '12 kg', cost: 480 },
      { name: 'Ginger', hi: 'अदरक', qty: '2 kg', cost: 120 },
      { name: 'Milk', hi: 'दूध', qty: '4 L', cost: 240 },
      { name: 'Kulhad cups', hi: 'कुल्हड़', qty: '100 pc', cost: 200 },
      { name: 'Cardamom', hi: 'इलायची', qty: '2 box', cost: 280 },
    ],
  },
  {
    id: 'b2', supplier: 'Acme Dairy', date: '21 Jun 2026', time: '7:10 AM', total: 640,
    lines: [{ name: 'Milk', hi: 'दूध', qty: '8 L', cost: 480 }, { name: 'Curd', hi: 'दही', qty: '2 kg', cost: 160 }],
  },
  {
    id: 'b3', supplier: 'Sharma Kirana', date: '17 Jun 2026', time: '6:40 PM', total: 2180,
    lines: [{ name: 'Sugar sachet', hi: 'चीनी', qty: '200 pc', cost: 900 }, { name: 'Tea bags', hi: 'चाय पत्ती', qty: '300 pc', cost: 1280 }],
  },
];

export function PurchaseLogScreen() {
  const { nav } = useApp();
  const [selId, setSelId] = useState('b1');
  const sel = BILLS.find((b) => b.id === selId) ?? BILLS[0]!;

  return (
    <div>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
        <h1 className="display" style={{ fontSize: 26, fontWeight: 700, margin: 0 }}>Purchase log</h1>
        <Button onClick={() => nav('scan')}><IconScan size={16} /> Scan a bill</Button>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: '330px 1fr', gap: 20, alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {BILLS.map((b) => (
            <button
              key={b.id}
              onClick={() => setSelId(b.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left', padding: 14, borderRadius: 14, cursor: 'pointer',
                background: 'var(--card)', border: '1px solid', borderColor: b.id === sel.id ? 'var(--pine-700)' : 'var(--border)',
              }}
            >
              <Avatar label={b.supplier.split(' ').slice(0, 2).map((w) => w[0]).join('')} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{b.supplier}</div>
                <div style={{ fontSize: 12, color: 'var(--faint)' }}>{b.date} · {b.lines.length} items</div>
              </div>
              <span className="mono" style={{ fontSize: 13, fontWeight: 600 }}>{money(b.total)}</span>
            </button>
          ))}
        </div>

        <Card style={{ padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, paddingBottom: 16, borderBottom: '1px solid var(--divider)' }}>
            <Avatar label={sel.supplier.split(' ').slice(0, 2).map((w) => w[0]).join('')} />
            <div style={{ flex: 1 }}>
              <div className="display" style={{ fontWeight: 700, fontSize: 18 }}>{sel.supplier}</div>
              <div style={{ fontSize: 13, color: 'var(--faint)' }}>{sel.date} · {sel.time} · {sel.lines.length} items</div>
            </div>
            <Badge tone="confident">Confirmed</Badge>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 20, paddingTop: 16 }}>
            <div style={{ aspectRatio: '3 / 4', borderRadius: 12, background: 'var(--surface)', border: '1px solid var(--border)', display: 'grid', placeItems: 'center', color: 'var(--faint)', fontSize: 13, position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', inset: 14, display: 'flex', flexDirection: 'column', gap: 9 }}>
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} style={{ height: 7, borderRadius: 3, background: 'var(--divider-2)', width: `${55 + ((i * 11) % 40)}%` }} />
                ))}
              </div>
              <span style={{ position: 'relative', background: 'rgba(255,255,255,0.85)', padding: '4px 10px', borderRadius: 8, fontWeight: 600 }}>View image</span>
            </div>

            <div>
              <div style={{ border: '1px solid var(--divider)', borderRadius: 12, overflow: 'hidden' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 12, padding: '10px 14px', background: 'var(--surface)', fontSize: 12, color: 'var(--faint)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  <div>Item</div><div>Qty</div><div>Cost</div>
                </div>
                {sel.lines.map((l, i) => (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 12, padding: '11px 14px', borderTop: '1px solid var(--divider)', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13.5 }}>{l.name}</div>
                      <div className="dvn" style={{ fontSize: 12, color: 'var(--faint)' }}>{l.hi}</div>
                    </div>
                    <div className="mono" style={{ fontSize: 13.5 }}>{l.qty}</div>
                    <div className="mono" style={{ fontSize: 13.5 }}>{money(l.cost)}</div>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 14 }}>
                <span style={{ fontWeight: 700 }}>Bill total</span>
                <span className="display mono" style={{ fontSize: 20, fontWeight: 700 }}>{money(sel.total)}</span>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
