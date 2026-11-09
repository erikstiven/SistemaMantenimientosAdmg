import 'dotenv/config';
import { z } from 'zod';
import { CONNECTIONS, connectionSchema } from './connections.ts';
const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  HOST: z.string().default('127.0.0.1'),
  APP_ORIGIN: z.url().default('http://localhost:5174'),
  SEED_DEMO: z.enum(['true', 'false']).default('false'),
  SESSION_HOURS: z.coerce.number().int().min(1).max(168).default(8),
  connections: z.array(connectionSchema).min(1),
});
export type Config = z.infer<typeof schema>;
export function loadConfig(): Config {
  return schema.parse({ ...process.env, connections: CONNECTIONS });
}
