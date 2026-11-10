import { amount, type RelationalData } from '../../../shared/relational';
import type { Draft } from './RelationalEditor';
import { formatReadingTimestamp, formatReadingValue, readingUnitSymbol } from './reading-format';

export function describeNewOrder(data: RelationalData, draft: Draft) {
  const plan = data.plans.find(item => item.id_plan === draft.id_plan);
  if (!plan) return { description: '', unit: '', unitHint: '' };

  const meterRules = data.rules.filter(
    rule => rule.id_plan === plan.id_plan && rule.estado && rule.id_medidor
  );
  const symbols = [...new Set(meterRules.map(rule => readingUnitSymbol(data, rule.id_um)))];
  const unit = symbols.length === 1 ? symbols[0] : '';
  const unitHint = symbols.includes('')
    ? 'La unidad de lectura no está disponible.'
    : symbols.length > 1
      ? `El plan usa varias unidades (${symbols.join(', ')}). Indica en la descripción a cuál corresponde el valor.`
      : meterRules.length === 0
        ? 'Este plan no tiene lecturas por medidor.'
        : '';

  const asset = data.assets.find(item => item.id_activo === plan.id_activo);
  const subject = `Orden de mantenimiento para el plan «${plan.nombre_plan}»${asset ? `, del activo ${asset.nombre}` : ''}.`;
  const date = draft.fecha_programada
    ? `Fecha programada: ${formatReadingTimestamp(String(draft.fecha_programada))}.`
    : 'Fecha programada por definir.';
  const value = amount.safeParse(draft.valor_programado);
  const reading = value.success
    ? `Lectura programada: ${formatReadingValue(value.data)}${unit ? ` ${unit}` : ''}.`
    : meterRules.length
      ? 'Lectura programada por definir.'
      : '';
  return { description: [subject, date, reading].filter(Boolean).join(' '), unit, unitHint };
}
