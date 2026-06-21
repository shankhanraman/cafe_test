import { useState, type FormEvent } from 'react';
import { useApp } from '../../app/app-context';
import { Button } from '../../components/ui';

export function LoginScreen() {
  const { nav } = useApp();
  const [email, setEmail] = useState('rhea@arogyacafe.in');
  const [password, setPassword] = useState('demo-password');

  const submit = (e: FormEvent) => {
    e.preventDefault();
    nav('dashboard');
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {/* Left brand panel */}
      <div
        style={{
          flex: 1.1, background: 'var(--pine-900)', color: '#EAF3EF',
          padding: '56px 56px 48px', display: 'flex', flexDirection: 'column',
          position: 'relative', overflow: 'hidden',
        }}
      >
        <div
          style={{
            position: 'absolute', top: -120, right: -120, width: 380, height: 380, borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(184,144,46,0.35), transparent 65%)',
          }}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, position: 'relative' }}>
          <div className="dvn" style={{ width: 40, height: 40, borderRadius: 11, background: 'var(--brass)', color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: 21 }}>
            अ
          </div>
          <div style={{ fontWeight: 700, fontSize: 17, color: '#fff' }} className="display">
            Arogya Amrutalya
          </div>
        </div>

        <div style={{ margin: 'auto 0', position: 'relative' }}>
          <h1 className="display" style={{ fontSize: 39, lineHeight: 1.15, color: '#fff', fontWeight: 700, margin: 0 }}>
            Bills fill it.
            <br />
            Sales empty it.
            <br />
            Nobody retypes a thing.
          </h1>
          <p style={{ fontSize: 15, color: '#AFC9BF', maxWidth: 440, marginTop: 18, lineHeight: 1.6 }}>
            A back-office that keeps stock honest automatically — OCR reads supplier bills, sales
            deplete the recipe, and a human always confirms before anything is written.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 40, position: 'relative' }}>
          {[
            ['142', 'items tracked'],
            ['38', 'menu items'],
            ['0', 'paper registers'],
          ].map(([n, l]) => (
            <div key={l}>
              <div className="display mono" style={{ fontSize: 26, fontWeight: 700, color: '#fff' }}>{n}</div>
              <div style={{ fontSize: 12.5, color: '#7FA499' }}>{l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Right form */}
      <div style={{ flex: 1, display: 'grid', placeItems: 'center', padding: 24 }}>
        <form onSubmit={submit} style={{ width: 380, maxWidth: '100%' }}>
          <h2 className="display" style={{ fontSize: 26, fontWeight: 700, margin: '0 0 6px' }}>Welcome back</h2>
          <p style={{ color: 'var(--muted)', fontSize: 14, margin: '0 0 24px' }}>Sign in to the cafe back-office.</p>

          <Field label="Email">
            <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" style={inputStyle} />
          </Field>
          <div style={{ height: 14 }} />
          <Field label="Password" aside={<button type="button" style={{ fontSize: 12.5, background: 'none', border: 'none', color: 'var(--pine-700)', fontWeight: 600 }}>Forgot password?</button>}>
            <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" style={inputStyle} />
          </Field>

          <div style={{ height: 22 }} />
          <Button type="submit" block>Sign in</Button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '20px 0', color: 'var(--faint)', fontSize: 12.5 }}>
            <div style={{ flex: 1, height: 1, background: 'var(--border)' }} /> or <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          </div>
          <Button type="button" variant="ghost" block onClick={() => nav('dashboard')}>
            Continue with Google
          </Button>
        </form>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '11px 13px', borderRadius: 10, border: '1px solid var(--border)',
  background: 'var(--card)', fontSize: 14,
};

function Field({ label, aside, children }: { label: string; aside?: React.ReactNode; children: React.ReactNode }) {
  return (
    <label style={{ display: 'block' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 7 }}>
        <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--muted)' }}>{label}</span>
        {aside}
      </div>
      {children}
    </label>
  );
}
