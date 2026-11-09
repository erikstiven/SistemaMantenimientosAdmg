import { z } from 'zod';
import {
  initialSettings,
  initialTypes,
  seedA,
  seedHistory,
  seedItems,
  seedM,
  seedO,
  seedP,
  seedR,
} from './seed.ts';

const id = z.number().finite().positive();
const text = z.string().trim().min(1).max(250);
const note = z.string().max(5000);
const nonnegative = z.number().finite().nonnegative();
const date = z.iso.date();
const unit = z.enum(['Horas', 'Kilómetros', 'Días', 'Meses']);
const meterUnit = z.enum(['Horas', 'Kilómetros']);
const rule = z
  .object({
    unit,
    freq: z.number().finite().positive(),
    base: nonnegative.optional(),
    alert: nonnegative.optional(),
    startDate: date.optional(),
    meter: id.optional(),
  })
  .strict();
export const schemas = {
  assets: z
    .object({ id, code: text, name: text, type: text, active: z.boolean().optional() })
    .strict(),
  meters: z.object({ id, asset: id, unit: meterUnit, name: text, active: z.boolean() }).strict(),
  plans: rule
    .extend({
      id,
      asset: id,
      name: text,
      base: nonnegative,
      alert: nonnegative,
      second: rule.optional(),
      active: z.boolean().optional(),
      endDate: date.optional(),
      note: note.optional(),
    })
    .strict(),
  readings: z
    .object({ id, asset: id, unit: meterUnit, value: nonnegative, date, meter: id.optional() })
    .strict(),
  orders: z
    .object({
      id,
      plan: id,
      status: z.enum(['Pendiente', 'Programada', 'Realizada', 'Cancelada']),
      date,
      doneAt: date.optional(),
      valueAt: nonnegative.optional(),
      notes: note.optional(),
      snapshot: note.optional(),
      parts: z
        .array(
          z
            .object({
              index: z.number().int().nonnegative(),
              quantity: z.number().finite().positive(),
              price: nonnegative,
              name: text,
            })
            .strict()
        )
        .max(500)
        .optional(),
    })
    .strict(),
  history: z.object({ id, kind: text, date, text: note }).strict(),
  'maintenance-types': z
    .object({ id, name: text, description: note, active: z.boolean() })
    .strict(),
  items: z.object({ name: text, unit: text, price: nonnegative }).strict(),
  'general-settings': z
    .object({
      alerts: z.boolean(),
      hours: nonnegative,
      km: nonnegative,
      days: nonnegative,
      months: nonnegative,
    })
    .strict(),
};
export const stateSchema = z
  .object({
    assets: z.array(schemas.assets).max(10000),
    meters: z.array(schemas.meters).max(10000),
    plans: z.array(schemas.plans).max(20000),
    readings: z.array(schemas.readings).max(100000),
    orders: z.array(schemas.orders).max(100000),
    history: z.array(schemas.history).max(100000),
    'maintenance-types': z.array(schemas['maintenance-types']).max(1000),
    items: z.array(schemas.items).max(10000),
    'general-settings': schemas['general-settings'],
  })
  .strict();
export type MaintenanceState = z.infer<typeof stateSchema>;
export type StateKey = keyof MaintenanceState;
export type Role = 'admin' | 'technician' | 'viewer';
export type User = {
  id: number;
  username: string;
  role: Role;
  connectionId?: string;
  connectionLabel?: string;
  companyId?: number;
  branchId?: number;
  assetScope?: 'branch' | 'company';
};
export type Snapshot = { data: MaintenanceState; revision: number };
export function initialState(demo = false): MaintenanceState {
  return stateSchema.parse({
    assets: demo ? seedA : [],
    meters: demo ? seedM : [],
    plans: demo ? seedP : [],
    readings: demo ? seedR : [],
    orders: demo ? seedO : [],
    history: demo ? seedHistory : [],
    items: demo ? seedItems : [],
    'maintenance-types': initialTypes,
    'general-settings': initialSettings,
  });
}
