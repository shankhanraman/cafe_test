import { useApp } from '../../app/app-context';
import { useListInventory } from '../../api/generated/inventory/inventory';
import type { ScanReceiptResponse } from '../../api/generated/model/scanReceiptResponse';
import type { ReceiptLineResult } from '../../api/generated/model/receiptLineResult';
import type { LineStatus } from '../../api/generated/model/lineStatus';
import { Card, Button, Badge } from '../../components/ui';
import { IconArrowLeft, IconCheck } from '../../lib/icons';

const LINE_TONE: Record<LineStatus, 'confident' | 'review' | 'flag'> = {
  APPLIED: 'confident',
  NEEDS_REVIEW: 'review',
  UNMATCHED_ITEM: 'flag',
};
const LINE_LABEL: Record<LineStatus, string> = {
  APPLIED: 'Applied',
  NEEDS_REVIEW: 'Needs review',
  UNMATCHED_ITEM: 'No match',
};
const railColor = (s: LineStatus) =>
  s === 'APPLIED' ? 'var(--confident)' : s === 'NEEDS_REVIEW' ? 'var(--review)' : 'var(--flag)';

export function ReviewScreen() {
  const { nav, params } = useApp();
  const receipt = params.receipt as ScanReceiptResponse | undefined;
  const inventory = useListInventory().data?.data ?? [];
  const itemName = (id?: string | null) => inventory.find((i) => i.id === id)?.name;

  if (!receipt) {
    return (
      <div style={{ maxWidth: 720, margin: '40px auto', textAlign: 'center' }}>
        <h1 className="display" style={{ fontSize: 24, fontWeight: 700 }}>No scan to show</h1>
        <p style={{ color: 'var(--muted)', fontSize: 14 }}>Scan a supplier bill to see the extracted lines and what was applied to stock.</p>
        <Button onClick={() => nav('scan')}>Scan a bill</Button>
      </div>
    );
  }

  const lines = receipt.lines ?? [];

  return (
    <div style={{ maxWidth: 1280, margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 328px', gap: 22, alignItems: 'start' }}>
      <div>
        <button onClick={() => nav('scan')} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: 'var(--muted)', fontSize: 13, marginBottom: 8 }}>
          <IconArrowLeft size={15} /> Scan another
        </button>
        <h1 className="display" style={{ fontSize: 26, fontWeight: 700, margin: '0 0 4px' }}>Scan result</h1>
        <p style={{ color: 'var(--muted)', fontSize: 14, margin: '0 0 16px' }}>
          Matched lines were applied to stock. Lines that need review or have no match were not applied — resolve them in Inventory.
        </p>
        <div style={{ display: 'flex', gap: 16, marginBottom: 16, fontSize: 12.5 }}>
          <Legend tone="confident" label="Applied to stock" />
          <Legend tone="review" label="Needs review" />
          <Legend tone="flag" label="No match" />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {lines.map((l, i) => (
            <LineRow key={i} line={l} matchedName={itemName(l.matchedItemId)} />
          ))}
          {lines.length === 0 && (
            <Card style={{ padding: 20, color: 'var(--faint)', fontSize: 14 }}>No line items were extracted from this bill.</Card>
          )}
        </div>
      </div>

      {/* Summary */}
      <Card style={{ padding: 18, position: 'sticky', top: 90 }}>
        <div style={{ fontWeight: 700, fontSize: 15, paddingBottom: 12, borderBottom: '1px solid var(--divider)' }} className="display">
          Receipt summary
        </div>
        <div style={{ padding: '12px 0' }}>
          <Badge tone={receipt.status === 'APPLIED' ? 'confident' : receipt.status === 'PARTIAL' ? 'review' : 'flag'}>
            {receipt.status === 'APPLIED' ? 'Fully applied' : receipt.status === 'PARTIAL' ? 'Partially applied' : 'Supplier not matched'}
          </Badge>
        </div>
        <SummaryRow label="Lines on bill" value={String(lines.length)} />
        <SummaryRow label="Applied to stock" value={String(receipt.applied)} tone="confident" />
        <SummaryRow label="Needs review" value={String(receipt.needsReview)} tone="review" />
        <SummaryRow label="No match" value={String(receipt.unmatched)} tone="flag" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 16 }}>
          <Button block onClick={() => nav('dashboard')}><IconCheck size={16} /> Done</Button>
          {(receipt.needsReview > 0 || receipt.unmatched > 0) && (
            <Button block variant="ghost" onClick={() => nav('inventory')}>Resolve in Inventory</Button>
          )}
        </div>
      </Card>
    </div>
  );
}

function LineRow({ line, matchedName }: { line: ReceiptLineResult; matchedName?: string }) {
  return (
    <Card style={{ padding: 0, display: 'flex', overflow: 'hidden' }}>
      <div style={{ width: 5, background: railColor(line.lineStatus), flexShrink: 0 }} />
      <div style={{ padding: 16, flex: 1 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1.7fr 0.8fr 0.8fr', gap: 12, alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Badge tone={LINE_TONE[line.lineStatus]}>
              {line.lineStatus === 'APPLIED' && <IconCheck size={12} />} {LINE_LABEL[line.lineStatus]}
            </Badge>
            <div>
              <div className="dvn" style={{ fontWeight: 600, fontSize: 14 }}>{line.description}</div>
              {matchedName && <div style={{ fontSize: 12, color: 'var(--faint)' }}>→ {matchedName}</div>}
            </div>
          </div>
          <div className="mono" style={{ fontSize: 13.5 }}>
            {line.scannedQuantity ?? '—'} <span style={{ color: 'var(--faint)' }}>{line.scannedUnit ?? ''}</span>
          </div>
          <div className="mono" style={{ fontSize: 13.5, color: line.lineStatus === 'APPLIED' ? 'var(--confident)' : 'var(--faint)' }}>
            {line.appliedQuantity != null ? `+${line.appliedQuantity}` : '—'}
          </div>
        </div>
        {line.note && (
          <div style={{ borderTop: '1px solid var(--divider)', marginTop: 12, paddingTop: 10, fontSize: 12.5, color: 'var(--muted)' }}>{line.note}</div>
        )}
      </div>
    </Card>
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
function SummaryRow({ label, value, tone }: { label: string; value: string; tone?: 'confident' | 'review' | 'flag' }) {
  const color = tone === 'confident' ? 'var(--confident)' : tone === 'review' ? 'var(--review)' : tone === 'flag' ? 'var(--flag)' : 'var(--ink)';
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', fontSize: 13.5 }}>
      <span style={{ color: 'var(--muted)' }}>{label}</span>
      <span className="mono" style={{ fontWeight: 600, color }}>{value}</span>
    </div>
  );
}
