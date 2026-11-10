import type { PoolClient } from 'pg';
import type { User } from '../../../shared/state.ts';
import {
  configurablePermissions,
  type ManagedRole,
  type Permission,
} from '../../../shared/permissions.ts';
import {
  amount,
  cents,
  subtotal,
  assetInput,
  assetStateInput,
  unitInput,
  typeInput,
  partInput,
  meterInput,
  readingInput,
  planInput,
  orderInput,
  completionInput,
  planStateInput,
  type ReadingRow,
  type RelationalData,
} from '../../../shared/relational.ts';
import {
  calendarDue,
  businessDay,
  latestExecution,
} from '../../../shared/maintenance-evaluation.ts';
import { AppError } from '../../shared/errors.ts';
import { RelationalRepository } from './relational.repository.ts';
import { persistentAssetIdentity } from '../../asset-identities.ts';
import type { AuditTrace } from './maintenance-audit.ts';
function requireValue(value: unknown, message: string): asserts value {
  if (!value) throw new AppError(422, message, 'BUSINESS_RULE');
}
const stamp = (v: string) => (v.length === 16 ? v + ':00' : v);
const catalog = {
  units: { table: 'saeumd_mant', id: 'id_um', schema: unitInput },
  types: { table: 'saetima_mant', id: 'id_tima', schema: typeInput },
  parts: { table: 'saerepu_mant', id: 'id_repu', schema: partInput },
} as const;
export type Catalog = keyof typeof catalog;
export const deletableModules = ['meters', 'plans', 'orders', 'parts', 'types', 'units'] as const;
type DeletableModule = (typeof deletableModules)[number];

async function remove(client: PoolClient, table: string, idColumn: string, id: string) {
  const { rowCount } = await client.query(`DELETE FROM public.${table} WHERE ${idColumn}=$1`, [id]);
  if (!rowCount) throw new AppError(409, 'El registro fue modificado o eliminado');
  return id;
}

async function setAssetState(
  client: PoolClient,
  view: string | undefined,
  asset: RelationalData['assets'][number],
  state: 'S' | 'N'
) {
  const result = view
    ? await client.query(
        `UPDATE ${view} SET act_usa_mant=$1
         WHERE id_activo=$2 AND conexion_erp=$3 AND empresa_id=$4 AND sucursal_id=$5`,
        [state, asset.id_activo, asset.conexion_erp, asset.empresa_id, asset.sucursal_id]
      )
    : await client.query(
        `UPDATE public.saeact SET act_usa_mant=$1
         WHERE act_cod_act=$2 AND act_cod_empr=$3 AND act_cod_sucu=$4`,
        [state, asset.act_cod_act, asset.empresa_id, asset.sucursal_id]
      );
  if (!result.rowCount) throw new AppError(409, 'El activo fue modificado o eliminado');
  return asset.id_activo;
}
async function insert(
  client: PoolClient,
  table: string,
  id: string,
  values: Record<string, unknown>
) {
  const columns = Object.keys(values);
  const { rows } = await client.query(
    `INSERT INTO public.${table}(${columns.join(',')}) VALUES(${columns.map((_, i) => '$' + (i + 1)).join(',')}) RETURNING ${id}::text AS id`,
    Object.values(values)
  );
  return rows[0].id as string;
}
async function update(
  client: PoolClient,
  table: string,
  idColumn: string,
  id: string,
  values: Record<string, unknown>
) {
  const columns = Object.keys(values);
  const { rowCount } = await client.query(
    `UPDATE public.${table} SET ${columns.map((c, i) => `${c}=$${i + 1}`).join(',')} WHERE ${idColumn}=$${columns.length + 1}`,
    [...Object.values(values), id]
  );
  if (!rowCount) throw new AppError(409, 'El registro fue modificado o eliminado');
  return id;
}
function enabledAsset(data: RelationalData, id: string) {
  requireValue(
    data.assets.some(a => a.id_activo === id && a.act_usa_mant === 'S'),
    'Selecciona un activo habilitado para mantenimiento'
  );
}
function visible<T>(row: T | undefined): T {
  if (!row) throw new AppError(404, 'Registro inexistente o fuera de tu empresa y sucursal');
  return row;
}

