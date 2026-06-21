import type { ReactNode } from 'react';
import { useApp, type Screen } from './app-context';
import {
  IconDashboard, IconSell, IconScan, IconMenu, IconInventory, IconSuppliers,
  IconSales, IconPurchase, IconBell, IconSearch, IconLogout,
} from '../lib/icons';
import { Button } from '../components/ui';

type NavItem = { screen: Screen; label: string; icon: typeof IconDashboard; activeOn?: Screen[] };
const SECTIONS: { title: string; items: NavItem[] }[] = [
  {
    title: 'Operate',
    items: [
      { screen: 'dashboard', label: 'Dashboard', icon: IconDashboard },
      { screen: 'sell', label: 'Sell', icon: IconSell },
      { screen: 'scan', label: 'Scan a bill', icon: IconScan, activeOn: ['scan', 'review'] },
    ],
  },
  {
    title: 'Manage',
    items: [
      { screen: 'menu', label: 'Menu & recipes', icon: IconMenu, activeOn: ['menu', 'recipe'] },
      { screen: 'inventory', label: 'Inventory', icon: IconInventory },
      { screen: 'suppliers', label: 'Suppliers', icon: IconSuppliers },
    ],
  },
  {
    title: 'Records',
    items: [
      { screen: 'sales', label: 'Sales history', icon: IconSales },
      { screen: 'purchases', label: 'Purchase log', icon: IconPurchase },
    ],
  },
];

export function Shell({ children }: { children: ReactNode }) {
  const { screen, nav } = useApp();

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {/* Sidebar */}
      <aside
        style={{
          width: 'var(--sidebar-w)',
          flexShrink: 0,
          background: 'var(--pine-900)',
          color: 'var(--side-inactive)',
          position: 'sticky',
          top: 0,
          height: '100vh',
          display: 'flex',
          flexDirection: 'column',
          padding: '20px 14px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '4px 8px 18px' }}>
          <div
            style={{
              width: 36, height: 36, borderRadius: 10, background: 'var(--brass)',
              display: 'grid', placeItems: 'center', color: '#fff', fontWeight: 700, fontSize: 19,
            }}
            className="dvn"
          >
            अ
          </div>
          <div style={{ color: '#fff', fontWeight: 700, fontSize: 15.5 }} className="display">
            Arogya
          </div>
        </div>

        <button
          onClick={() => nav('sell')}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            background: 'var(--brass)', color: '#fff', border: 'none', borderRadius: 10,
            padding: '11px', fontWeight: 600, fontSize: 14, marginBottom: 18,
          }}
        >
          <IconSell size={17} /> Record a sale
        </button>

        <nav style={{ flex: 1, overflowY: 'auto' }}>
          {SECTIONS.map((sec) => (
            <div key={sec.title} style={{ marginBottom: 16 }}>
              <div className="eyebrow" style={{ color: 'var(--side-section)', padding: '0 10px 8px' }}>
                {sec.title}
              </div>
              {sec.items.map((it) => {
                const active = (it.activeOn ?? [it.screen]).includes(screen);
                const Icon = it.icon;
                return (
                  <button
                    key={it.screen}
                    onClick={() => nav(it.screen)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 11, width: '100%',
                      padding: '10px 12px', borderRadius: 10, marginBottom: 2,
                      border: 'none', borderLeft: '3px solid',
                      borderLeftColor: active ? 'var(--brass)' : 'transparent',
                      background: active ? 'rgba(255,255,255,0.10)' : 'transparent',
                      color: active ? 'var(--side-active)' : 'var(--side-inactive)',
                      fontWeight: active ? 600 : 500, fontSize: 14, textAlign: 'left',
                    }}
                  >
                    <Icon size={18} /> {it.label}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        <button
          onClick={() => nav('login')}
          style={{
            display: 'flex', alignItems: 'center', gap: 11, padding: '10px 12px', borderRadius: 10,
            border: 'none', background: 'transparent', color: 'var(--side-inactive)', marginTop: 8,
          }}
        >
          <div style={{ width: 32, height: 32, borderRadius: 9, background: 'rgba(255,255,255,0.12)', color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: 12.5 }}>
            RK
          </div>
          <div style={{ flex: 1, textAlign: 'left' }}>
            <div style={{ color: '#fff', fontSize: 13, fontWeight: 600 }}>Rhea Kapoor</div>
            <div style={{ fontSize: 11.5 }}>Manager</div>
          </div>
          <IconLogout size={16} />
        </button>
      </aside>

      {/* Main column */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <header
          style={{
            height: 'var(--topbar-h)', position: 'sticky', top: 0, zIndex: 20,
            background: 'rgba(250,248,243,0.8)', backdropFilter: 'blur(8px)',
            borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center',
            gap: 16, padding: '0 28px',
          }}
        >
          <div style={{ position: 'relative', flex: 1, maxWidth: 420 }}>
            <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--faint)' }}>
              <IconSearch size={17} />
            </span>
            <input
              placeholder="Search items, menu, suppliers…"
              aria-label="Search"
              style={{
                width: '100%', padding: '9px 12px 9px 36px', borderRadius: 10,
                border: '1px solid var(--border)', background: 'var(--card)', fontSize: 13.5,
              }}
            />
            <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 11.5, color: 'var(--faint)', border: '1px solid var(--border)', borderRadius: 6, padding: '1px 6px' }}>
              ⌘K
            </span>
          </div>
          <div style={{ flex: 1 }} />
          <button aria-label="Notifications" style={{ position: 'relative', background: 'none', border: 'none', color: 'var(--muted)' }}>
            <IconBell size={20} />
            <span style={{ position: 'absolute', top: 0, right: 1, width: 7, height: 7, borderRadius: '50%', background: 'var(--flag)' }} />
          </button>
          <Button onClick={() => nav('sell')}>
            <IconSell size={16} /> Record a sale
          </Button>
        </header>

        <main key={screen} className="fade-up" style={{ maxWidth: 'var(--content-max)', margin: '0 auto', padding: '30px 28px 48px' }}>
          {children}
        </main>
      </div>
    </div>
  );
}
