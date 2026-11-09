import { createContext } from 'react';
import type { MaintenanceState, StateKey } from '../../shared/state';
export type DataStore = {
  data: MaintenanceState;
  canEdit: boolean;
  canConfigure: boolean;
  update: <K extends StateKey>(
    key: K,
    action: (previous: MaintenanceState[K]) => MaintenanceState[K]
  ) => void;
};
export const DataContext = createContext<DataStore | null>(null);
