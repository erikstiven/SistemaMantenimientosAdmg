import type { ReadingRow } from '../../../../shared/relational';
import { formatReadingTimestamp, formatReadingValue } from '../reading-format';

export function ReadingReference({
  id,
  reading,
  unit,
  meter,
}: {
  id?: string;
  reading?: ReadingRow;
  unit: string;
  meter?: string;
}) {
  return (
    <div id={id} className="rounded-lg bg-blue-50 p-3 text-sm" aria-live="polite">
      <strong className="block">Último acumulado registrado</strong>
      {meter && <p>{meter}</p>}
      {reading ? (
        <p>
          <span className="font-semibold">
            {formatReadingValue(reading.valor)} {unit}
          </span>
          {' · '}
          {formatReadingTimestamp(reading.fecha_lectura)}
        </p>
      ) : (
        <p>Este medidor todavía no tiene lecturas válidas.</p>
      )}
    </div>
  );
}
