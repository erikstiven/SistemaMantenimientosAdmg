import type { MutationContext } from '../../maintenance/services/mutationContext';
export function saveAsset({ assets, setAssets, draft, notice, log }: MutationContext): boolean {
  if (!draft.code?.trim() || !draft.name?.trim()) {
    notice('Completa código y nombre');
    return false;
  }
  if (
    assets.some(x => x.code.toLowerCase() === (draft.code ?? '').toLowerCase() && x.id !== draft.id)
  ) {
    notice('El código ya existe');
    return false;
  }
  if (draft.id) {
    setAssets(a =>
      a.map(x =>
        x.id === draft.id
          ? {
              ...x,
              code: draft.code?.trim() ?? x.code,
              name: draft.name?.trim() ?? x.name,
              type: draft.type?.trim() || x.type,
            }
          : x
      )
    );
    log('Activo', 'Actualizado ' + draft.name);
  } else {
    setAssets(a => [
      ...a,
      {
        id: Date.now(),
        code: draft.code ?? '',
        name: draft.name ?? '',
        type: draft.type || 'Maquinaria',
      },
    ]);
    log('Activo', 'Registrado ' + draft.name);
  }

  return true;
}
