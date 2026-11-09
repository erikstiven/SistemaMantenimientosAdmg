import { pgId } from '../shared/relational.ts';
import type { Queryable } from './modules/maintenance/relational.repository.ts';
import { AppError } from './shared/errors.ts';
export type AssetIdentity = {
  id_activo: string;
  connectionId: string;
  empresaId: string;
  sucursalId: string;
  actCodAct: string;
};
// Optional overrides for identities already assigned by an external integration/dataset.
// Otherwise a persistent identity is allocated automatically within assetNamespace.
export const ASSET_IDENTITIES: AssetIdentity[] = [];
export function assetIdentities(connectionId: string) {
  const ids = new Set<string>(),
    keys = new Set<string>();
  for (const mapping of ASSET_IDENTITIES) {
    pgId.parse(mapping.id_activo);
    const key = JSON.stringify([
      mapping.connectionId,
      mapping.empresaId,
      mapping.sucursalId,
      mapping.actCodAct,
    ]);
    if (ids.has(mapping.id_activo) || keys.has(key))
      throw new Error('Identidad global de activo duplicada');
    ids.add(mapping.id_activo);
    keys.add(key);
  }
  return ASSET_IDENTITIES.filter(mapping => mapping.connectionId === connectionId);
}
const block = 4398046511104n;
export async function persistentAssetIdentity(
  client: Queryable,
  source: Omit<AssetIdentity, 'id_activo'>,
  namespace: number
) {
  const values = [source.connectionId, source.empresaId, source.sucursalId, source.actCodAct];
  const lookup =
    'SELECT global_id::text,namespace FROM sismant.asset_identity WHERE connection_id=$1 AND empresa_id=$2 AND sucursal_id=$3 AND act_cod_act=$4';
  const existing = (await client.query(lookup, values)).rows[0];
  if (existing) {
    if (String(existing.namespace) !== String(namespace))
      throw new AppError(
        503,
        'El espacio de identidades de la conexión cambió. Restaura assetNamespace para preservar las referencias existentes.',
        'ASSET_NAMESPACE_CHANGED'
      );
    return existing.global_id as string;
  }
  const {
    rows: [allocated],
  } = await client.query("SELECT nextval('sismant.asset_identity_seq')::text AS local_id");
  const local = BigInt(allocated.local_id);
  if (local <= 0n || local >= block)
    throw new AppError(503, 'Se agotó el espacio de identidades de esta conexión');
  const global = (BigInt(namespace) * block + local).toString();
  pgId.parse(global);
  await client.query(
    `INSERT INTO sismant.asset_identity(global_id,local_id,namespace,connection_id,empresa_id,sucursal_id,act_cod_act)
    VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(connection_id,empresa_id,sucursal_id,act_cod_act) DO NOTHING`,
    [global, local.toString(), namespace, ...values]
  );
  const resolved = (await client.query(lookup, values)).rows[0];
  if (!resolved || String(resolved.namespace) !== String(namespace))
    throw new AppError(
      503,
      'La correspondencia de identidad cambió mientras se resolvía el activo'
    );
  return resolved.global_id as string;
}
