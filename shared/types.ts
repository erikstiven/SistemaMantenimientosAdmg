export type Asset = {
  id: number;
  code: string;
  name: string;
  type: string;
  active?: boolean;
};
export type MaintenancePlan = {
  id: number;
  asset: number;
  name: string;
  unit: string;
  freq: number;
  base: number;
  alert: number;
  second?: {
    unit: string;
    freq: number;
    base?: number;
    alert?: number;
    startDate?: string;
    meter?: number;
  };
  meter?: number;
  startDate?: string;
  active?: boolean;
  endDate?: string;
  note?: string;
};
export type MeterReading = {
  id: number;
  asset: number;
  unit: string;
  value: number;
  date: string;
  meter?: number;
};
export type Meter = {
  id: number;
  asset: number;
  unit: string;
  name: string;
  active: boolean;
};
export type MaintenanceOrder = {
  id: number;
  plan: number;
  status: string;
  date: string;
  doneAt?: string;
  valueAt?: number;
  notes?: string;
  parts?: {
    index: number;
    quantity: number;
    price: number;
    name: string;
  }[];
  snapshot?: string;
};
export type MaintType = {
  id: number;
  name: string;
  description: string;
  active: boolean;
};
export type AppSettings = {
  alerts: boolean;
  hours: number;
  km: number;
  days: number;
  months: number;
};
