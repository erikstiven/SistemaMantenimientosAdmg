import { readFile } from 'node:fs/promises';
import { loadConfig } from './config.ts';
import { Databases } from './database.ts';
const databases = new Databases(loadConfig());
const mode = process.argv[2];
if (!['--install', '--support', '--meter-types'].includes(mode))
  throw new Error('Usa --install, --support o --meter-types <conexion>');
const target = mode === '--meter-types' ? process.argv[3] : undefined;
if (mode === '--meter-types' && !target)
  throw new Error('Indica la conexión para aplicar la migración de medidas');
if (target) databases.get(target);
try {
  const visited = new Set();
  for (const { id } of databases.list()) {
    if (target && id !== target) continue;
    const db = databases.maintenance(id);
    if (visited.has(db)) continue;
    visited.add(db);
    if (mode === '--install') await db.query(await readFile('sql/002_maintenance.sql', 'utf8'));
    if (mode === '--meter-types')
      await db.query(await readFile('sql/004_meter_maintenance_types.sql', 'utf8'));
    else await db.query(await readFile('sql/003_maintenance_support.sql', 'utf8'));
    console.log(`Mantenimiento preparado para ${id}`);
  }
} finally {
  await databases.close();
}
