import { z } from 'zod';
import type { ManagedRole, Permission } from './permissions.ts';
// PostgreSQL BIGINT/NUMERIC are strings end-to-end: do not round global IDs or monetary amounts.
export const pgId = z
  .string()
  .regex(/^[1-9]\d*$/)
  .refine(v => BigInt(v) <= 9223372036854775807n, 'Identificador fuera de rango');
export const amount = z
  .string()
  .regex(/^(0|[1-9]\d{0,11})(\.\d{1,2})?$/, 'Usa un decimal positivo con hasta dos decimales');
export const positiveAmount = amount.refine(v => cents(v) > 0n, 'Debe ser mayor a cero');
export const timestamp = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/)
  .refine(
    v =>
      !Number.isNaN(Date.parse(v + 'Z')) &&
      new Date(v + 'Z').toISOString().slice(0, 16) === v.slice(0, 16),
    'Fecha y hora inválidas'
  );
const text = (max: number) => z.string().trim().min(1).max(max);
const note = z.string().max(5000).default('');
export const unitInput = z
  .object({
    codigo: text(10),
    nombre: text(50),
    tipo_control: z.enum(['MEDIDOR', 'CALENDARIO']),
    estado: z.boolean().default(true),
  })
  .strict();
export const typeInput = z
  .object({ nombre: text(100), descripcion: note, estado: z.boolean().default(true) })
  .strict();
export const partInput = z
  .object({
    codigo: text(30),
    nombre: text(150),
    unidad_medida: text(20),
    costo_referencia: amount,
    estado: z.boolean().default(true),
  })
  .strict();
export const meterInput = z
  .object({
    id_activo: pgId,
    id_um: pgId,
    codigo: text(30),
    nombre_medidor: text(100),
    estado: z.boolean().default(true),
  })
  .strict();
export const readingInput = z
  .object({ id_medidor: pgId, fecha_lectura: timestamp, valor: amount, observacion: note })
  .strict();
export const ruleInput = z
  .object({
    id_medidor: pgId.nullable().default(null),
    id_um: pgId,
    frecuencia: positiveAmount,
    valor_base: amount.nullable().default(null),
    alerta_antes: amount.default('0'),
  })
  .strict();
export const planInput = z
  .object({
    id_activo: pgId,
    id_tima: pgId,
    nombre_plan: text(150),
    fecha_inicio: z.iso.date(),
    fecha_fin: z.iso.date().nullable().default(null),
    observacion: note,
    condicion: z.enum(['OR', 'AND']),
    reglas: z.array(ruleInput).min(1).max(100),
  })
  .strict()
  .refine(
    v => !v.fecha_fin || v.fecha_fin >= v.fecha_inicio,
    'El fin debe ser posterior al inicio'
  );
export const orderInput = z
  .object({
    id_plan: pgId,
    fecha_programada: z.iso.date().nullable().default(null),
    valor_programado: amount.nullable().default(null),
    observacion: note,
  })
  .strict();
export const completionInput = z
  .object({
    fecha_realizada: timestamp,
    valor_realizado: amount.nullable().default(null),
    observacion: note,
    detalles: z
      .array(z.object({ id_repu: pgId, cantidad: positiveAmount, costo_unitario: amount }).strict())
      .max(500),
  })
  .strict();
export const planStateInput = z.object({ estado: z.enum(['ACTIVO', 'INACTIVO']) }).strict();
export type ExternalAsset = {
  id_activo: string;
  conexion_erp: string;
  empresa_id: string;
  sucursal_id: string;
  act_cod_act: string;
  clave?: string;
  nombre: string;
  tipo: string;
  act_usa_mant: 'S' | 'N';
  act_fcmp_act?: string | null;
};
export type Unit = z.infer<typeof unitInput> & { id_um: string };
export type MaintTypeRow = z.infer<typeof typeInput> & { id_tima: string };
export type PartRow = z.infer<typeof partInput> & { id_repu: string };
export type MeterRow = z.infer<typeof meterInput> & { id_medidor: string };
export type ReadingRow = z.infer<typeof readingInput> & { id_lectura: string };
export type PlanRow = Omit<z.infer<typeof planInput>, 'reglas' | 'condicion'> & {
  id_plan: string;
  estado: 'ACTIVO' | 'INACTIVO';
};
export type RuleRow = z.infer<typeof ruleInput> & {
  id_regla: string;
  id_plan: string;
  condicion: 'OR' | 'AND';
  orden_eval: number;
  estado: boolean;
};
export type OrderRow = z.infer<typeof orderInput> & {
  id_ordm: string;
  fecha_realizada: string | null;
  valor_realizado: string | null;
  estado: 'PENDIENTE' | 'REALIZADA' | 'CANCELADO';
};
export type DetailRow = z.infer<typeof completionInput>['detalles'][number] & {
  id_detm: string;
  id_ordm: string;
  subtotal: string;
};
export type AuditRow = {
  id: string;
  connection_id: string;
  user_id: string;
  operation: string;
  entity_id: string | null;
  created_at: string;
};
export type RelationalData = {
  revision: number;
  warnings: string[];
  assets: ExternalAsset[];
  units: Unit[];
  types: MaintTypeRow[];
  parts: PartRow[];
  meters: MeterRow[];
  readings: ReadingRow[];
  plans: PlanRow[];
  rules: RuleRow[];
  orders: OrderRow[];
  details: DetailRow[];
  audit: AuditRow[];
};
export type MaintenanceBootstrap = RelationalData & {
  permissions: Permission[];
  rolePermissions?: Record<ManagedRole, Permission[]>;
};
export function cents(value: string): bigint {
  const [whole, decimal = ''] = value.split('.');
  return BigInt(whole) * 100n + BigInt(decimal.padEnd(2, '0'));
}
export function decimal(value: bigint): string {
  return `${value / 100n}.${String(value % 100n).padStart(2, '0')}`;
}
export function subtotal(quantity: string, cost: string): string {
  return decimal((cents(quantity) * cents(cost) + 50n) / 100n);
}
