import { Pool, types } from 'pg';
// DATE and TIMESTAMP WITHOUT TIME ZONE are business values, not JS instants.
types.setTypeParser(1082, value => value);
types.setTypeParser(1114, value => value);
import type { Config } from './config.ts';
import { connectionSchema, type ConnectionDefinition } from './connections.ts';
import { AppError } from './shared/errors.ts';
export type Database = Pick<Pool, 'query' | 'connect' | 'end'>;
export type Connection = { definition: ConnectionDefinition; db: Database };
export class Databases {
  private connections = new Map<string, Connection>();
  private maintenancePools = new Map<string, Database>();
  constructor(
    config: Config,
    private factory: (definition: ConnectionDefinition) => Database = definition => {
      const connectionString = process.env[definition.urlEnv];
      if (!connectionString) throw new Error(`Falta la variable ${definition.urlEnv}`);
      if (!['postgres:', 'postgresql:'].includes(new URL(connectionString).protocol))
        throw new Error('Se requiere PostgreSQL');
      const pool = new Pool({
        connectionString,
        max: 10,
        connectionTimeoutMillis: 5000,
        idleTimeoutMillis: 30000,
        statement_timeout: 15000,
      });
      pool.on('error', () => console.error(`Conexión PostgreSQL no disponible: ${definition.id}`));
      return pool;
    }
  ) {
    const definitions = config.connections.map(input => connectionSchema.parse(input));
    const namespaces = definitions.flatMap(d =>
      d.assetNamespace === undefined ? [] : [d.assetNamespace]
    );
    if (new Set(namespaces).size !== namespaces.length)
      throw new Error(
        'Cada conexión necesita un assetNamespace distinto para sus identidades globales'
      );
    if (!definitions.length || new Set(definitions.map(d => d.id)).size !== definitions.length)
      throw new Error('Configura conexiones con identificadores únicos');
    for (const definition of definitions)
      this.connections.set(definition.id, { definition, db: this.factory(definition) });
  }
  list() {
    return [...this.connections.values()].map(({ definition: { id, label } }) => ({ id, label }));
  }
  get(id: string) {
    const connection = this.connections.get(id);
    if (!connection) throw new AppError(422, 'Base de datos no registrada');
    return connection;
  }
  async close() {
    await Promise.all(
      [
        ...new Set(
          [...this.connections.values()].map(c => c.db).concat([...this.maintenancePools.values()])
        ),
      ].map(db => db.end())
    );
  }
  maintenance(id: string) {
    const { definition } = this.get(id);
    // By default the supplied tables live in public of the selected ERP database.
    if (!definition.maintenanceUrlEnv) return this.get(id).db;
    const urlEnv = definition.maintenanceUrlEnv;
    let db = this.maintenancePools.get(urlEnv);
    if (!db) {
      try {
        db = this.factory({ ...definition, urlEnv });
      } catch {
        throw new AppError(
          503,
          `Configura ${urlEnv} para la base independiente de mantenimiento`,
          'MAINTENANCE_NOT_CONFIGURED'
        );
      }
      this.maintenancePools.set(urlEnv, db);
    }
    return db;
  }
}
