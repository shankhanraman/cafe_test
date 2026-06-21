import { AppProvider, useApp } from './app-context';
import { Shell } from './Shell';
import { Toast } from '../components/ui';
import { LoginScreen } from '../features/auth/LoginScreen';
import { DashboardScreen } from '../features/dashboard/DashboardScreen';
import { SellScreen } from '../features/sales/SellScreen';
import { SalesHistoryScreen } from '../features/sales/SalesHistoryScreen';
import { ScanScreen } from '../features/bill-preview/ScanScreen';
import { ReviewScreen } from '../features/bill-preview/ReviewScreen';
import { InventoryScreen } from '../features/inventory/InventoryScreen';
import { MenuScreen } from '../features/menu/MenuScreen';
import { RecipeEditorScreen } from '../features/menu/RecipeEditorScreen';
import { SuppliersScreen } from '../features/suppliers/SuppliersScreen';
import { PurchaseLogScreen } from '../features/purchases/PurchaseLogScreen';

function Router() {
  const { screen, toast } = useApp();

  if (screen === 'login') return <LoginScreen />;

  const screens: Record<string, React.ReactNode> = {
    dashboard: <DashboardScreen />,
    sell: <SellScreen />,
    scan: <ScanScreen />,
    review: <ReviewScreen />,
    inventory: <InventoryScreen />,
    menu: <MenuScreen />,
    recipe: <RecipeEditorScreen />,
    suppliers: <SuppliersScreen />,
    sales: <SalesHistoryScreen />,
    purchases: <PurchaseLogScreen />,
  };

  return (
    <Shell>
      {screens[screen]}
      {toast && <Toast {...toast} />}
    </Shell>
  );
}

export function App() {
  return (
    <AppProvider>
      <Router />
    </AppProvider>
  );
}
