import { z } from 'zod';
export const connectionSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9_-]{1,50}$/),
    label: z.string().min(1).max(100),
    urlEnv: z.string().regex(/^[A-Z][A-Z0-9_]*$/),
    maintenanceUrlEnv: z
      .string()
      .regex(/^[A-Z][A-Z0-9_]*$/)
      .optional(),
    assetIntegrationView: z
      .string()
      .regex(/^[a-z_][a-z0-9_]*\.[a-z_][a-z0-9_]*$/)
      .optional(),
    assetNamespace: z.number().int().min(1).max(2097151).optional(),
    adminAssetScope: z.enum(['branch', 'company']).optional(),
    authMode: z.enum(['combined', 'commercial', 'sae']).default('combined'),
    passwordFormat: z.enum(['bcrypt', 'scrypt', 'legacy-md5']).default('bcrypt'),
    sessionTimeUnit: z.enum(['minutes', 'seconds']).optional(),
    roles: z.record(z.string(), z.enum(['admin', 'technician', 'viewer'])).default({}),
  })
  .strict();
export type ConnectionDefinition = z.infer<typeof connectionSchema>;
export const CONNECTIONS: ConnectionDefinition[] = [
  {
    id: 'principal',
    assetNamespace: 1,
    label: 'Base principal',
    urlEnv: 'PG_PRINCIPAL_URL',
    authMode: 'combined',
    // Existing commercial credentials are 32 hexadecimal characters (MD5-compatible).
    passwordFormat: 'legacy-md5',
    // Profile IDs verified against comercial.perfil; other profiles remain denied.
    roles: { '1': 'admin', '2': 'admin', '4': 'viewer' },
  },
  {
    id: 'supermag',
    assetNamespace: 2,
    label: 'Supermag 2024',
    urlEnv: 'PG_SUPERMAG_URL',
    authMode: 'commercial',
    passwordFormat: 'legacy-md5',
    roles: { '1': 'admin', '2': 'admin', '4': 'viewer' },
  },
  {
    id: 'minesadco_copia06_11_2026',
    assetNamespace: 3,
    adminAssetScope: 'company',
    label: 'minesadco_copia06_11_2026',
    urlEnv: 'PG_MINESADCO_COPIA06_11_2026_URL',
    authMode: 'commercial',
    passwordFormat: 'legacy-md5',
    roles: { '1': 'admin', '2': 'admin', '4': 'viewer' },
  },
];
