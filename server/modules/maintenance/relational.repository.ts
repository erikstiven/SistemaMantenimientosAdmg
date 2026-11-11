import { z } from 'zod';
import type { PoolClient } from 'pg';
import type { User } from '../../../shared/state.ts';
import {
  pgId,
  type RelationalData,
  type ExternalAsset,
  type MaintenanceBootstrap,
  type AuditRow,
} from '../../../shared/relational.ts';
import {
  configurablePermissions,
  defaultPermissions,
  effectivePermissions,
  type ManagedRole,
  type Permission,
} from '../../../shared/permissions.ts';
import type { ConnectionDefinition } from '../../connections.ts';
import type { Database } from '../../database.ts';
import { AppError } from '../../shared/errors.ts';
import { assetIdentities, persistentAssetIdentity } from '../../asset-identities.ts';
import { ensureMaintenanceStorage } from '../../migrate.ts';
import { AuthRepository } from '../auth/auth.repository.ts';
import { auditStates, visibleAuditState, type AuditTrace } from './maintenance-audit.ts';
export type Queryable = Pick<Database, 'query'>;
function dates(rows: Record<string, unknown>[]) {
  for (const row of rows)
    for (const key of [
      'fecha_inicio',
      'fecha_fin',
      'fecha_programada',
      'fecha_lectura',
      'fecha_realizada',
      'created_at',
    ]) {
      const value = row[key];
      if (value instanceof Date)
        row[key] = value
          .toISOString()
          .slice(0, ['fecha_inicio', 'fecha_fin', 'fecha_programada'].includes(key) ? 10 : 19);
      else if (typeof value === 'string' && ['fecha_lectura', 'fecha_realizada'].includes(key))
        row[key] = value.replace(' ', 'T');
    }
  return rows;
}
const assetSchema = z
  .object({
    id_activo: pgId,
    conexion_erp: z.string().min(1),
    empresa_id: pgId,
    sucursal_id: pgId,
    act_cod_act: z.string().min(1),
    clave: z.string().default(''),
    nombre: z.string().min(1),
    tipo: z.string(),
    act_usa_mant: z.enum(['S', 'N']),
    act_fcmp_act: z.string().nullable().optional(),
  })
  .strict();
