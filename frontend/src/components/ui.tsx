// Shared UI primitives, styled to the handoff tokens (inline styles, matching the prototype).
import type { CSSProperties, ReactNode, ButtonHTMLAttributes, HTMLAttributes } from 'react';
import { IconCheck, IconX } from '../lib/icons';

type Tone = 'confident' | 'review' | 'flag' | 'resale' | 'pine' | 'muted';
const toneColors: Record<Tone, { fg: string; bg: string }> = {
  confident: { fg: 'var(--confident)', bg: 'var(--confident-tint)' },
  review: { fg: 'var(--review)', bg: 'var(--review-tint)' },
  flag: { fg: 'var(--flag)', bg: 'var(--flag-tint)' },
  resale: { fg: 'var(--resale)', bg: 'var(--resale-tint)' },
  pine: { fg: 'var(--pine-700)', bg: 'var(--pine-tint)' },
  muted: { fg: 'var(--muted)', bg: 'var(--divider)' },
};

export function Badge({ tone = 'muted', children }: { tone?: Tone; children: ReactNode }) {
  const c = toneColors[tone];
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: '3px 9px',
        borderRadius: 7,
        background: c.bg,
        color: c.fg,
        fontSize: 12,
        fontWeight: 600,
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </span>
  );
}

export function Card({
  children,
  style,
  ...rest
}: { children: ReactNode } & HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...rest}
      style={{
        background: 'var(--card)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--r-card-lg)',
        boxShadow: 'var(--shadow-card)',
        ...style,
      }}
    >
      {children}
    </div>
  );
}

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'ghost' | 'brass' | 'danger';
  block?: boolean;
};
export function Button({ variant = 'primary', block, style, children, ...rest }: BtnProps) {
  const base: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: '10px 16px',
    borderRadius: 'var(--r-control)',
    fontSize: 14,
    fontWeight: 600,
    border: '1px solid transparent',
    transition: 'background .15s, border-color .15s, opacity .15s',
    width: block ? '100%' : undefined,
  };
  const variants: Record<string, CSSProperties> = {
    primary: { background: 'var(--pine-700)', color: '#fff' },
    brass: { background: 'var(--brass)', color: '#fff' },
    ghost: { background: 'var(--card)', color: 'var(--ink)', borderColor: 'var(--border)' },
    danger: { background: 'var(--flag)', color: '#fff' },
  };
  const disabledStyle: CSSProperties = rest.disabled
    ? { background: '#E9E6DD', color: '#9AA39B', cursor: 'not-allowed', borderColor: 'transparent' }
    : {};
  return (
    <button {...rest} style={{ ...base, ...variants[variant], ...disabledStyle, ...style }}>
      {children}
    </button>
  );
}

export function Pill({
  active,
  children,
  onClick,
}: {
  active?: boolean;
  children: ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '7px 14px',
        borderRadius: 9,
        fontSize: 13,
        fontWeight: 600,
        border: '1px solid',
        borderColor: active ? 'var(--pine-700)' : 'var(--border)',
        background: active ? 'var(--pine-tint)' : 'var(--card)',
        color: active ? 'var(--pine-700)' : 'var(--muted)',
      }}
    >
      {children}
    </button>
  );
}

/** Bilingual item label: English primary + Devanagari/category subline. */
export function ItemName({ name, hi, sub }: { name: string; hi?: string; sub?: string }) {
  return (
    <div style={{ lineHeight: 1.25 }}>
      <div style={{ fontWeight: 600, fontSize: 14.5 }}>{name}</div>
      {(hi || sub) && (
        <div style={{ fontSize: 12, color: 'var(--faint)' }}>
          {hi && <span className="dvn">{hi}</span>}
          {hi && sub && ' · '}
          {sub}
        </div>
      )}
    </div>
  );
}

export function Avatar({ label, tone = 'pine' }: { label: string; tone?: Tone }) {
  const c = toneColors[tone];
  return (
    <div
      style={{
        width: 40,
        height: 40,
        borderRadius: 11,
        background: c.bg,
        color: c.fg,
        display: 'grid',
        placeItems: 'center',
        fontWeight: 700,
        fontSize: 14,
        flexShrink: 0,
      }}
    >
      {label}
    </div>
  );
}

export function Modal({
  title,
  width = 460,
  onClose,
  children,
}: {
  title: ReactNode;
  width?: number;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(16,28,24,0.42)',
        backdropFilter: 'blur(4px)',
        display: 'grid',
        placeItems: 'center',
        zIndex: 50,
        padding: 20,
      }}
    >
      <button
        aria-label="Close dialog"
        onClick={onClose}
        style={{ position: 'absolute', inset: 0, border: 'none', background: 'transparent', cursor: 'default' }}
      />
      <div
        className="fade-up"
        style={{
          position: 'relative',
          width,
          maxWidth: '100%',
          background: 'var(--card)',
          borderRadius: 18,
          boxShadow: 'var(--shadow-modal)',
          padding: 24,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
          <div style={{ fontWeight: 700, fontSize: 17 }} className="display">
            {title}
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{ background: 'none', border: 'none', color: 'var(--muted)', padding: 4 }}
          >
            <IconX size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Toast({ title, sub }: { title: string; sub?: string }) {
  return (
    <div
      role="status"
      style={{
        position: 'fixed',
        bottom: 26,
        left: '50%',
        transform: 'translateX(-50%)',
        background: 'var(--pine-900)',
        color: '#fff',
        padding: '12px 18px',
        borderRadius: 12,
        boxShadow: 'var(--shadow-modal)',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        zIndex: 60,
        animation: 'toastIn .3s ease both',
      }}
    >
      <span style={{ display: 'grid', placeItems: 'center', width: 24, height: 24, borderRadius: '50%', background: 'var(--confident)' }}>
        <IconCheck size={15} />
      </span>
      <div>
        <div style={{ fontWeight: 600, fontSize: 14 }}>{title}</div>
        {sub && <div style={{ fontSize: 12.5, color: '#AFC9BF' }}>{sub}</div>}
      </div>
    </div>
  );
}

export const money = (n: number) => `₹${n.toLocaleString('en-IN')}`;
