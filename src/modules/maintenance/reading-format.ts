import type { RelationalData } from '../../../shared/relational';
import type { Draft } from './RelationalEditor';

export function readingUnit(data: RelationalData, meterId: string) {
  const meter = data.meters.find(item => item.id_medidor === meterId);
  const unit = data.units.find(item => item.id_um === meter?.id_um);
  const abbreviations: Record<string, string> = { H: 'h', HORA: 'h', KM: 'km' };
  return unit ? (abbreviations[unit.codigo.toUpperCase()] ?? unit.codigo) : '';
}
export function readingObservation(data: RelationalData, draft: Draft) {
  const meter = data.meters.find(item => item.id_medidor === draft.id_medidor);
  const [date, time] = String(draft.fecha_lectura ?? '').split('T');
  const value = String(draft.valor ?? '');
  if (!meter || !time || !/^\d+(\.\d{1,2})?$/.test(value)) return '';
  const formatted = new Intl.NumberFormat('es-EC', { maximumFractionDigits: 2 }).format(
    Number(value)
  );
  const unit = readingUnit(data, meter.id_medidor);
  return `Lectura registrada el ${date.split('-').reverse().join('/')} a las ${time.slice(0, 5)}, correspondiente al medidor ${meter.nombre_medidor}, con un valor acumulado de ${formatted}${unit ? ' ' + unit : ''}.`;
}