function preserveExecutionReading(
  data: RelationalData,
  previous: ReadingRow,
  remaining: ReadingRow[],
  replacement?: Pick<ReadingRow, 'fecha_lectura' | 'valor'>
) {
  const relatedPlans = new Set(
    data.rules.filter(r => r.id_medidor === previous.id_medidor).map(r => r.id_plan)
  );
  const ordered = [...remaining].sort((a, b) =>
    stamp(b.fecha_lectura).localeCompare(stamp(a.fecha_lectura))
  );
  for (const order of data.orders) {
    if (
      order.estado !== 'REALIZADA' ||
      !relatedPlans.has(order.id_plan) ||
      !order.fecha_realizada ||
      order.valor_realizado === null
    )
      continue;
    const execution = stamp(order.fecha_realizada);
    const previousDate = stamp(previous.fecha_lectura);
    // Only executions for which this reading was the latest can lose their support.
    const latest = ordered.find(row => stamp(row.fecha_lectura) <= execution);
    if (previousDate > execution || (latest && stamp(latest.fecha_lectura) > previousDate))
      continue;
    const value =
      replacement &&
      replacement.fecha_lectura <= execution &&
      (!latest || replacement.fecha_lectura > stamp(latest.fecha_lectura))
        ? replacement.valor
        : latest?.valor;
    requireValue(
      value !== undefined && cents(value) === cents(order.valor_realizado),
      'El cambio dejaría una ejecución sin su lectura de respaldo'
    );
  }
}
function validateRules(data: RelationalData, input: ReturnType<typeof planInput.parse>) {
  for (const rule of input.reglas) {
    const unit = data.units.find(u => u.id_um === rule.id_um);
    requireValue(unit?.estado, 'Selecciona una unidad activa');
    if (unit.tipo_control === 'MEDIDOR') {
      const meter = data.meters.find(m => m.id_medidor === rule.id_medidor);
      requireValue(
        meter?.estado && meter.id_activo === input.id_activo && meter.id_um === rule.id_um,
        'La regla requiere un medidor activo del mismo activo y unidad'
      );
      requireValue(rule.valor_base !== null, 'La regla de medidor requiere una base inicial');
    } else {
      requireValue(
        rule.id_medidor === null && rule.valor_base === null,
        'Una regla calendario no lleva medidor ni base numérica'
      );
      requireValue(
        Number.isInteger(Number(rule.frecuencia)),
        'La frecuencia calendario debe ser entera'
      );
      try {
        calendarDue(input.fecha_inicio, rule.frecuencia, unit.codigo);
      } catch {
        throw new AppError(
          422,
          'Unidad o frecuencia calendario inválida; usa DIA o MES dentro del rango de fechas'
        );
      }
    }
  }
}
export class RelationalService {
  constructor(private repository: RelationalRepository) {}
  read(actor: User) {
    return this.repository.snapshot(actor);
  }
  private write(
    actor: User,
    revision: number,
    permission: Permission,
    work: (client: PoolClient, data: RelationalData, trace: AuditTrace) => Promise<string | null>,
    operation = permission as string
  ) {
    return this.repository.mutate(actor, revision, operation, permission, work);
  }
  assetState(actor: User, revision: number, id: string, body: unknown) {
    if (actor.role !== 'admin')
      throw new AppError(403, 'Solo un administrador puede gestionar activos');
    const { act_usa_mant } = assetStateInput.parse(body);
    return this.write(
      actor,
      revision,
      'assets.update',
      async (client, data, trace) => {
        const asset = visible(data.assets.find(a => a.id_activo === id));
        trace.after = { ...asset, act_usa_mant };
        return setAssetState(
          client,
          this.repository.definition.assetIntegrationView,
          asset,
          act_usa_mant
        );
      },
      'assets.state'
    );
  }
  deleteRecord(actor: User, revision: number, key: DeletableModule, id: string) {
    if (actor.role !== 'admin')
      throw new AppError(403, 'Solo un administrador puede eliminar registros');
    return this.write(actor, revision, `${key}.delete`, async (client, data) => {
      switch (key) {
        case 'meters':
          visible(data.meters.find(m => m.id_medidor === id));
          if (
            data.readings.some(r => r.id_medidor === id) ||
            data.rules.some(r => r.id_medidor === id)
          )
            return update(client, 'saemedi_mant', 'id_medidor', id, { estado: false });
          return remove(client, 'saemedi_mant', 'id_medidor', id);
        case 'plans':
          visible(data.plans.find(p => p.id_plan === id));
          requireValue(
            !data.orders.some(o => o.id_plan === id && o.estado === 'PENDIENTE'),
            'Completa o cancela las órdenes pendientes antes de eliminar el plan'
          );
          if (data.orders.some(o => o.id_plan === id))
            return update(client, 'saeplan_mant', 'id_plan', id, { estado: 'INACTIVO' });
          await client.query('DELETE FROM public.saeregl_mant WHERE id_plan=$1', [id]);
          return remove(client, 'saeplan_mant', 'id_plan', id);
        case 'orders': {
          const order = visible(data.orders.find(o => o.id_ordm === id));
          requireValue(
            order.estado !== 'REALIZADA',
            'La orden realizada se conserva como respaldo del mantenimiento'
          );
          return remove(client, 'saeordm_mant', 'id_ordm', id);
        }
        default:
          // Database foreign keys also protect references outside the current branch.
          return remove(client, catalog[key].table, catalog[key].id, id);
      }
    });
  }
  voidReading(actor: User, revision: number, id: string) {
    if (actor.role !== 'admin')
      throw new AppError(403, 'Solo un administrador puede anular lecturas');
    return this.write(
      actor,
      revision,
      'readings.void',
      async (_client, data, trace) => {
        const reading = visible(data.readings.find(row => row.id_lectura === id));
        requireValue(!reading.anulacion, 'La lectura ya está anulada');
        preserveExecutionReading(
          data,
          reading,
          data.readings.filter(
            row => row.id_medidor === reading.id_medidor && row.id_lectura !== id && !row.anulacion
          )
        );
        trace.before = { ...reading, estado: 'VALIDA' };
        trace.after = { ...reading, estado: 'ANULADA' };
        return id;
      },
      'reading.void'
    );
  }
  saveRole(actor: User, revision: number, role: ManagedRole, permissions: Permission[]) {
    if (actor.role !== 'admin') throw new AppError(403, 'No tienes permiso para administrar roles');
    requireValue(
      permissions.every(permission => configurablePermissions.includes(permission)),
      'Permiso desconocido o reservado'
    );
    return this.write(
      actor,
      revision,
      'roles.update',
      async (client, _data, trace) => {
        const previous = await this.repository.rolePermissions(client, actor);
        const selected = [...new Set(permissions)];
        trace.before = { rol: role, permisos: previous[role] };
        trace.after = { rol: role, permisos: selected };
        await client.query(
          `INSERT INTO sismant.maintenance_role_permissions(connection_id,company_id,role,permissions)
         VALUES($1,$2,$3,$4::jsonb)
         ON CONFLICT(connection_id,company_id,role) DO UPDATE SET permissions=EXCLUDED.permissions`,
          [actor.connectionId, actor.companyId, role, JSON.stringify(selected)]
        );
        return null;
      },
      'roles.update.' + role
    );
  }
  asset(actor: User, revision: number, body: unknown, id?: string) {
    if (actor.role !== 'admin')
      throw new AppError(403, 'Solo un administrador puede gestionar activos');
    const input = assetInput.parse(body);
    return this.write(
      actor,
      revision,
      id ? 'assets.update' : 'assets.create',
      async (client, data, trace) => {
        const companyId = actor.companyId;
        const branchId = actor.branchId;
        requireValue(companyId && branchId, 'Se requiere empresa y sucursal en la sesión');

        if (id) {
          const old = visible(data.assets.find(a => a.id_activo === id));
          await client.query(
            `UPDATE public.saeact SET act_nom_act=$1, act_clave_act=$2, act_usa_mant=$3, act_fcmp_act=$4
             WHERE act_cod_empr=$5 AND act_cod_sucu=$6 AND act_cod_act=$7`,
            [
              input.nombre,
              input.clave,
              input.act_usa_mant,
              input.act_fcmp_act || null,
              old.empresa_id,
              old.sucursal_id,
              old.act_cod_act,
            ]
          );
          if (this.repository.definition.assetIntegrationView) {
            try {
              await client.query(
                `UPDATE ${this.repository.definition.assetIntegrationView}
                 SET nombre=$1, act_usa_mant=$2, act_fcmp_act=$3
                 WHERE id_activo=$4`,
                [input.nombre, input.act_usa_mant, input.act_fcmp_act || null, id]
              );
            } catch {
              // Ignore if integration view is a real database view
            }
          }
          if (input.act_usa_mant === 'S') {
            await persistentAssetIdentity(
              client,
              {
                connectionId: this.repository.definition.id,
                empresaId: old.empresa_id,
                sucursalId: old.sucursal_id,
                actCodAct: old.act_cod_act,
              },
              this.repository.definition.assetNamespace ?? 1
            );
          }
          trace.after = {
            ...old,
            nombre: input.nombre,
            clave: this.repository.definition.assetIntegrationView ? old.clave : input.clave,
            act_usa_mant: input.act_usa_mant,
            act_fcmp_act: input.act_fcmp_act,
          };
          return id;
        }

        let actCodAct = input.act_cod_act;
        if (!actCodAct) {
          const maxRes = await client.query(
            'SELECT COALESCE(MAX(act_cod_act), 0) + 1 AS next_cod FROM public.saeact WHERE act_cod_empr=$1 AND act_cod_sucu=$2',
            [String(companyId), String(branchId)]
          );
          actCodAct = String(maxRes.rows[0].next_cod);
        } else {
          const exists = await client.query(
            'SELECT 1 FROM public.saeact WHERE act_cod_empr=$1 AND act_cod_sucu=$2 AND act_cod_act=$3',
            [String(companyId), String(branchId), actCodAct]
          );
          if (exists.rows.length) {
            throw new AppError(
              409,
              'Ya existe un activo con ese código en esta empresa y sucursal'
            );
          }
        }

        await client.query(
          `INSERT INTO public.saeact(act_cod_act, act_cod_empr, act_cod_sucu, act_nom_act, act_clave_act, act_usa_mant, act_fcmp_act)
           VALUES($1, $2, $3, $4, $5, $6, $7)`,
          [
            actCodAct,
            String(companyId),
            String(branchId),
            input.nombre,
            input.clave,
            input.act_usa_mant,
            input.act_fcmp_act || null,
          ]
        );

        const globalId = await persistentAssetIdentity(
          client,
          {
            connectionId: this.repository.definition.id,
            empresaId: String(companyId),
            sucursalId: String(branchId),
            actCodAct,
          },
          this.repository.definition.assetNamespace ?? 1
        );

        if (this.repository.definition.assetIntegrationView) {
          try {
            await client.query(
              `INSERT INTO ${this.repository.definition.assetIntegrationView}(id_activo, conexion_erp, empresa_id, sucursal_id, act_cod_act, nombre, tipo, act_usa_mant, act_fcmp_act)
               VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
              [
                globalId,
                this.repository.definition.id,
                String(companyId),
                String(branchId),
                actCodAct,
                input.nombre,
                input.tipo,
                input.act_usa_mant,
                input.act_fcmp_act || null,
              ]
            );
          } catch {
            // Ignore if integration view is a real database view
          }
        }

        trace.after = {
          id_activo: globalId,
          act_cod_act: actCodAct,
          nombre: input.nombre,
          clave: input.clave,
          act_usa_mant: input.act_usa_mant,
          act_fcmp_act: input.act_fcmp_act,
        };
        return globalId;
      },
      id ? 'assets.update' : 'assets.create'
    );
  }
  catalog(actor: User, revision: number, key: Catalog, body: unknown, id?: string) {
    const definition = catalog[key];
    const input = definition.schema.parse(body);
    return this.write(
      actor,
      revision,
      `${key}.${id ? 'update' : 'create'}`,
      async (client, data) => {
        const previous = id
          ? visible(
              data[key].find(
                row => String((row as unknown as Record<string, unknown>)[definition.id]) === id
              )
            )
          : undefined;
        if (key === 'units') {
          const unit = unitInput.parse(input);
          requireValue(
            unit.tipo_control !== 'CALENDARIO' || ['DIA', 'MES'].includes(unit.codigo),
            'Las unidades calendario deben usar DIA o MES'
          );
          requireValue(
            unit.tipo_control !== 'MEDIDOR' || !['DIA', 'MES'].includes(unit.codigo),
            'DIA y MES están reservadas para calendario'
          );
          if (
            previous &&
            (data.meters.some(m => m.id_um === id) || data.rules.some(r => r.id_um === id))
          ) {
            const old = previous as RelationalData['units'][number];
            requireValue(
              old.codigo === unit.codigo && old.tipo_control === unit.tipo_control,
              'No cambies el código o tipo de una unidad utilizada; desactívala y crea otra'
            );
          }
        }
        if (key === 'parts' && previous && data.details.some(d => d.id_repu === id)) {
          const part = partInput.parse(input),
            old = previous as RelationalData['parts'][number];
          requireValue(
            old.codigo === part.codigo &&
              old.nombre === part.nombre &&
              old.unidad_medida === part.unidad_medida,
            'Un repuesto utilizado conserva su código, nombre y unidad; puedes ajustar costo y estado'
          );
        }
        return id
          ? update(client, definition.table, definition.id, id, input)
          : insert(client, definition.table, definition.id, input);
      }
    );
  }
  meter(actor: User, revision: number, body: unknown, id?: string) {
    const input = meterInput.parse(body);
    return this.write(
      actor,
      revision,
      `meters.${id ? 'update' : 'create'}`,
      async (client, data) => {
        if (id) {
          const old = visible(data.meters.find(m => m.id_medidor === id));
          requireValue(
            old.id_activo === input.id_activo && old.id_um === input.id_um,
            'No cambies el activo o unidad de un medidor; crea uno nuevo'
          );
        }
        if (!id || input.estado) enabledAsset(data, input.id_activo);
        const unit = data.units.find(u => u.id_um === input.id_um);
        requireValue(
          unit?.tipo_control === 'MEDIDOR' && (!input.estado || unit.estado),
          'Selecciona una unidad de tipo MEDIDOR activa'
        );
        if (id) return update(client, 'saemedi_mant', 'id_medidor', id, input);
        const meterId = await insert(client, 'saemedi_mant', 'id_medidor', input);
        const asset = data.assets.find(a => a.id_activo === input.id_activo);
        const fcmp = asset?.act_fcmp_act;
        const initialDate =
          fcmp && /^\d{4}-\d{2}-\d{2}$/.test(fcmp) && fcmp <= businessDay()
            ? `${fcmp} 00:00:00`
            : '1970-01-01 00:00:00';
        await insert(client, 'saelect_mant', 'id_lectura', {
          id_medidor: meterId,
          fecha_lectura: initialDate,
          valor: '0.00',
          observacion: fcmp
            ? 'Lectura inicial automática (fecha de compra del activo)'
            : 'Lectura inicial automática (hito base)',
        });
        return meterId;
      },
      `meter.${id ? 'update' : 'create'}`
    );
  }
  reading(actor: User, revision: number, body: unknown, id?: string) {
    const input = readingInput.parse(body);
    input.fecha_lectura = stamp(input.fecha_lectura);
    return this.write(
      actor,
      revision,
      id ? 'readings.update' : 'readings.create',
      async (client, data) => {
        const previous = id ? visible(data.readings.find(row => row.id_lectura === id)) : undefined;
        requireValue(!previous?.anulacion, 'Una lectura anulada no se puede corregir');
        requireValue(
          !previous || previous.id_medidor === input.id_medidor,
          'Una lectura existente conserva su medidor'
        );
        const meter = visible(data.meters.find(m => m.id_medidor === input.id_medidor));
        if (!previous) {
          enabledAsset(data, meter.id_activo);
          requireValue(
            meter.estado &&
              data.units.some(
                u => u.id_um === meter.id_um && u.estado && u.tipo_control === 'MEDIDOR'
              ),
            'Selecciona un medidor y unidad activos'
          );
        }
        requireValue(
          input.fecha_lectura.slice(0, 10) <= businessDay(),
          'No registres lecturas en fechas futuras'
        );
        const history = data.readings.filter(
          r => r.id_medidor === input.id_medidor && r.id_lectura !== id
        );
        requireValue(
          !history.some(r => stamp(r.fecha_lectura) === input.fecha_lectura),
          'Ya existe una lectura del medidor en esa fecha y hora'
        );
        const readings = history.filter(r => !r.anulacion);
        for (const row of readings) {
          if (stamp(row.fecha_lectura) < input.fecha_lectura)
            requireValue(cents(row.valor) <= cents(input.valor), 'La lectura no puede retroceder');
          if (stamp(row.fecha_lectura) > input.fecha_lectura)
            requireValue(
              cents(row.valor) >= cents(input.valor),
              'La lectura histórica no puede superar una posterior'
            );
        }
        const relatedPlans = new Set(
          data.rules.filter(r => r.id_medidor === input.id_medidor).map(r => r.id_plan)
        );
        requireValue(
          !data.orders.some(
            order =>
              order.estado === 'REALIZADA' &&
              relatedPlans.has(order.id_plan) &&
              order.fecha_realizada &&
              stamp(order.fecha_realizada) >= input.fecha_lectura &&
              order.valor_realizado !== null &&
              cents(input.valor) > cents(order.valor_realizado)
          ),
          'La lectura contradice el valor de una ejecución histórica'
        );
        if (!previous || !id) return insert(client, 'saelect_mant', 'id_lectura', input);
        preserveExecutionReading(data, previous, readings, input);
        await client.query(
          `INSERT INTO sismant.maintenance_reading_corrections(connection_id,company_id,revision,reading_id,previous,corrected)
         VALUES($1,$2,$3,$4,$5::jsonb,$6::jsonb)`,
          [
            actor.connectionId,
            actor.companyId,
            revision + 1,
            id,
            JSON.stringify(previous),
            JSON.stringify(input),
          ]
        );
        return update(client, 'saelect_mant', 'id_lectura', id, input);
      },
      id ? 'reading.update' : 'reading.create'
    );
  }
  plan(actor: User, revision: number, body: unknown, replaceId?: string) {
    const input = planInput.parse(body);
    return this.write(
      actor,
      revision,
      replaceId ? 'plans.replace' : 'plans.create',
      async (client, data, trace) => {
        enabledAsset(data, input.id_activo);
        requireValue(
          data.types.some(t => t.id_tima === input.id_tima && t.estado),
          'Selecciona un tipo de mantenimiento activo'
        );
        validateRules(data, input);
        if (replaceId) {
          trace.previousId = replaceId;
          const old = visible(data.plans.find(p => p.id_plan === replaceId));
          requireValue(
            old.estado === 'ACTIVO' && old.id_activo === input.id_activo,
            'Solo puedes sustituir un plan activo del mismo activo'
          );
          requireValue(
            input.fecha_inicio >= old.fecha_inicio,
            'La estrategia nueva no puede empezar antes que la anterior'
          );
          const execution = latestExecution(data, replaceId);
          requireValue(
            !execution || input.fecha_inicio >= execution.fecha_realizada!.slice(0, 10),
            'La estrategia nueva no puede comenzar antes del último servicio realizado'
          );
          requireValue(
            !data.orders.some(order => order.id_plan === replaceId && order.estado === 'PENDIENTE'),
            'Completa o cancela las órdenes pendientes antes de sustituir la estrategia'
          );
          await update(client, 'saeplan_mant', 'id_plan', replaceId, {
            estado: 'INACTIVO',
            fecha_fin: input.fecha_inicio,
          });
        }
        const { reglas, condicion, ...plan } = input;
        const id = await insert(client, 'saeplan_mant', 'id_plan', { ...plan, estado: 'ACTIVO' });
        for (let i = 0; i < reglas.length; i++)
          await insert(client, 'saeregl_mant', 'id_regla', {
            ...reglas[i],
            id_plan: id,
            condicion,
            orden_eval: i + 1,
            estado: true,
          });
        return id;
      },
      replaceId ? 'plan.replace' : 'plan.create'
    );
  }
  planState(actor: User, revision: number, id: string, body: unknown) {
    const input = planStateInput.parse(body);
    return this.write(
      actor,
      revision,
      'plans.state',
      async (client, data) => {
        const plan = visible(data.plans.find(p => p.id_plan === id));
        if (input.estado === 'ACTIVO') {
          enabledAsset(data, plan.id_activo);
          requireValue(
            !plan.fecha_fin || plan.fecha_fin >= businessDay(),
            'El plan terminó; crea una estrategia nueva'
          );
        }
        return update(client, 'saeplan_mant', 'id_plan', id, input);
      },
      'plan.state'
    );
  }
  order(actor: User, revision: number, body: unknown) {
    const input = orderInput.parse(body);
    return this.write(
      actor,
      revision,
      'orders.create',
      async (client, data) => {
        const plan = visible(data.plans.find(p => p.id_plan === input.id_plan));
        enabledAsset(data, plan.id_activo);
        requireValue(plan.estado === 'ACTIVO', 'Selecciona un plan activo');
        if (input.fecha_programada)
          requireValue(
            input.fecha_programada >= plan.fecha_inicio &&
              (!plan.fecha_fin || input.fecha_programada <= plan.fecha_fin),
            'La fecha programada está fuera de la vigencia del plan'
          );
        return insert(client, 'saeordm_mant', 'id_ordm', { ...input, estado: 'PENDIENTE' });
      },
      'order.create'
    );
  }
  cancel(actor: User, revision: number, id: string) {
    return this.write(
      actor,
      revision,
      'orders.cancel',
      async (client, data) => {
        const order = visible(data.orders.find(o => o.id_ordm === id));
        requireValue(order.estado === 'PENDIENTE', 'Solo puedes cancelar una orden pendiente');
        return update(client, 'saeordm_mant', 'id_ordm', id, { estado: 'CANCELADO' });
      },
      'order.cancel'
    );
  }
  complete(actor: User, revision: number, id: string, body: unknown) {
    const input = completionInput.parse(body);
    input.fecha_realizada = stamp(input.fecha_realizada);
    return this.write(
      actor,
      revision,
      'orders.complete',
      async (client, data) => {
        const order = visible(data.orders.find(o => o.id_ordm === id));
        requireValue(order.estado === 'PENDIENTE', 'La orden ya fue realizada o cancelada');
        const plan = visible(data.plans.find(p => p.id_plan === order.id_plan));
        enabledAsset(data, plan.id_activo);
        requireValue(plan.estado === 'ACTIVO', 'No puedes completar una orden de un plan inactivo');
        const date = input.fecha_realizada.slice(0, 10);
        requireValue(
          date >= plan.fecha_inicio &&
            (!plan.fecha_fin || date <= plan.fecha_fin) &&
            date <= businessDay(),
          'La ejecución debe estar dentro de la vigencia y no puede estar en el futuro'
        );
        const last = latestExecution(data, plan.id_plan);
        requireValue(
          !last || input.fecha_realizada > stamp(last.fecha_realizada!),
          'La ejecución debe ser posterior al último servicio válido'
        );
        const rules = data.rules.filter(r => r.id_plan === plan.id_plan && r.estado);
        requireValue(
          rules.length && new Set(rules.map(r => r.condicion)).size === 1,
          'El plan requiere reglas activas con condición uniforme'
        );
        const meterIds = new Set(rules.filter(r => r.id_medidor).map(r => r.id_medidor!));
        requireValue(
          meterIds.size <= 1,
          'Este modelo no permite completar planes con varios medidores: falta detalle de ejecución por regla'
        );
        for (const rule of rules) {
          const unit = data.units.find(u => u.id_um === rule.id_um);
          requireValue(unit, 'La regla referencia una unidad inexistente');
          if (unit.tipo_control === 'MEDIDOR') {
            const meter = data.meters.find(m => m.id_medidor === rule.id_medidor);
            requireValue(
              meter?.estado &&
                unit.estado &&
                meter.id_activo === plan.id_activo &&
                meter.id_um === rule.id_um &&
                rule.valor_base !== null,
              'El medidor y unidad de la regla deben estar activos y corresponder al activo'
            );
          } else
            requireValue(
              rule.id_medidor === null &&
                ['DIA', 'MES'].includes(unit.codigo) &&
                Number.isInteger(Number(rule.frecuencia)),
              'Regla calendario inválida'
            );
        }
        if (meterIds.size) {
          requireValue(input.valor_realizado !== null, 'Registra la lectura de ejecución');
          const value = cents(input.valor_realizado);
          const observed = data.readings
            .filter(
              r =>
                !r.anulacion &&
                meterIds.has(r.id_medidor) &&
                stamp(r.fecha_lectura) <= input.fecha_realizada
            )
            .sort((a, b) => stamp(b.fecha_lectura).localeCompare(stamp(a.fecha_lectura)))[0];
          requireValue(
            observed && cents(observed.valor) === value,
            'La lectura del servicio debe coincidir con la última lectura registrada a esa fecha; registra primero la lectura exacta'
          );
          for (const rule of rules.filter(r => r.id_medidor))
            requireValue(
              value >= cents(last?.valor_realizado ?? rule.valor_base!),
              'La lectura del servicio no puede retroceder respecto al ciclo anterior'
            );
        } else
          requireValue(
            input.valor_realizado === null,
            'Una ejecución calendario no lleva lectura numérica'
          );
        requireValue(
          new Set(input.detalles.map(d => d.id_repu)).size === input.detalles.length,
          'Agrupa las cantidades de cada repuesto en una única línea'
        );
        for (const detail of input.detalles) {
          requireValue(
            data.parts.some(p => p.id_repu === detail.id_repu && p.estado),
            'Selecciona repuestos activos'
          );
          const total = subtotal(detail.cantidad, detail.costo_unitario);
          requireValue(amount.safeParse(total).success, 'El subtotal excede NUMERIC(14,2)');
          await insert(client, 'saedetm_mant', 'id_detm', {
            ...detail,
            id_ordm: id,
            subtotal: total,
          });
        }
        const { detalles, ...orderValues } = input;
        void detalles;
        // Deliberately do NOT update saeregl_mant.valor_base or saeplan_mant.fecha_inicio.
        return update(client, 'saeordm_mant', 'id_ordm', id, {
          ...orderValues,
          estado: 'REALIZADA',
        });
      },
      'order.complete'
    );
  }
}
