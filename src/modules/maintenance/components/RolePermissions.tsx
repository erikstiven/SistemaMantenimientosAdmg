import { useState } from 'react';
import {
  configurablePermissions,
  defaultPermissions,
  effectivePermissions,
  moduleActions,
  roleLabels,
  type ManagedRole,
  type Permission,
  type PermissionModule,
} from '../../../../shared/permissions';
import type { Role } from '../../../../shared/state';
import { styles } from '../../../components/styles';
import { moduleInfo } from '../relational-labels';

const actions: Record<string, string> = {
  read: 'Consultar',
  create: 'Crear',
  update: 'Editar',
  replace: 'Sustituir estrategia',
  state: 'Activar o desactivar',
  complete: 'Completar',
  cancel: 'Cancelar',
  delete: 'Eliminar',
  void: 'Anular',
};
const roles = ['technician', 'viewer', 'admin'] as const;
export function RolePermissions({
  currentRole,
  role,
  saved,
  busy,
  onRole,
  onSave,
}: {
  currentRole: Role;
  role: Role;
  saved: Permission[];
  busy: boolean;
  onRole: (role: Role) => void;
  onSave: (role: ManagedRole, permissions: Permission[]) => Promise<void>;
}) {
  const [selected, setSelected] = useState(saved);
  const available = effectivePermissions(selected);
  const changed =
    selected.length !== saved.length || selected.some(permission => !saved.includes(permission));
  return (
    <form
      className="sm-card space-y-4 p-4 sm:p-6"
      onSubmit={event => {
        event.preventDefault();
        if (role !== 'admin' && changed) void onSave(role, selected);
      }}
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <label className="grid gap-1 text-sm font-semibold">
          Rol que deseas consultar
          <select
            className={styles.input}
            value={role}
            disabled={busy}
            onChange={event => onRole(event.target.value as Role)}
          >
            {roles.map(value => (
              <option value={value} key={value}>
                {roleLabels[value]}
              </option>
            ))}
          </select>
        </label>
        <p className="text-sm text-slate-600">
          Tu rol en SisMant: <strong>{roleLabels[currentRole]}</strong>
        </p>
      </div>
      <p className="text-sm text-slate-600">
        La asignación del perfil se administra en el ERP.{' '}
        {role === 'admin'
          ? 'El Administrador tiene permisos fijos para mantener el acceso a la configuración.'
          : 'Los cambios se aplican a este rol en la empresa de la sesión actual. Una acción requiere acceso de consulta a sus módulos relacionados.'}
      </p>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {(Object.entries(moduleActions) as [PermissionModule, readonly string[]][])
          .filter(([key]) => key !== 'roles' || role === 'admin')
          .map(([key, list]) => (
            <fieldset
              key={key}
              className="min-w-0 rounded-lg border border-slate-200 px-3 pb-3"
              disabled={busy || role === 'admin'}
            >
              <legend className="px-1 text-sm font-semibold">{moduleInfo[key][0]}</legend>
              {list.map(action => {
                const permission = `${key}.${action}` as Permission;
                if (role !== 'admin' && !configurablePermissions.includes(permission)) return null;
                const checked = selected.includes(permission);
                return (
                  <label key={permission} className="mt-2 flex items-start gap-2 text-sm">
                    <input
                      className="mt-1"
                      type="checkbox"
                      checked={checked}
                      onChange={event => {
                        const enabled = event.target.checked;
                        setSelected(old =>
                          enabled ? [...old, permission] : old.filter(value => value !== permission)
                        );
                      }}
                    />
                    <span>
                      {actions[action]}
                      {checked && !available.includes(permission) && (
                        <small className="block text-amber-800">
                          Falta un permiso de consulta relacionado
                        </small>
                      )}
                    </span>
                  </label>
                );
              })}
            </fieldset>
          ))}
      </div>
      {role !== 'admin' && (
        <div className="flex flex-wrap justify-end gap-2">
          <button
            type="button"
            className="sm-secondary"
            disabled={busy}
            onClick={() => setSelected(defaultPermissions(role))}
          >
            Restaurar valores iniciales
          </button>
          <button className={styles.button} type="submit" disabled={busy || !changed}>
            Guardar permisos
          </button>
        </div>
      )}
    </form>
  );
}
