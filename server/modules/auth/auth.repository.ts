import type { Database } from '../../database.ts';
import type { ConnectionDefinition } from '../../connections.ts';
import { ensureAuthStorage } from '../../migrate.ts';
export type Credential = {
  id: number;
  username: string;
  password: string;
  profile: string;
  enabled: boolean | string | number;
  valid: boolean;
  sae_valid: boolean;
  companyId?: number;
  branchId?: number;
  sessionMinutes?: number;
};
export class AuthRepository {
  constructor(
    private db: Database,
    private definition: ConnectionDefinition
  ) {}
  private async lookup(value: string | number, byId: boolean) {
    const sae = this.definition.authMode === 'sae';
    const combined = this.definition.authMode === 'combined';
    const sql = sae
      ? `SELECT usua_cod_usua AS id, usua_nom_usua AS username, usua_pas_usua AS password,
          usua_cod_usua AS profile, usua_cod_sucu AS "branchId", true AS enabled,
          (usua_fec_cadu IS NULL OR usua_fec_cadu::date >= CURRENT_DATE) AS valid, true AS sae_valid
         FROM public.saeusua WHERE ${byId ? 'usua_cod_usua = $1' : 'lower(usua_nom_usua) = lower($1)'}`
      : `SELECT u.usuario_id AS id, u.usuario_user AS username, u.usuario_password AS password,
          u.perfil_id AS profile, u.empresa_id AS "companyId", u.sucursal_id AS "branchId",
          u.usuario_tiempo_sesion AS "sessionMinutes", u.usuario_activo AS enabled,
          (u.usuario_fecha_caduca IS NULL OR u.usuario_fecha_caduca::date >= CURRENT_DATE) AS valid,
          ${combined ? '(s.usua_cod_usua IS NOT NULL AND (s.usua_fec_cadu IS NULL OR s.usua_fec_cadu::date >= CURRENT_DATE))' : 'true'} AS sae_valid
         FROM comercial.usuario u ${combined ? 'LEFT JOIN public.saeusua s ON s.usua_cod_usua = u.usua_cod_usua' : ''}
         WHERE ${byId ? 'u.usuario_id = $1' : 'lower(u.usuario_user) = lower($1)'}`;
    const { rows } = await this.db.query(sql, [value]);
    return rows.length === 1 ? (rows[0] as Credential) : undefined;
  }
  byName(name: string) {
    return this.lookup(name, false);
  }
  byId(id: number) {
    return this.lookup(id, true);
  }
  prepareSessions() {
    return ensureAuthStorage(this.db);
  }
  async session(token: string): Promise<{ user_id: string } | undefined> {
    try {
      return (
        await this.db.query('SELECT user_id FROM sismant.sessions WHERE token=$1 AND expires>$2', [
          token,
          Date.now(),
        ])
      ).rows[0];
    } catch (error) {
      if (['42P01', '3F000'].includes((error as { code?: string })?.code ?? '')) return undefined;
      throw error;
    }
  }
  async addSession(token: string, user: number, expires: number) {
    await this.db.query('DELETE FROM sismant.sessions WHERE expires <= $1', [Date.now()]);
    await this.db.query('INSERT INTO sismant.sessions(token,user_id,expires) VALUES($1,$2,$3)', [
      token,
      user,
      expires,
    ]);
  }
  async removeSession(token: string) {
    try {
      await this.db.query('DELETE FROM sismant.sessions WHERE token=$1', [token]);
    } catch (error) {
      if (!['42P01', '3F000'].includes((error as { code?: string })?.code ?? '')) throw error;
    }
  }
}
