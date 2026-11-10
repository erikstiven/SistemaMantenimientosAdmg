import { readingUnitLabel, type ReadingRow, type RelationalData } from '../../../shared/relational';
import type { Draft } from './RelationalEditor';

export function latestValidReadings(readings: readonly ReadingRow[]) {
  const latest = new Map<string, ReadingRow>();
  for (const reading of readings) {
    if (reading.anulacion) continue;
    const previous = latest.get(reading.id_medidor);
    if (!previous || reading.fecha_lectura > previous.fecha_lectura)
      latest.set(reading.id_medidor, reading);
  }
  return latest;
}

export function readingUnit(data: RelationalData, meterId: string) {
  const meter = data.meters.find(item => item.id_medidor === meterId);
  return meter ? readingUnitSymbol(data, meter.id_um) : '';
}

export function readingUnitSymbol(data: RelationalData, unitId: string) {
  const unit = data.units.find(item => item.id_um === unitId);
  return unit ? readingUnitLabel(unit.codigo) : '';
}

export function formatReadingValue(value: string | number | null | undefined): string {
  if (value === '' || value == null) return '—';
  const num = Number(value);
  if (!Number.isFinite(num)) return String(value);
  return new Intl.NumberFormat('es-EC', { maximumFractionDigits: 2 }).format(num);
}

export function formatReadingTimestamp(timestamp: string | null | undefined): string {
  if (!timestamp) return 'Sin lecturas registradas';
  const [date, time] = timestamp.split('T');
  if (!date) return timestamp;
  const formattedDate = date.split('-').reverse().join('/');
  if (!time) return formattedDate;
  return `${formattedDate}, ${time.slice(0, 5)}`;
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
