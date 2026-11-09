import type { Database } from './database.ts';
import { readFile } from 'node:fs/promises';
const maintenancePrepared = new WeakMap<Database, Promise<void>>();
export function ensureMaintenanceStorage(db: Database) {
  let pending = maintenancePrepared.get(db);
  if (!pending) {
    pending = readFile('sql/003_maintenance_support.sql', 'utf8')
      .then(sql => db.query(sql))
      .then(() => undefined)
      .catch(error => {
        maintenancePrepared.delete(db);
        throw error;
      });
    maintenancePrepared.set(db, pending);
  }
  return pending;
}
const prepared = new WeakMap<Database, Promise<void>>();
export function ensureAuthStorage(db: Database) {
  let pending = prepared.get(db);
  if (!pending) {
    pending = migrateDatabase(db).catch(error => {
      prepared.delete(db);
      throw error;
    });
    prepared.set(db, pending);
  }
  return pending;
}
export async function migrateDatabase(db: Database) {
  await db.query(`CREATE SCHEMA IF NOT EXISTS sismant;
    CREATE TABLE IF NOT EXISTS sismant.sessions (
      token TEXT PRIMARY KEY, user_id BIGINT NOT NULL, expires BIGINT NOT NULL);
    CREATE INDEX IF NOT EXISTS sessions_expiry ON sismant.sessions(expires);`);
}
