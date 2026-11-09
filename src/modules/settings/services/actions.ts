import type { MutationContext } from '../../maintenance/services/mutationContext';
export function saveMaintenanceType({
  maintTypes,
  setMaintTypes,
  draft,
  notice,
  log,
}: MutationContext): boolean {
  const name = String(draft.name || '').trim();
  const description = String(draft.description || '').trim();
  if (name.length < 3) {
    notice('Escribe un nombre de al menos 3 caracteres');
    return false;
  }
  if (maintTypes.some(t => t.name.toLowerCase() === name.toLowerCase() && t.id !== draft.id)) {
    notice('Ya existe un tipo de mantenimiento con ese nombre');
    return false;
  }
  if (draft.id) {
    setMaintTypes(ts =>
      ts.map(t =>
        t.id === draft.id
          ? {
              ...t,
              name,
              description,
            }
          : t
      )
    );
    log('Configuración', 'Tipo de mantenimiento actualizado: ' + name);
  } else {
    setMaintTypes(ts => [
      ...ts,
      {
        id: Date.now(),
        name,
        description,
        active: true,
      },
    ]);
    log('Configuración', 'Tipo de mantenimiento creado: ' + name);
  }

  return true;
}
