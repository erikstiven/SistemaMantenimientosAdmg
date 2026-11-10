import type { RelationalData } from '../../../shared/relational.ts';
import type { Permission } from '../../../shared/permissions.ts';
import type { Queryable } from './relational.repository.ts';

type State = Record<string, unknown>;
export type AuditTrace = {
  previousId?: string;
  before?: State | null;
  after?: State | null;
  related?: { operation: string; id: string };
};

const entities = {
  assets: { key: 'assets', id: 'id_activo' },
  meter: {
    key: 'meters',
    id: 'id_medidor',
    table: 'saemedi_mant',
    fields: 'id_medidor::text,id_activo::text,id_um::text,codigo,nombre_medidor,estado',
  },
  reading: {
    key: 'readings',
    id: 'id_lectura',
    table: 'saelect_mant',
    fields: 'id_lectura::text,id_medidor::text,fecha_lectura,valor::text,observacion',
  },
  plan: {
    key: 'plans',
    id: 'id_plan',
    table: 'saeplan_mant',
    fields:
      'id_plan::text,id_activo::text,id_tima::text,estado,nombre_plan,fecha_inicio,fecha_fin,observacion',
  },
  order: {
    key: 'orders',
    id: 'id_ordm',
    table: 'saeordm_mant',
    fields:
      'id_ordm::text,id_plan::text,fecha_programada,fecha_realizada,valor_programado::text,valor_realizado::text,estado,observacion',
  },
  parts: {
    key: 'parts',
    id: 'id_repu',
    table: 'saerepu_mant',
    fields: 'id_repu::text,codigo,nombre,unidad_medida,costo_referencia::text,estado',
  },
  types: {
    key: 'types',
    id: 'id_tima',
    table: 'saetima_mant',
    fields: 'id_tima::text,nombre,descripcion,estado',
  },
  units: {
    key: 'units',
    id: 'id_um',
    table: 'saeumd_mant',
    fields: 'id_um::text,codigo,nombre,tipo_control,estado',
  },
} as const;
const plural = { meters: 'meter', plans: 'plan', orders: 'order' } as const;

function auditEntity(operation: string) {
  const [module] = operation.split('.');
  const key = plural[module as keyof typeof plural] ?? module;
  const entity = Object.hasOwn(entities, key) ? entities[key as keyof typeof entities] : undefined;
  return { key, entity };
}

export function visibleAuditState(
  state: State | null,
  operation: string,
  permissions: readonly Permission[]
) {
  const { key, entity } = auditEntity(operation);
  const module = entity?.key ?? key;
  if (!state || !permissions.includes(`${module}.read` as Permission)) return null;
  if (key !== 'order' || permissions.includes('parts.read')) return state;
  const { repuestos: _repuestos, ...rest } = state;
  return rest;
}

export async function auditStates(
  client: Queryable,
  data: RelationalData,
  operation: string,
  id: string | null,
  trace: AuditTrace
) {
  const { key, entity } = auditEntity(operation);
  if (!id || !entity) return { before: trace.before, after: trace.after };
  const previousId = trace.previousId ?? id;
  const previous = (data[entity.key] as State[]).find(row => row[entity.id] === previousId);
  const before =
    trace.before ??
    (previous
      ? {
          ...previous,
          ...(key === 'plan'
            ? { reglas: data.rules.filter(rule => rule.id_plan === previousId) }
            : {}),
          ...(key === 'order'
            ? { repuestos: data.details.filter(detail => detail.id_ordm === previousId) }
            : {}),
        }
      : null);
  if (trace.after !== undefined || !('table' in entity)) return { before, after: trace.after };
  const {
    rows: [current],
  } = await client.query(
    `SELECT ${entity.fields} FROM public.${entity.table} WHERE ${entity.id}=$1`,
    [id]
  );
  if (!current) return { before, after: null };
  if (key === 'plan') {
    const { rows } = await client.query(
      `SELECT id_regla::text,id_plan::text,id_medidor::text,id_um::text,frecuencia::text,
        valor_base::text,alerta_antes::text,condicion,orden_eval,estado
       FROM public.saeregl_mant WHERE id_plan=$1 ORDER BY orden_eval`,
      [id]
    );
    current.reglas = rows;
    if (trace.previousId) {
      const {
        rows: [replaced],
      } = await client.query(
        'SELECT id_plan::text,estado,fecha_fin FROM public.saeplan_mant WHERE id_plan=$1',
        [trace.previousId]
      );
      current.plan_sustituido = replaced;
    }
  }
  if (operation === 'order.complete') {
    const { rows } = await client.query(
      `SELECT id_repu::text,cantidad::text,costo_unitario::text,subtotal::text
       FROM public.saedetm_mant WHERE id_ordm=$1 ORDER BY id_detm`,
      [id]
    );
    current.repuestos = rows;
  }
  return { before, after: current as State };
}
