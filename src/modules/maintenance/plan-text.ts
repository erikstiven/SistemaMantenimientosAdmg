import type { RelationalData } from '../../../shared/relational';
import type { Editor } from './RelationalEditor';

export const planTextFields = ['nombre_plan', 'observacion'] as const;
export type PlanTextField = (typeof planTextFields)[number];

export function suggestPlanText(data: RelationalData, editor: Pick<Editor, 'draft' | 'rules'>) {
  const { draft, rules } = editor;
  const asset = data.assets.find(a => a.id_activo === draft.id_activo);
  const type = data.types.find(t => t.id_tima === draft.id_tima);
  const typeName = type?.nombre.trim().replace(/^mantenimiento\b\s*/i, '');
  if (!asset || !type) return { nombre_plan: '', observacion: '' };

  const name = ['MANTENIMIENTO', typeName, 'A', asset.nombre.trim()]
    .filter(Boolean)
    .join(' ')
    .toLocaleUpperCase('es-EC');
  const frequencies = rules.flatMap(rule => {
    const unit = data.units.find(u => u.id_um === rule.id_um);
    if (!unit || !(Number(rule.frecuencia) > 0)) return [];
    const meter = data.meters.find(m => m.id_medidor === rule.id_medidor);
    const frequency = `cada ${rule.frecuencia} ${unit.nombre}`;
    const source = meter ? ` en ${meter.nombre_medidor}` : '';
    const alert =
      Number(rule.alerta_antes) > 0
        ? `, con aviso ${rule.alerta_antes} ${meter ? unit.nombre : 'días'} antes`
        : '';
    return [frequency + source + alert];
  });
  const subject = `Plan de mantenimiento${typeName ? ' ' + typeName.toLocaleLowerCase('es-EC') : ''} del activo ${asset.nombre}.`;
  const criterion =
    draft.condicion === 'AND'
      ? 'Vence cuando se cumplen todas las reglas.'
      : 'Vence cuando se cumple cualquiera de las reglas.';
  const schedule = frequencies.length ? ` Frecuencias: ${frequencies.join(' / ')}.` : '';
  return {
    nombre_plan: name.slice(0, 150).trimEnd(),
    observacion:
      (subject + schedule).slice(0, 5000 - criterion.length - 2).trimEnd() + ' ' + criterion,
  };
}
