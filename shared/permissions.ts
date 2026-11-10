import type { Role } from './state.ts';

export const moduleActions = {
  dashboard: ['read'],
  assets: ['read', 'create', 'update'],
  meters: ['read', 'create', 'update', 'delete'],
  readings: ['read', 'create', 'update', 'void'],
  plans: ['read', 'create', 'replace', 'state', 'delete'],
  orders: ['read', 'create', 'complete', 'cancel', 'delete'],
  parts: ['read', 'create', 'update', 'delete'],
  alerts: ['read'],
  audit: ['read'],
  types: ['read', 'create', 'update', 'delete'],
  units: ['read', 'create', 'update', 'delete'],
  roles: ['read', 'update'],
} as const;
export type PermissionModule = keyof typeof moduleActions;
export type Permission = {
  [K in PermissionModule]: `${K}.${(typeof moduleActions)[K][number]}`;
}[PermissionModule];
export type ManagedRole = Exclude<Role, 'admin'>;
export const permissions = Object.entries(moduleActions).flatMap(([module, actions]) =>
  actions.map(action => `${module}.${action}` as Permission)
);
export const configurablePermissions = permissions.filter(
  permission => !permission.startsWith('roles.') && !/\.(delete|void)$/.test(permission)
);
export const roleLabels: Record<Role, string> = {
  admin: 'Administrador',
  technician: 'Operador',
  viewer: 'Consulta',
};
export function defaultPermissions(role: Role) {
  if (role === 'admin') return permissions;
  return configurablePermissions.filter(
    permission =>
      permission.endsWith('.read') ||
      (role === 'technician' && !/^(units|types|assets)\.|^readings\.update$/.test(permission))
  );
}
const dependencies: Partial<Record<Permission, Permission[]>> = {
  'meters.create': ['assets.read', 'units.read'],
  'meters.update': ['assets.read', 'units.read'],
  'readings.create': ['meters.read', 'units.read', 'assets.read'],
  'readings.update': ['meters.read', 'units.read'],
  'plans.create': ['assets.read', 'units.read', 'types.read', 'meters.read'],
  'plans.replace': ['assets.read', 'units.read', 'types.read', 'meters.read'],
  'orders.create': ['plans.read'],
  'orders.complete': ['plans.read', 'parts.read', 'readings.read'],
};
export function effectivePermissions(granted: readonly Permission[]) {
  return granted.filter(permission => {
    const [module, action] = permission.split('.');
    return (
      action === 'read' ||
      (granted.includes(`${module}.read` as Permission) &&
        (dependencies[permission] ?? []).every(dependency => granted.includes(dependency)))
    );
  });
}
