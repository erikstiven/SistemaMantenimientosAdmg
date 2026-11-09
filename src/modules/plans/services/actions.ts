import type { MaintenancePlan } from '../../../../shared/types';
import { TODAY } from '../../../utils/format';
import type { MutationContext } from '../../maintenance/services/mutationContext';
export function savePlan({
  meters,
  maintTypes,
  setPlans,
  draft,
  notice,
  log,
  asset,
}: MutationContext): boolean {
  if (!maintTypes.some(t => t.name === draft.name && t.active)) {
    notice('Selecciona un tipo de mantenimiento activo');
    return false;
  }
  if (!draft.name?.trim() || !draft.asset || !draft.unit || !(Number(draft.freq) > 0)) {
    notice('Completa plan, equipo y frecuencia mayor a cero');
    return false;
  }
  if (
    ['Horas', 'Kilómetros'].includes(draft.unit ?? '') &&
    !meters.some(
      m => m.id === Number(draft.meter) && m.asset === Number(draft.asset) && m.unit === draft.unit
    )
  ) {
    notice('Selecciona un medidor del activo');
    return false;
  }
  setPlans(p => [
    ...p,
    {
      id: Date.now(),
      name: draft.name ?? '',
      asset: Number(draft.asset),
      unit: draft.unit ?? '',
      meter: Number(draft.meter) || undefined,
      freq: Number(draft.freq),
      base: Number(draft.base || 0),
      alert: Number(draft.alert || 0),
      startDate: draft.startDate || TODAY,
      active: true,
    },
  ]);
  log('Plan', 'Creado ' + draft.name + ' para ' + asset(Number(draft.asset)));

  return true;
}
export function saveRule({
  plans,
  meters,
  setPlans,
  draft,
  notice,
  log,
  asset,
}: MutationContext): boolean {
  if (!(Number(draft.freq) > 0)) {
    notice('Frecuencia requerida');
    return false;
  }
  if (
    ['Horas', 'Kilómetros'].includes(draft.unit ?? '') &&
    !meters.some(
      m =>
        m.id === Number(draft.meter) &&
        m.asset === Number(draft.asset || plans.find(p => p.id === Number(draft.plan))?.asset) &&
        m.unit === draft.unit
    )
  ) {
    notice('Selecciona medidor para esta regla');
    return false;
  }
  setPlans(ps =>
    ps.map(p =>
      p.id === Number(draft.plan)
        ? {
            ...p,
            second: {
              unit: draft.unit ?? '',
              freq: Number(draft.freq),
              base: Number(draft.base || 0),
              alert: Number(draft.alert || 0),
              startDate: draft.startDate || p.startDate,
              meter: Number(draft.meter) || undefined,
            },
          }
        : p
    )
  );
  log('Regla', 'Configurada condición adicional para plan ' + draft.plan);

  return true;
}
export function changeControl({
  plans,
  meters,
  setPlans,
  draft,
  notice,
  log,
  asset,
}: MutationContext): boolean {
  const old = plans.find(p => p.id === Number(draft.plan));
  if (!old || !draft.unit || !(Number(draft.freq) > 0)) {
    notice('Configura la unidad y frecuencia nuevas');
    return false;
  }
  if (
    ['Horas', 'Kilómetros'].includes(draft.unit ?? '') &&
    !meters.some(
      m =>
        m.id === Number(draft.meter) &&
        m.asset === Number(draft.asset || plans.find(p => p.id === Number(draft.plan))?.asset) &&
        m.unit === draft.unit
    )
  ) {
    notice('Selecciona medidor');
    return false;
  }
  const newP: MaintenancePlan = {
    id: Date.now(),
    asset: old.asset,
    name: old.name,
    unit: draft.unit ?? '',
    meter: Number(draft.meter) || undefined,
    freq: Number(draft.freq),
    base: Number(draft.base || 0),
    alert: Number(draft.alert || 0),
    startDate: draft.startDate || TODAY,
    active: true,
    note: 'Reemplaza plan ' + old.id,
  };
  setPlans(ps => [
    ...ps.map(p =>
      p.id === old.id
        ? {
            ...p,
            active: false,
            endDate: TODAY,
          }
        : p
    ),
    newP,
  ]);
  log(
    'Cambio de estrategia',
    asset(old.asset) +
      ' · ' +
      old.name +
      ': ' +
      old.unit +
      ' → ' +
      draft.unit +
      '. Historial anterior conservado.'
  );

  return true;
}
