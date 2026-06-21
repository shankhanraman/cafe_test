import { createContext, useContext, useState, useCallback, useRef, type ReactNode } from 'react';

export type Screen =
  | 'login'
  | 'dashboard'
  | 'sell'
  | 'scan'
  | 'review'
  | 'menu'
  | 'recipe'
  | 'inventory'
  | 'suppliers'
  | 'sales'
  | 'purchases';

export interface Toast {
  title: string;
  sub?: string;
}

interface AppCtx {
  screen: Screen;
  params: Record<string, unknown>;
  nav: (screen: Screen, params?: Record<string, unknown>) => void;
  toast: Toast | null;
  showToast: (t: Toast) => void;
}

const Ctx = createContext<AppCtx | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [screen, setScreen] = useState<Screen>('login');
  const [params, setParams] = useState<Record<string, unknown>>({});
  const [toast, setToast] = useState<Toast | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const nav = useCallback((s: Screen, p: Record<string, unknown> = {}) => {
    setParams(p);
    setScreen(s);
  }, []);

  const showToast = useCallback((t: Toast) => {
    setToast(t);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(null), 3200);
  }, []);

  return <Ctx.Provider value={{ screen, params, nav, toast, showToast }}>{children}</Ctx.Provider>;
}

export function useApp() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useApp must be used within AppProvider');
  return c;
}
