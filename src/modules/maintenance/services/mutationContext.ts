import type { Dispatch, SetStateAction } from 'react';
import type {
  AppSettings,
  Asset,
  MaintenanceOrder,
  MaintenancePlan,
  MaintType,
  Meter,
  MeterReading,
} from '../../../../shared/types';
import type { FormDraft } from '../types';
export type Values = {
  assets: Asset[];
  plans: MaintenancePlan[];
  readings: MeterReading[];
  meters: Meter[];
  orders: MaintenanceOrder[];
  maintTypes: MaintType[];
  appSettings: AppSettings;
  items: { name: string; unit: string; price: number }[];
};
type Setters = {
  [K in keyof Values as `set${Capitalize<K>}`]: Dispatch<SetStateAction<Values[K]>>;
};
export type MutationContext = Values &
  Setters & {
    draft: FormDraft;
    partRows: { index: number; quantity: number }[];
    notice: (message: string) => void;
    log: (kind: string, text: string) => void;
    asset: (id: number) => string;
    current: (id: number, unit: string, meter?: number) => number;
  };
