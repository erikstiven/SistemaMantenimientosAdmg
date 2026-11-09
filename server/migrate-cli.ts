import { loadConfig } from './config.ts';
import { Databases } from './database.ts';
import { migrateDatabase } from './migrate.ts';
const config = loadConfig();
const databases = new Databases(config);
try {
  for (const { id } of databases.list()) {
    await migrateDatabase(databases.get(id).db);
    console.log(`Esquema SisMant preparado: ${id}`);
  }
} finally {
  await databases.close();
}
