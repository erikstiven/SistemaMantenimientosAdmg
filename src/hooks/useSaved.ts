import type { Dispatch, SetStateAction } from 'react';
import { useCallback, useContext } from 'react';
import type { MaintenanceState, StateKey } from '../../shared/state';
import { DataContext } from '../services/dataContext';

/** All module changes share one state transaction and one persistence queue. */
export function useSaved<K extends StateKey, T = MaintenanceState[K]>(
  key: K,
  _initial: T
): [T, Dispatch<SetStateAction<T>>] {
  const context = useContext(DataContext);
  if (!context) throw new Error('DataProvider requerido');
  const { data, update } = context;
  const setValue: Dispatch<SetStateAction<T>> = useCallback(
    action => {
      update(key, previous =>
        typeof action === 'function'
          ? ((action as (value: T) => T)(previous as T) as MaintenanceState[K])
          : (action as MaintenanceState[K])
      );
    },
    [key, update]
  );
  return [data[key] as T, setValue];
}
