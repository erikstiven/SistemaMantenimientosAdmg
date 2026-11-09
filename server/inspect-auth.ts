import { loadConfig } from './config.ts';
import { Databases } from './database.ts';
const databases = new Databases(loadConfig());
try {
  for (const { id } of databases.list()) {
    console.log(`Conexión: ${id}`);
    try {
      const db = databases.get(id).db;
      const columns = await db.query(`SELECT table_schema,table_name,column_name,data_type
        FROM information_schema.columns WHERE (table_schema='public' AND table_name='saeusua')
          OR (table_schema='comercial' AND table_name='usuario') ORDER BY table_schema,table_name,ordinal_position`);
      console.table(columns.rows);
      // Static identifiers only. PostgreSQL returns aggregate classifications, never hashes or passwords.
      for (const [table, column] of [
        ['public.saeusua', 'usua_pas_usua'],
        ['comercial.usuario', 'usuario_password'],
      ]) {
        const result = await db.query(`SELECT CASE
          WHEN ${column} ~ '^[$]2[aby][$](0[4-9]|1[0-6])[$][./A-Za-z0-9]{53}$' THEN 'bcrypt'
          WHEN ${column} ~ '^[a-fA-F0-9]{32}:[a-fA-F0-9]{128}$' THEN 'scrypt'
          WHEN ${column} ~ '^[a-fA-F0-9]{32}$' THEN 'md5-compatible (confirmar algoritmo)'
          WHEN ${column} IS NULL OR ${column}='' THEN 'vacio'
          ELSE 'desconocido' END AS formato, COUNT(*) AS cantidad FROM ${table} GROUP BY 1`);
        console.log(table);
        console.table(result.rows);
      }
      console.table(
        (
          await db.query(
            'SELECT perfil_id,COUNT(*) AS usuarios FROM comercial.usuario GROUP BY perfil_id ORDER BY perfil_id'
          )
        ).rows
      );
    } catch {
      console.error(`No se pudo inspeccionar ${id}; comprueba conexión y permisos de lectura.`);
      process.exitCode = 1;
    }
  }
} finally {
  await databases.close();
}