export class RelationalRepository {
  constructor(
    readonly db: Database,
    readonly definition: ConnectionDefinition,
    private readonly authDb = db
  ) {}
  private companyScope(actor: User) {
    return actor.role === 'admin' && this.definition.adminAssetScope === 'company';
  }
  async assets(
    client: Queryable,
    actor: User
  ): Promise<{ assets: ExternalAsset[]; warnings: string[] }> {
    const view = this.definition.assetIntegrationView;
    if (view && !/^[a-z_][a-z0-9_]*\.[a-z_][a-z0-9_]*$/.test(view))
      throw new AppError(503, 'Vista de integración inválida');
    if (actor.companyId == null || actor.branchId == null)
      throw new AppError(403, 'La cuenta necesita empresa y sucursal para acceder a mantenimiento');
    try {
      if (!view) {
        const namespace = this.definition.assetNamespace;
        const mappings = assetIdentities(this.definition.id);
        const byKey = new Map(
          mappings.map(m => [JSON.stringify([m.empresaId, m.sucursalId, m.actCodAct]), m])
        );
        const { rows } = await client.query(
          `SELECT act_cod_act::text,act_cod_empr::text,act_cod_sucu::text,act_nom_act,COALESCE(act_clave_act,'') AS clave,COALESCE(tact_cod_tact::text,'') AS tipo,COALESCE(act_usa_mant,'N') AS act_usa_mant,act_fcmp_act
          FROM public.saeact WHERE act_cod_empr=$1 ${this.companyScope(actor) ? '' : 'AND act_cod_sucu=$2'} ORDER BY act_cod_sucu,act_cod_act LIMIT 20001`,
          this.companyScope(actor)
            ? [String(actor.companyId)]
            : [String(actor.companyId), String(actor.branchId)]
        );
        if (rows.length > 20000) throw new AppError(413, 'Demasiados activos para esta consulta');
        const stored =
          namespace === undefined
            ? []
            : (
                await client.query(
                  `SELECT global_id::text,namespace,empresa_id::text,sucursal_id::text,act_cod_act::text
             FROM sismant.asset_identity WHERE connection_id=$1 AND empresa_id=$2
             ${this.companyScope(actor) ? '' : 'AND sucursal_id=$3'}`,
                  this.companyScope(actor)
                    ? [this.definition.id, String(actor.companyId)]
                    : [this.definition.id, String(actor.companyId), String(actor.branchId)]
                )
              ).rows;
        const storedByKey = new Map(
          stored.map(row => [
            JSON.stringify([row.empresa_id, row.sucursal_id, row.act_cod_act]),
            row,
          ])
        );
        const assets: ExternalAsset[] = [];
        let missing = 0;
        for (const row of rows) {
          const key = JSON.stringify([row.act_cod_empr, row.act_cod_sucu, row.act_cod_act]);
          let id = byKey.get(key)?.id_activo;
          if (!id && namespace !== undefined) {
            const stored = storedByKey.get(key);
            if (stored && String(stored.namespace) !== String(namespace))
              throw new AppError(
                503,
                'Restaura el assetNamespace original para preservar las referencias existentes',
                'ASSET_NAMESPACE_CHANGED'
              );
            const source = {
              connectionId: this.definition.id,
              empresaId: row.act_cod_empr,
              sucursalId: row.act_cod_sucu,
              actCodAct: row.act_cod_act,
            };
            id = stored?.global_id ?? (await persistentAssetIdentity(client, source, namespace));
          }
          if (!id) {
            missing++;
            continue;
          }
          assets.push(
            assetSchema.parse({
              id_activo: id,
              conexion_erp: this.definition.id,
              empresa_id: row.act_cod_empr,
              sucursal_id: row.act_cod_sucu,
              act_cod_act: row.act_cod_act,
              clave: row.clave,
              nombre: row.act_nom_act,
              tipo: row.tipo,
              act_usa_mant: row.act_usa_mant,
              act_fcmp_act: row.act_fcmp_act
                ? row.act_fcmp_act instanceof Date
                  ? row.act_fcmp_act.toISOString().slice(0, 10)
                  : String(row.act_fcmp_act).slice(0, 10)
                : null,
            })
          );
        }
        return {
          assets,
          warnings: missing
            ? [
                `${missing} activos del ERP requieren una identidad global. Configura el espacio de identidades o completa sus correspondencias.`,
              ]
            : [],
        };
      }
      const duplicates = await client.query(
        `SELECT id_activo FROM (SELECT id_activo,COUNT(*) AS copies FROM ${view} GROUP BY id_activo) identities WHERE copies>1 LIMIT 1`
      );
      if (duplicates.rows.length)
        throw new AppError(
          503,
          'La integración devuelve identidades globales duplicadas',
          'AMBIGUOUS_ASSET_IDENTITY'
        );
      const result = await client.query(
        `SELECT id_activo::text,conexion_erp,empresa_id::text,sucursal_id::text,
        act_cod_act::text,nombre,tipo,act_usa_mant FROM ${view}
        WHERE conexion_erp=$1 AND empresa_id=$2 ${this.companyScope(actor) ? '' : 'AND sucursal_id=$3'} ORDER BY id_activo LIMIT 20001`,
        this.companyScope(actor)
          ? [actor.connectionId, String(actor.companyId)]
          : [actor.connectionId, String(actor.companyId), String(actor.branchId)]
      );
      if (result.rows.length > 20000)
        throw new AppError(
          413,
          'Demasiados activos para esta consulta; se requiere paginación de la integración'
        );
      return { assets: z.array(assetSchema).parse(result.rows), warnings: [] };
    } catch (error) {
      if (error instanceof AppError) throw error;
      if (!view && (error as { code?: string })?.code === '42703')
        throw new AppError(
          503,
          'El ERP necesita el campo act_usa_mant. Ejecuta el script de preparación del catálogo de activos.',
          'ERP_ASSET_FLAG_MISSING'
        );
      throw new AppError(
        503,
        'La integración de activos no está disponible o no cumple el contrato global',
        'ASSET_INTEGRATION_UNAVAILABLE'
      );
    }
  }
  async read(client: Queryable, actor: User): Promise<RelationalData> {
    const { assets, warnings } = await this.assets(client, actor);
    const revision = await client.query(
      'SELECT revision FROM sismant.maintenance_revision WHERE id=1'
    );
    if (!revision.rows.length)
      throw new AppError(503, 'Inicializa el esquema de soporte de mantenimiento');
    const all = async (table: string, columns: string) => {
      const { rows } = await client.query(`SELECT ${columns} FROM public.${table} LIMIT 20001`);
      if (rows.length > 20000)
        throw new AppError(413, 'Demasiados registros; se requiere una consulta paginada');
      return dates(rows);
    };
    const scoped = async (table: string, columns: string, key: string, ids: string[]) => {
      if (!ids.length) return [];
      const { rows } = await client.query(
        `SELECT ${columns} FROM public.${table} WHERE ${key} IN (${ids.map((_, i) => '$' + (i + 1)).join(',')}) LIMIT 20001`,
        ids
      );
      if (rows.length > 20000)
        throw new AppError(413, 'Demasiados registros; se requiere una consulta paginada');
      return dates(rows);
    };
    const units = await all('saeumd_mant', 'id_um::text,codigo,nombre,tipo_control,estado');
    const types = await all(
      'saetima_mant',
      "id_tima::text,nombre,COALESCE(descripcion,'') AS descripcion,estado"
    );
    const parts = await all(
      'saerepu_mant',
      'id_repu::text,codigo,nombre,unidad_medida,costo_referencia::text,estado'
    );
    const ids = assets.map(a => a.id_activo);
    const meters = await scoped(
      'saemedi_mant',
      'id_medidor::text,id_activo::text,id_um::text,codigo,nombre_medidor,estado',
      'id_activo',
      ids
    );
    const plans = await scoped(
      'saeplan_mant',
      "id_plan::text,id_activo::text,id_tima::text,estado,nombre_plan,fecha_inicio,fecha_fin,COALESCE(observacion,'') AS observacion",
      'id_activo',
      ids
    );
    const schema = await client.query(
      `SELECT table_name,column_name FROM information_schema.columns
       WHERE table_schema='public' AND
       ((table_name='saelect_mant' AND column_name='id_tima') OR
        (table_name='saemedt_mant' AND column_name IN ('id_medidor','id_tima','estado')))`
    );
    const meterTypesReady = schema.rows.length === 4;
    const meterTypes = meterTypesReady
      ? await scoped(
          'saemedt_mant',
          'id_medidor::text,id_tima::text,estado',
          'id_medidor',
          meters.map(m => String(m.id_medidor))
        )
      : [];
    if (!meterTypesReady)
      warnings.push(
        actor.role === 'admin'
          ? 'Aplica el script 004 para habilitar las medidas independientes por tipo de mantenimiento.'
          : 'El administrador debe actualizar la base de mantenimiento para habilitar las medidas por tipo.'
      );
    const readings = await scoped(
      'saelect_mant',
      `id_lectura::text,id_medidor::text,${meterTypesReady ? 'id_tima::text' : 'NULL::text AS id_tima'},fecha_lectura,valor::text,COALESCE(observacion,'') AS observacion`,
      'id_medidor',
      meters.map(m => String(m.id_medidor))
    );
    if (readings.length) {
      // The audit entry is also the durable marker for a voided reading.
      const { rows } = await client.query(
        `SELECT entity_id::text,user_id::text,user_name,created_at
         FROM sismant.maintenance_audit WHERE operation='reading.void'
         AND entity_id IN (${readings.map((_, i) => '$' + (i + 1)).join(',')})`,
        readings.map(r => r.id_lectura)
      );
      const voids = new Map(rows.map(row => [row.entity_id, row]));
      for (const reading of readings) {
        const row = voids.get(reading.id_lectura);
        if (row)
          reading.anulacion = {
            usuario: row.user_id,
            nombre_usuario: row.user_name ?? undefined,
            fecha: new Date(row.created_at).toISOString(),
          };
      }
    }
    const rules = await scoped(
      'saeregl_mant',
      'id_regla::text,id_plan::text,id_medidor::text,id_um::text,frecuencia::text,valor_base::text,COALESCE(alerta_antes,0)::text AS alerta_antes,condicion,orden_eval,estado',
      'id_plan',
      plans.map(p => String(p.id_plan))
    );
    const orders = await scoped(
      'saeordm_mant',
      "id_ordm::text,id_plan::text,fecha_programada,fecha_realizada,valor_programado::text,valor_realizado::text,estado,COALESCE(observacion,'') AS observacion",
      'id_plan',
      plans.map(p => String(p.id_plan))
    );
    const details = await scoped(
      'saedetm_mant',
      'id_detm::text,id_ordm::text,id_repu::text,cantidad::text,costo_unitario::text,subtotal::text',
      'id_ordm',
      orders.map(o => String(o.id_ordm))
    );
    return {
      revision: revision.rows[0].revision,
      warnings,
      assets,
      units,
      types,
      parts,
      meters,
      meterTypes,
      meterTypesReady,
      plans,
      readings,
      rules,
      orders,
      details,
      audit: [] as AuditRow[],
    } as RelationalData;
  }
  private async readAudit(
    client: Queryable,
    actor: User,
    permissions: Permission[]
  ): Promise<AuditRow[]> {
    const { rows } = await client.query(
      `SELECT id::text,connection_id,user_id::text,user_name,operation,entity_id::text,
        created_at,before_state,after_state
       FROM sismant.maintenance_audit
       WHERE connection_id=$1 AND company_id=$2 ${this.companyScope(actor) ? '' : 'AND branch_id=$3'}
       ORDER BY id DESC LIMIT 200`,
      this.companyScope(actor)
        ? [actor.connectionId, String(actor.companyId)]
        : [actor.connectionId, String(actor.companyId), String(actor.branchId)]
    );
    const ids = [...new Set<string>(rows.filter(row => !row.user_name).map(row => row.user_id))];
    const names = await this.userNames(client, ids);
    return rows.map(row => ({
      ...row,
      user_name: row.user_name || names.get(row.user_id) || null,
      created_at: new Date(row.created_at).toISOString(),
      before_state: visibleAuditState(row.before_state, row.operation, permissions),
      after_state: visibleAuditState(row.after_state, row.operation, permissions),
    })) as AuditRow[];
  }
  private userNames(client: Queryable, ids: string[]) {
    return new AuthRepository(this.authDb, this.definition).userNames(
      ids,
      this.authDb === this.db ? client : this.authDb
    );
  }
  async orderPlanningObservation(actor: User, orderId: string) {
    const { rows } = await this.db.query(
      `SELECT operation,before_state,after_state FROM sismant.maintenance_audit
       WHERE connection_id=$1 AND company_id=$2 AND entity_id=$3
         AND operation IN ('order.create','order.complete')
       ORDER BY id DESC LIMIT 2`,
      [actor.connectionId, String(actor.companyId), orderId]
    );
    for (const row of rows) {
      const state = row.operation === 'order.complete' ? row.before_state : row.after_state;
      if (typeof state?.observacion === 'string') return state.observacion;
    }
  }
  async snapshot(actor: User) {
    await ensureMaintenanceStorage(this.db);
    const client = await this.db.connect();
    try {
      await client.query('BEGIN');
      await client.query('SELECT revision FROM sismant.maintenance_revision WHERE id=1 FOR SHARE');
      const policies = await this.rolePermissions(client, actor);
      const permissions = effectivePermissions(
        actor.role === 'admin' ? defaultPermissions('admin') : policies[actor.role]
      );
      const result: MaintenanceBootstrap = {
        ...(await this.read(client, actor)),
        permissions,
        ...(actor.role === 'admin' ? { rolePermissions: policies } : {}),
      };
      for (const key of [
        'assets',
        'meters',
        'readings',
        'plans',
        'orders',
        'parts',
        'units',
        'types',
      ] as const)
        if (!permissions.includes(`${key}.read`)) result[key] = [];
      if (!permissions.includes('plans.read')) result.rules = [];
      if (!permissions.includes('meters.read')) result.meterTypes = [];
      if (!permissions.includes('orders.read') || !permissions.includes('parts.read'))
        result.details = [];
      const unknownNames = result.readings.flatMap(reading =>
        reading.anulacion && !reading.anulacion.nombre_usuario ? [reading.anulacion] : []
      );
      if (unknownNames.length) {
        const names = await this.userNames(client, [
          ...new Set(unknownNames.map(row => row.usuario)),
        ]);
        for (const row of unknownNames) row.nombre_usuario = names.get(row.usuario);
      }
      if (permissions.includes('audit.read'))
        result.audit = await this.readAudit(client, actor, permissions);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
  async rolePermissions(client: Queryable, actor: User) {
    const policies = {
      technician: defaultPermissions('technician'),
      viewer: defaultPermissions('viewer'),
    };
    const { rows } = await client.query(
      'SELECT role, permissions FROM sismant.maintenance_role_permissions WHERE connection_id=$1 AND company_id=$2',
      [actor.connectionId, actor.companyId]
    );
    for (const row of rows) {
      if ((row.role === 'technician' || row.role === 'viewer') && Array.isArray(row.permissions))
        policies[row.role as ManagedRole] = configurablePermissions.filter(permission =>
          row.permissions.includes(permission)
        );
    }
    return policies;
  }
  async mutate(
    actor: User,
    revision: number,
    operation: string,
    permission: Permission,
    work: (
      client: PoolClient,
      data: RelationalData,
      trace: AuditTrace,
      permissions: Permission[]
    ) => Promise<string | null>
  ) {
    await ensureMaintenanceStorage(this.db);
    const client = await this.db.connect();
    try {
      await client.query('BEGIN');
      const result = await client.query(
        'UPDATE sismant.maintenance_revision SET revision=revision+1 WHERE id=1 AND revision=$1',
        [revision]
      );
      const permissions =
        actor.role === 'admin'
          ? defaultPermissions('admin')
          : effectivePermissions((await this.rolePermissions(client, actor))[actor.role]);
      if (!permissions.includes(permission))
        throw new AppError(403, 'No tienes permiso para esta operación');
      if (!result.rowCount)
        throw new AppError(
          409,
          'Otro usuario modificó los datos. Recarga antes de guardar',
          'REVISION_CONFLICT'
        );
      const data = await this.read(client, actor);
      const trace: AuditTrace = {};
      const entity = await work(client, data, trace, permissions);
      const audit = async (action: string, entityId: string | null, entry: AuditTrace = {}) => {
        const { before, after } = await auditStates(client, data, action, entityId, entry);
        await client.query(
          `INSERT INTO sismant.maintenance_audit(connection_id,user_id,company_id,branch_id,revision,
          operation,entity_id,user_name,before_state,after_state)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10::jsonb)`,
          [
            actor.connectionId,
            actor.id,
            String(actor.companyId),
            String(actor.branchId),
            revision + 1,
            action,
            entityId,
            actor.username,
            before ? JSON.stringify(before) : null,
            after ? JSON.stringify(after) : null,
          ]
        );
      };
      if (trace.related) await audit(trace.related.operation, trace.related.id);
      await audit(operation, entity, trace);
      await client.query('COMMIT');
      return { id: entity, revision: revision + 1 };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}
