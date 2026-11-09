import { Suspense } from 'react';
import { modules } from './app/moduleRegistry';
import { MaintenanceLayout } from './layouts/MaintenanceLayout';
import { MaintenanceContext } from './modules/maintenance/context';
import { useMaintenanceController } from './modules/maintenance/hooks/useMaintenanceController';
import { DataProvider } from './services/DataProvider';
import { ErrorBoundary } from './components/ErrorBoundary';
import RelationalApp from './modules/maintenance/RelationalApp';
import { apiMode } from './services/api';
function MaintenanceApp() {
  const controller = useMaintenanceController();
  const Page = modules.find(m => m.label === controller.page)?.Page ?? modules[0].Page;
  return (
    <MaintenanceContext.Provider value={controller}>
      <MaintenanceLayout>
        <Suspense fallback={<p role="status">Cargando módulo…</p>}>
          <Page />
        </Suspense>
      </MaintenanceLayout>
    </MaintenanceContext.Provider>
  );
}
export default function App() {
  return (
    <ErrorBoundary>
      {apiMode ? (
        <RelationalApp />
      ) : (
        <DataProvider>
          <MaintenanceApp />
        </DataProvider>
      )}
    </ErrorBoundary>
  );
}
