import { amount, type RelationalData } from '../../../shared/relational';
import type { Draft, Editor } from './RelationalEditor';
import { formatReadingTimestamp, formatReadingValue, readingUnitSymbol } from './reading-format';

export function describeNewOrder(data: RelationalData, draft: Draft) {
  const plan = data.plans.find(item => item.id_plan === draft.id_plan);
  if (!plan) return { description: '', unit: '', unitHint: '', meters: [] };

  const meterRules = data.rules.filter(
    rule => rule.id_plan === plan.id_plan && rule.estado && rule.id_medidor
  );
  const symbols = [...new Set(meterRules.map(rule => readingUnitSymbol(data, rule.id_um)))];
  const meters = [
    ...new Map(
      meterRules.flatMap(rule =>
        rule.id_medidor
          ? [
              [
                rule.id_medidor,
                {
                  id: rule.id_medidor,
                  typeId: data.meterTypesReady ? plan.id_tima : null,
                  unit: readingUnitSymbol(data, rule.id_um),
                },
              ] as const,
            ]
          : []
      )
    ).values(),
  ];
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
  return {
    description: [subject, date, reading].filter(Boolean).join(' '),
    unit,
    unitHint,
    meters,
  };
}

export function describeService(
  data: RelationalData,
  plan: RelationalData['plans'][number],
  editor: Pick<Editor, 'draft' | 'details'>,
  unit: string
) {
  const asset = data.assets.find(item => item.id_activo === plan.id_activo);
  const lines = [
    `Servicio de mantenimiento del plan «${plan.nombre_plan}»${asset ? ` para ${asset.nombre}` : ''}.`,
  ];
  if (editor.draft.fecha_realizada)
    lines.push(`Ejecución el ${formatReadingTimestamp(String(editor.draft.fecha_realizada))}.`);
  const value = amount.safeParse(editor.draft.valor_realizado);
  if (value.success)
    lines.push(
      `Lectura del servicio de ${formatReadingValue(value.data)}${unit ? ` ${unit}` : ''}.`
    );
  const parts = editor.details.flatMap(detail => {
    const part = data.parts.find(item => item.id_repu === detail.id_repu);
    return part ? [`- ${formatReadingValue(detail.cantidad)} × ${part.nombre}`] : [];
  });
  lines.push(
    parts.length ? ['Repuestos utilizados', ...parts].join('\n') : 'Sin repuestos utilizados.'
  );
  const description = lines.join('\n');
  return description.length > 5000 ? description.slice(0, 4999) + '…' : description;
}
