import { z } from 'zod';
import type { PoolClient } from 'pg';
import type { User } from '../../../shared/state.ts';
import {
  pgId,
  type RelationalData,
  type ExternalAsset,
  type MaintenanceBootstrap,
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
  })
  .strict();
export class RelationalRepository {
  constructor(
    readonly db: Database,
    readonly definition: ConnectionDefinition
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
        const mappings = assetIdentities(this.definition.id);
        const byKey = new Map(
          mappings.map(m => [JSON.stringify([m.empresaId, m.sucursalId, m.actCodAct]), m])
        );
        const { rows } = await client.query(
          `SELECT act_cod_act::text,act_cod_empr::text,act_cod_sucu::text,act_nom_act,COALESCE(act_clave_act,'') AS clave,COALESCE(tact_cod_tact::text,'') AS tipo,act_usa_mant
          FROM public.saeact WHERE act_cod_empr=$1 ${this.companyScope(actor) ? '' : 'AND act_cod_sucu=$2'} ORDER BY act_cod_sucu,act_cod_act LIMIT 20001`,
          this.companyScope(actor)
            ? [String(actor.companyId)]
            : [String(actor.companyId), String(actor.branchId)]
        );
        if (rows.length > 20000) throw new AppError(413, 'Demasiados activos para esta consulta');
        const assets: ExternalAsset[] = [];
        let missing = 0;
        for (const row of rows) {
          let mapping = byKey.get(
            JSON.stringify([row.act_cod_empr, row.act_cod_sucu, row.act_cod_act])
          );
          if (!mapping && this.definition.assetNamespace !== undefined) {
            const source = {
              connectionId: this.definition.id,
              empresaId: row.act_cod_empr,
              sucursalId: row.act_cod_sucu,
              actCodAct: row.act_cod_act,
            };
            if (row.act_usa_mant === 'S')
              mapping = {
                ...source,
                id_activo: await persistentAssetIdentity(
                  client,
                  source,
                  this.definition.assetNamespace
                ),
              };
            else {
              const old = (
                await client.query(
                  'SELECT global_id::text,namespace FROM sismant.asset_identity WHERE connection_id=$1 AND empresa_id=$2 AND sucursal_id=$3 AND act_cod_act=$4',
                  [source.connectionId, source.empresaId, source.sucursalId, source.actCodAct]
                )
              ).rows[0];
              if (old) {
                if (String(old.namespace) !== String(this.definition.assetNamespace))
                  throw new AppError(
                    503,
                    'Restaura el assetNamespace original para preservar las referencias existentes',
                    'ASSET_NAMESPACE_CHANGED'
                  );
                mapping = { ...source, id_activo: old.global_id };
              }
            }
          }
          if (!mapping) {
            if (row.act_usa_mant === 'S') missing++;
            continue;
          }
          assets.push(
            assetSchema.parse({
              id_activo: mapping.id_activo,
              conexion_erp: this.definition.id,
              empresa_id: row.act_cod_empr,
              sucursal_id: row.act_cod_sucu,
              act_cod_act: row.act_cod_act,
              clave: row.clave,
              nombre: row.act_nom_act,
              tipo: row.tipo,
              act_usa_mant: row.act_usa_mant,
            })
          );
        }
        return {
          assets,
          warnings: missing
            ? [
                `${missing} activos seleccionados en el ERP todavía no tienen identidad global configurada. No podrán utilizarse hasta completar la correspondencia de la integración.`,
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
    const readings = await scoped(
      'saelect_mant',
      "id_lectura::text,id_medidor::text,fecha_lectura,valor::text,COALESCE(observacion,'') AS observacion",
      'id_medidor',
      meters.map(m => String(m.id_medidor))
    );
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
    const audit = await client.query(
      `SELECT id::text,connection_id,user_id::text,operation,entity_id::text,created_at
      FROM sismant.maintenance_audit WHERE connection_id=$1 AND company_id=$2 ${this.companyScope(actor) ? '' : 'AND branch_id=$3'} ORDER BY id DESC LIMIT 200`,
      this.companyScope(actor)
        ? [actor.connectionId, String(actor.companyId)]
        : [actor.connectionId, String(actor.companyId), String(actor.branchId)]
    );
    return {
      revision: revision.rows[0].revision,
      warnings,
      assets,
      units,
      types,
      parts,
      meters,
      plans,
      readings,
      rules,
      orders,
      details,
      audit: dates(audit.rows),
    } as RelationalData;
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
        'audit',
      ] as const)
        if (!permissions.includes(`${key}.read`)) result[key] = [];
      if (!permissions.includes('plans.read')) result.rules = [];
      if (!permissions.includes('orders.read') || !permissions.includes('parts.read'))
        result.details = [];
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
    work: (client: PoolClient, data: RelationalData) => Promise<string | null>
  ) {
    await ensureMaintenanceStorage(this.db);
    const client = await this.db.connect();
    try {
      await client.query('BEGIN');
      const result = await client.query(
        'UPDATE sismant.maintenance_revision SET revision=revision+1 WHERE id=1 AND revision=$1',
        [revision]
      );
      if (actor.role !== 'admin') {
        const policies = await this.rolePermissions(client, actor);
        if (!effectivePermissions(policies[actor.role]).includes(permission))
          throw new AppError(403, 'No tienes permiso para esta operación');
      }
      if (!result.rowCount)
        throw new AppError(
          409,
          'Otro usuario modificó los datos. Recarga antes de guardar',
          'REVISION_CONFLICT'
        );
      const data = await this.read(client, actor);
      const entity = await work(client, data);
      await client.query(
        `INSERT INTO sismant.maintenance_audit(connection_id,user_id,company_id,branch_id,revision,operation,entity_id)
        VALUES($1,$2,$3,$4,$5,$6,$7)`,
        [
          actor.connectionId,
          actor.id,
          String(actor.companyId),
          String(actor.branchId),
          revision + 1,
          operation,
          entity,
        ]
      );
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
