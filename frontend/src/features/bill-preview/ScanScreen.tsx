import { useRef, useState } from 'react';
import { useApp } from '../../app/app-context';
import { Card, Button } from '../../components/ui';
import { IconUpload, IconScan } from '../../lib/icons';

type Stage = 'idle' | 'processing' | 'error';

export function ScanScreen() {
  const { nav } = useApp();
  const [stage, setStage] = useState<Stage>('idle');
  const fileRef = useRef<HTMLInputElement>(null);

  const run = (outcome: 'review' | 'error') => {
    setStage('processing');
    setTimeout(() => {
      if (outcome === 'review') nav('review');
      else setStage('error');
    }, 2200);
  };

  // Real OCR extraction is design-ahead-of-API, so a chosen/dropped file runs the same
  // simulated processing → review flow as the sample bill.
  const onFile = (file?: File) => {
    if (file) run('review');
  };

  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>
      <div className="eyebrow" style={{ color: 'var(--faint)' }}>Step 1 of 2 · OCR proposes, you confirm</div>
      <h1 className="display" style={{ fontSize: 26, fontWeight: 700, margin: '6px 0 20px' }}>Scan a bill</h1>

      {stage === 'idle' && (
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
              <Button onClick={() => run('review')}><IconScan size={16} /> Use a sample bill</Button>
              <Button variant="ghost" onClick={() => fileRef.current?.click()}>Browse files</Button>
            </div>
            <button onClick={() => run('error')} style={{ display: 'block', margin: '16px auto 0', background: 'none', border: 'none', color: 'var(--faint)', fontSize: 12.5, textDecoration: 'underline' }}>
              Try a blurry photo → see the error flow
            </button>
          </Card>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginTop: 14 }}>
            {[
              ['Reads handwriting', 'Even the sabzi vendor’s scrawl'],
              ['Hindi & English', 'Mixed-script line items'],
              ['Learns per supplier', 'Aliases improve every scan'],
            ].map(([t, s]) => (
              <Card key={t} style={{ padding: 14, boxShadow: 'none' }}>
                <div style={{ fontWeight: 600, fontSize: 13.5 }}>{t}</div>
                <div style={{ fontSize: 12, color: 'var(--faint)' }}>{s}</div>
              </Card>
            ))}
          </div>
        </>
      )}

      {stage === 'processing' && (
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

      {stage === 'error' && (
        <Card style={{ padding: 32, borderColor: 'var(--flag)', background: 'var(--flag-tint)' }}>
          <div style={{ fontWeight: 700, fontSize: 17, color: 'var(--flag)' }} className="display">We couldn’t read this image</div>
          <p style={{ color: 'var(--muted)', fontSize: 14, margin: '8px 0 18px' }}>
            The photo was too blurry to extract line items. Try a clearer, well-lit shot, or enter the items by hand.
          </p>
          <div style={{ display: 'flex', gap: 10 }}>
            <Button onClick={() => setStage('idle')}>Re-upload a clearer photo</Button>
            <Button variant="ghost" onClick={() => nav('inventory')}>Enter manually</Button>
          </div>
        </Card>
      )}
    </div>
  );
}
