import type { ReactNode } from 'react';
import {
  cents,
  decimal,
  type RelationalData,
  type ReadingRow,
} from '../../../../shared/relational';
import { styles } from '../../../components/styles';
import { formatReadingValue, readingUnit } from '../reading-format';
import type { useMaintenanceLocation } from '../hooks/useMaintenanceLocation';
import { Status, Table } from './RelationalTable';
import type { Pagination } from './Pagination';

const annulmentDate = new Intl.DateTimeFormat('es-EC', {
  dateStyle: 'short',
  timeStyle: 'medium',
  timeZone: 'America/Guayaquil',
});

export function ReadingHistory({
  data,
  location,
  pagination,
  actions,
  assetName,
  readingLink,
  matches,
  searchControl,
}: {
  data: RelationalData;
  location: ReturnType<typeof useMaintenanceLocation>;
  pagination: Pagination;
  actions?: (reading: ReadingRow) => ReactNode;
  assetName: (id: string) => string;
  readingLink: (reading: ReadingRow, label: string) => ReactNode;
  matches: (...values: unknown[]) => boolean;
  searchControl: ReactNode;
}) {
  const { asset, meter, search, record, readingOrder, change } = location;
  const metersWithReadings = new Set(data.readings.map(r => r.id_medidor));
  const meters = data.meters.filter(m => metersWithReadings.has(m.id_medidor));
  const byId = new Map(meters.map(m => [m.id_medidor, m]));
  const assetsWithReadings = new Set(meters.map(m => m.id_activo));
  const assets = data.assets.filter(a => assetsWithReadings.has(a.id_activo));
  const availableMeters = meters.filter(m => !asset || m.id_activo === asset);
  const ascending = [...data.readings].sort((a, b) => {
    const date = a.fecha_lectura.localeCompare(b.fecha_lectura);
    if (date || a.id_lectura === b.id_lectura) return date;
    return BigInt(a.id_lectura) < BigInt(b.id_lectura) ? -1 : 1;
  });
  const previous = new Map<string, bigint>();
  const increments = new Map<string, string>();
  for (const reading of ascending) {
    if (reading.anulacion) continue;
    const current = cents(reading.valor);
    const last = previous.get(reading.id_medidor);
    if (last !== undefined && current >= last)
      increments.set(reading.id_lectura, decimal(current - last));
    previous.set(reading.id_medidor, current);
  }
  const ordered = readingOrder === 'ascending' ? ascending : ascending.reverse();

  return (
    <>
      <div className="sm-toolbar sm-reading-toolbar">
        {searchControl}
        <label className="sm-date">
          Activo
          <select
            className={styles.input}
            value={asset}
            onChange={e => {
              const selected = e.target.value;
              change({
                activo: selected,
                medidor: !selected || byId.get(meter)?.id_activo === selected ? meter : '',
                pagina: '',
              });
            }}
          >
            <option value="">Todos los activos</option>
            {assets.map(a => (
              <option key={a.id_activo} value={a.id_activo}>
                {assetName(a.id_activo)}
              </option>
            ))}
          </select>
        </label>
        <label className="sm-date">
          Medidor
          <select
            className={styles.input}
            value={meter}
            onChange={e => change({ medidor: e.target.value, pagina: '' })}
          >
            <option value="">Todos los medidores</option>
            {availableMeters.map(m => (
              <option key={m.id_medidor} value={m.id_medidor}>
                {asset ? m.nombre_medidor : `${assetName(m.id_activo)} · ${m.nombre_medidor}`} (
                {m.codigo})
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="text-sm text-slate-600">
        La columna Lectura muestra el incremento desde la medición válida anterior. Un cambio de
        contador requiere un medidor nuevo. La primera medición y las anuladas figuran sin
        incremento.
      </p>
      <Table
        layout="readings"
        pagination={pagination}
        title="Lecturas registradas"
        filtered={!!(search.trim() || record || meter || asset)}
        sort={{
          'Fecha y hora': {
            direction: readingOrder,
            toggle: () => change({ orden: readingOrder === 'ascending' ? '' : 'asc', pagina: '' }),
          },
        }}
        headers={[
          'Activo',
          'Medidor',
          'Fecha y hora',
          'Acumulado',
          'Lectura',
          'Estado',
          'Observación',
          ...(actions ? ['Acciones'] : []),
        ]}
        rows={ordered.flatMap(r => {
          const m = byId.get(r.id_medidor);
          const name = m ? assetName(m.id_activo) : '—';
          const meterLabel = m?.nombre_medidor ?? r.id_medidor;
          if (
            (record && record !== r.id_lectura) ||
            (asset && asset !== m?.id_activo) ||
            (meter && meter !== r.id_medidor) ||
            !matches(name, meterLabel, m?.codigo, r.observacion, r.valor, r.fecha_lectura)
          )
            return [];
          const unit = readingUnit(data, r.id_medidor);
          const increment = increments.get(r.id_lectura);
          return [
            [
              name,
              readingLink(r, meterLabel),
              r.fecha_lectura.replace('T', ' '),
              [formatReadingValue(r.valor), unit].filter(Boolean).join(' '),
              increment === undefined
                ? '—'
                : [formatReadingValue(increment), unit].filter(Boolean).join(' '),
              <>
                <Status value={r.anulacion ? 'ANULADA' : 'VALIDA'} />
                {r.anulacion && (
                  <div className="text-xs mt-1">
                    {r.anulacion.nombre_usuario || 'Usuario sin nombre'} ·{' '}
                    {annulmentDate.format(new Date(r.anulacion.fecha))}
                  </div>
                )}
              </>,
              r.observacion,
              ...(actions ? [r.anulacion ? '—' : actions(r)] : []),
            ],
          ];
        })}
      />
    </>
  );
}
