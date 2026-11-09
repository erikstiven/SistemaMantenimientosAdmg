import { readFile } from 'node:fs/promises';
import { loadConfig } from './config.ts';
import { Databases } from './database.ts';
const databases = new Databases(loadConfig());
const mode = process.argv[2];
if (!['--install', '--support'].includes(mode))
  throw new Error('Usa --install para instalar las tablas en public o --support para tablas ya instaladas');
try {
  const visited = new Set();
  for (const { id } of databases.list()) {
    const db = databases.maintenance(id);
    if (visited.has(db)) continue;
    visited.add(db);
    if (mode === '--install') await db.query(await readFile('sql/002_maintenance.sql', 'utf8'));
    await db.query(await readFile('sql/003_maintenance_support.sql', 'utf8'));
    console.log(`Mantenimiento preparado para ${id}`);
  }
} finally {
  await databases.close();
}
