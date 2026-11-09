import { TODAY, format } from '../../../utils/format';
import type { MutationContext } from '../../maintenance/services/mutationContext';
export function saveMeter({ setMeters, draft, notice, log, asset }: MutationContext): boolean {
  if (!draft.asset || !draft.unit || !draft.name?.trim()) {
    notice('Completa equipo, unidad y nombre');
    return false;
  }
  setMeters(m => [
    ...m,
    {
      id: Date.now(),
      asset: Number(draft.asset),
      unit: draft.unit ?? '',
      name: draft.name ?? '',
      active: true,
    },
  ]);
  log('Medidor', 'Nuevo ' + draft.name + ' para ' + asset(Number(draft.asset)));

  return true;
}
export function saveReading({
  meters,
  setReadings,
  draft,
  notice,
  log,
  asset,
  current,
}: MutationContext): boolean {
  const val = Number(draft.value),
    aid = Number(draft.asset),
    meter = Number(draft.meter);
  const mm = meters.find(m => m.id === meter);
  if (
    !mm ||
    !mm.active ||
    mm.asset !== aid ||
    !Number.isFinite(val) ||
    draft.value === '' ||
    val < 0
  ) {
    notice('Selecciona medidor e ingresa lectura válida');
    return false;
  }
  if (val < current(aid, mm.unit, meter)) {
    notice('Lectura menor al último registro; debe corregirse con autorización');
    return false;
  }
  setReadings(r => [
    ...r,
    {
      id: Date.now(),
      asset: aid,
      meter,
      unit: mm.unit,
      value: val,
      date: draft.date || TODAY,
    },
  ]);
  log('Lectura', asset(aid) + ' · ' + mm.name + ': ' + format(val) + ' ' + mm.unit);

  return true;
}
