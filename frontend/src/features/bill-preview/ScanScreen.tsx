import { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useApp } from '../../app/app-context';
import { useScanReceipt } from '../../api/generated/receiving/receiving';
import { ApiError } from '../../api/http-client';
import { Card, Button } from '../../components/ui';
import { IconUpload, IconScan } from '../../lib/icons';

// Scan-and-apply: a chosen/dropped bill is uploaded to POST /api/receiving/scan, which OCR-reads
// it, matches lines to inventory, and applies matched lines to stock server-side in one call.
// The result (per-line outcomes) is shown on the review screen — there is no separate confirm
// step because the backend already applied the matched lines.
export function ScanScreen() {
  const { nav, showToast } = useApp();
  const qc = useQueryClient();
  const scan = useScanReceipt();
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const onFile = async (file?: File) => {
    if (!file) return;
    setError(null);
    try {
      const res = await scan.mutateAsync({ data: { file, engine: 'auto' } });
      if (res.status !== 200) return; // non-2xx already throws ApiError; this narrows the union
      // Matched lines changed stock server-side — refresh the inventory views.
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['/api/inventory'] }),
        qc.invalidateQueries({ queryKey: ['/api/inventory/low-stock'] }),
      ]);
      const receipt = res.data;
      showToast({
        title: 'Bill scanned',
        sub: `${receipt.applied} applied · ${receipt.needsReview} to review · ${receipt.unmatched} unmatched`,
      });
      nav('review', { receipt });
    } catch (e) {
      setError(e instanceof ApiError ? e.problem?.detail || e.message : 'We couldn’t read this image.');
    }
  };

  const processing = scan.isPending;

  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>
      <div className="eyebrow" style={{ color: 'var(--faint)' }}>Scan a supplier bill · matched lines are added to stock</div>
      <h1 className="display" style={{ fontSize: 26, fontWeight: 700, margin: '6px 0 20px' }}>Scan a bill</h1>

      {!processing && !error && (
        <>
          <Card
            style={{ padding: 36, border: '2px dashed var(--border-2)', textAlign: 'center', boxShadow: 'none' }}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              onFile(e.dataTransfer.files?.[0]);
            }}
          >
            <input
              ref={fileRef}
              type="file"
              accept="image/*,application/pdf"
              hidden
              onChange={(e) => onFile(e.target.files?.[0] ?? undefined)}
            />
            <div style={{ width: 56, height: 56, borderRadius: 14, background: 'var(--pine-tint)', color: 'var(--pine-700)', display: 'grid', placeItems: 'center', margin: '0 auto 14px' }}>
              <IconUpload size={26} />
            </div>
            <div style={{ fontWeight: 600, fontSize: 16 }}>Drop the bill photo or PDF here</div>
            <div style={{ color: 'var(--faint)', fontSize: 13.5, margin: '6px 0 18px' }}>Handwritten or printed, Hindi or English — we read it.</div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <Button onClick={() => fileRef.current?.click()}><IconScan size={16} /> Choose a bill to scan</Button>
            </div>
          </Card>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginTop: 14 }}>
            {[
              ['Reads handwriting', 'Even the sabzi vendor’s scrawl'],
              ['Hindi & English', 'Mixed-script line items'],
              ['Applies to stock', 'Matched lines update inventory'],
            ].map(([t, s]) => (
              <Card key={t} style={{ padding: 14, boxShadow: 'none' }}>
                <div style={{ fontWeight: 600, fontSize: 13.5 }}>{t}</div>
                <div style={{ fontSize: 12, color: 'var(--faint)' }}>{s}</div>
              </Card>
            ))}
          </div>
        </>
      )}

      {processing && (
        <Card style={{ padding: 40, display: 'grid', placeItems: 'center', gap: 18 }}>
          <div style={{ position: 'relative', width: 230, height: 300, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', padding: 18 }}>
            {Array.from({ length: 9 }).map((_, i) => (
              <div key={i} className="mono" style={{ height: 9, borderRadius: 3, background: 'var(--divider)', margin: '0 0 14px', width: `${60 + ((i * 13) % 38)}%` }} />
            ))}
            <div style={{ position: 'absolute', left: 0, right: 0, height: 2, background: 'var(--confident)', boxShadow: '0 0 12px var(--confident)', animation: 'scanline 1.6s ease-in-out infinite' }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--muted)' }}>
            <span style={{ width: 18, height: 18, border: '2px solid var(--border)', borderTopColor: 'var(--pine-700)', borderRadius: '50%', animation: 'spin .8s linear infinite' }} />
            Reading line items…
          </div>
        </Card>
      )}

      {error && !processing && (
        <Card style={{ padding: 32, borderColor: 'var(--flag)', background: 'var(--flag-tint)' }}>
          <div style={{ fontWeight: 700, fontSize: 17, color: 'var(--flag)' }} className="display">We couldn’t process this bill</div>
          <p style={{ color: 'var(--muted)', fontSize: 14, margin: '8px 0 18px' }}>{error}</p>
          <div style={{ display: 'flex', gap: 10 }}>
            <Button onClick={() => setError(null)}>Try another photo</Button>
            <Button variant="ghost" onClick={() => nav('inventory')}>Enter manually</Button>
          </div>
        </Card>
      )}
    </div>
  );
}
