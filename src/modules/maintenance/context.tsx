import { createContext, useContext } from 'react';
import type { useMaintenanceController } from './hooks/useMaintenanceController';
export const MaintenanceContext = createContext<ReturnType<typeof useMaintenanceController> | null>(
  null
);
export function useMaintenance() {
  const context = useContext(MaintenanceContext);
  if (!context) throw new Error('MaintenanceProvider requerido');
  return context;
}
