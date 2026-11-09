import type { MutationContext } from '../../maintenance/services/mutationContext';
export function savePart({ setItems, draft, notice }: MutationContext): boolean {
  if (!draft.name?.trim() || Number(draft.price) < 0) {
    notice('Ingresa nombre y precio válido');
    return false;
  }
  setItems(it => [
    ...it,
    {
      name: draft.name ?? '',
      unit: draft.unit || 'Unidad',
      price: Number(draft.price || 0),
    },
  ]);

  return true;
}
