import { newDb, DataType } from 'pg-mem';
import { readFile } from 'node:fs/promises';
import { hash } from 'bcryptjs';
import type { Config } from '../config.ts';
import { Databases, type Database } from '../database.ts';
import { migrateDatabase } from '../migrate.ts';
import { hashPassword } from '../modules/auth/auth.service.ts';
export const password = 'test-password-123456';
export const config: Config = {
  NODE_ENV: 'test',
  PORT: 3001,
  HOST: '127.0.0.1',
  APP_ORIGIN: 'http://localhost:5174',
  SEED_DEMO: 'true',
  SESSION_HOURS: 8,
  connections: [
    {
      id: 'principal',
      assetIntegrationView: 'integration.maintenance_assets',
      label: 'Principal',
      urlEnv: 'TEST_PG_A_URL',
      authMode: 'combined',
      passwordFormat: 'bcrypt',
      roles: { '1': 'admin', '2': 'technician', '3': 'viewer' },
    },
    {
      id: 'segunda',
      assetIntegrationView: 'integration.maintenance_assets',
      label: 'Segunda',
      urlEnv: 'TEST_PG_B_URL',
      authMode: 'combined',
      passwordFormat: 'bcrypt',
      roles: { '1': 'admin', '2': 'technician', '3': 'viewer' },
    },
    {
      id: 'sae',
      assetIntegrationView: 'integration.maintenance_assets',
      label: 'SAE',
      urlEnv: 'TEST_PG_SAE_URL',
      authMode: 'sae',
      passwordFormat: 'scrypt',
      roles: { '1': 'viewer' },
    },
  ],
};
export async function seedUser(db: Database, username: string, role: string, secret = password) {
  const profile = { admin: 1, technician: 2, viewer: 3 }[role];
  const {
    rows: [row],
  } = await db.query(
    'INSERT INTO public.saeusua(usua_nom_usua,usua_pas_usua,usua_cod_sucu) VALUES($1,$2,1) RETURNING usua_cod_usua',
    [username, await hashPassword(secret)]
  );
  await db.query(
    `INSERT INTO comercial.usuario(empresa_id,sucursal_id,perfil_id,usua_cod_usua,usuario_user,usuario_password,usuario_activo,usuario_tiempo_sesion)
    VALUES(1,1,$1,$2,$3,$4,true,60)`,
    [profile, row.usua_cod_usua, username, await hash(secret, 4)]
  );
}
export async function fixture(options: { sessions?: boolean; support?: boolean } = {}) {
  const databases = new Databases(config, () => {
    // Repeated CREATE TABLE IF NOT EXISTS is valid PostgreSQL; pg-mem otherwise
    // reports unread AST constraints when it skips an already existing table.
    const memory = newDb({ noAstCoverageCheck: true });
    memory.public.registerFunction({
      name: 'round',
      args: [DataType.float, DataType.integer],
      returns: DataType.float,
      implementation: (value: number, precision: number) =>
        Math.round((value + Number.EPSILON) * 10 ** precision) / 10 ** precision,
    });
    memory.public.registerFunction({
      name: 'replace',
      args: [DataType.text, DataType.text, DataType.text],
      returns: DataType.text,
      implementation: (value: string, from: string, to: string) => value.split(from).join(to),
    });
    memory.public.registerFunction({
      name: 'current_database',
      returns: 'text' as never,
      implementation: () => 'test',
    });
    const pool = new (memory.adapters.createPg().Pool)() as Database;
    // pg-mem has no transaction engine. Explicit snapshots let rollback tests verify app atomicity;
    // actual lock/isolation behavior still requires the optional real PostgreSQL suite.
    const query = pool.query.bind(pool);
    let backup: ReturnType<typeof memory.backup> | undefined;
    pool.query = (async (...args: unknown[]) => {
      const sql = String(args[0]);
      // pg-mem resolves nextval against the query schema, ignoring a qualified regclass.
      if (sql === "SELECT nextval('sismant.asset_identity_seq')::text AS local_id")
        return {
          rows: [
            memory
              .getSchema('sismant')
              .one("SELECT nextval('asset_identity_seq')::text AS local_id"),
          ],
          rowCount: 1,
        };
      if (sql === 'BEGIN') backup = memory.backup();
      if (sql === 'ROLLBACK') {
        backup?.restore();
        backup = undefined;
        return { rows: [], rowCount: 0 };
      }
      if (sql === 'COMMIT') backup = undefined;
      try {
        return await query(...(args as [string, unknown[]]));
      } catch (error) {
        const pgError = error as Error & { code?: string };
        // pg-mem omits the SQLSTATE that node-postgres receives from PostgreSQL.
        if (!pgError.code && /relation .+ does not exist/i.test(pgError.message))
          pgError.code = '42P01';
        throw error;
      }
    }) as typeof pool.query;
    return pool;
  });
  for (const { id } of databases.list()) {
    const db = databases.get(id).db;
    await db.query(`CREATE SCHEMA comercial;
      CREATE TABLE public.saeusua(usua_cod_usua SERIAL PRIMARY KEY,usua_nom_usua TEXT,usua_pas_usua TEXT,usua_fec_cadu DATE,usua_cod_sucu INTEGER);
      CREATE TABLE comercial.usuario(usuario_id SERIAL PRIMARY KEY,empresa_id INTEGER,sucursal_id INTEGER,perfil_id INTEGER,usua_cod_usua INTEGER,
        usuario_user TEXT,usuario_password TEXT,usuario_activo BOOLEAN,usuario_fecha_caduca DATE,usuario_tiempo_sesion INTEGER);`);
    if (options.sessions !== false) await migrateDatabase(db);
    await seedUser(db, 'admin', 'admin', id === 'segunda' ? 'second-password-123' : password);
    await prepareMaintenance(db, id, options.support !== false);
  }
  return databases;
}
export async function prepareMaintenance(db: Database, id: string, support = true) {
  const sql = (await readFile('sql/002_maintenance.sql', 'utf8')).replace(
    /COMMENT ON COLUMN[^;]+;/g,
    ''
  );
  await db.query(sql);
  if (support) await db.query(await readFile('sql/003_maintenance_support.sql', 'utf8'));
  await db.query(`CREATE SCHEMA integration;
    CREATE TABLE integration.maintenance_assets(id_activo BIGINT,conexion_erp TEXT,empresa_id BIGINT,sucursal_id BIGINT,act_cod_act TEXT,nombre TEXT,tipo TEXT,act_usa_mant TEXT,act_fcmp_act DATE);
    CREATE TABLE public.saeact(act_cod_act INTEGER,act_cod_empr INTEGER,act_cod_sucu INTEGER,act_nom_act TEXT,tact_cod_tact INTEGER,act_usa_mant TEXT,act_clave_act TEXT,act_fcmp_act DATE);`);
  await db.query(
    "INSERT INTO integration.maintenance_assets VALUES($1,$2,1,1,'1','Equipo ERP','Maquinaria','S','2017-06-09')",
    [id === 'principal' ? '1001' : id === 'segunda' ? '2001' : '3001', id]
  );
  await db.query("INSERT INTO public.saeact VALUES(1,1,1,'Equipo ERP',1,'S','MEP-001','2017-06-09')");
  await db.query(`INSERT INTO public.saeumd_mant(codigo,nombre,tipo_control) VALUES('H','Horas','MEDIDOR'),('KM','Kilómetros','MEDIDOR'),('DIA','Días','CALENDARIO'),('MES','Meses','CALENDARIO');
    INSERT INTO public.saetima_mant(nombre,descripcion) VALUES('Motor','Servicio preventivo');`);
}
