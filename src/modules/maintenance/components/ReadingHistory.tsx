import type { ReactNode } from 'react';
import {
  cents,
  decimal,
  readingSeriesKey,
  type RelationalData,
  type ReadingRow,
} from '../../../../shared/relational';
import { styles } from '../../../components/styles';
import { formatReadingTimestamp, formatReadingValue, readingUnit } from '../reading-format';
import type { useMaintenanceLocation } from '../hooks/useMaintenanceLocation';
import { Status, Table } from './RelationalTable';
import type { Pagination } from './Pagination';

const annulmentDate = new Intl.DateTimeFormat('es-EC', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
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
  const { asset, meter, search, record, readingOrder, readingType, change } = location;
  const metersWithReadings = new Set(data.readings.map(r => r.id_medidor));
  const meters = data.meters.filter(m => metersWithReadings.has(m.id_medidor));
  const byId = new Map(meters.map(m => [m.id_medidor, m]));
  const assetsWithReadings = new Set(meters.map(m => m.id_activo));
  const assets = data.assets.filter(a => assetsWithReadings.has(a.id_activo));
  const availableMeters = meters.filter(m => !asset || m.id_activo === asset);
  const availableReadings = data.readings.filter(
    row =>
      (!meter || row.id_medidor === meter) &&
      (!asset || byId.get(row.id_medidor)?.id_activo === asset)
  );
  const availableTypes = new Set(availableReadings.map(row => row.id_tima ?? 'legacy'));
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
    const key = readingSeriesKey(reading.id_medidor, reading.id_tima);
    const last = previous.get(key);
    if (last !== undefined && current >= last)
      increments.set(reading.id_lectura, decimal(current - last));
    previous.set(key, current);
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
                tipo: '',
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
            onChange={e => change({ medidor: e.target.value, tipo: '', pagina: '' })}
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
        <label className="sm-date">
          Tipo
          <select
            className={styles.input}
            value={readingType}
            onChange={e => change({ tipo: e.target.value, pagina: '' })}
          >
            <option value="">Todos los tipos</option>
            {data.types
              .filter(type => availableTypes.has(type.id_tima))
              .map(type => (
                <option key={type.id_tima} value={type.id_tima}>
                  {type.nombre}
                </option>
              ))}
            {availableTypes.has('legacy') && <option value="legacy">Histórico sin tipo</option>}
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
        filtered={!!(search.trim() || record || meter || asset || readingType)}
        sort={{
          'Fecha y hora': {
            direction: readingOrder,
            toggle: () => change({ orden: readingOrder === 'ascending' ? '' : 'asc', pagina: '' }),
          },
        }}
        headers={[
          'Activo',
          'Medidor',
          'Tipo de mantenimiento',
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
          const typeName = r.id_tima
            ? (data.types.find(type => type.id_tima === r.id_tima)?.nombre ?? `Tipo #${r.id_tima}`)
            : 'Histórico sin tipo';
          if (
            (record && record !== r.id_lectura) ||
            (asset && asset !== m?.id_activo) ||
            (meter && meter !== r.id_medidor) ||
            (readingType && readingType !== (r.id_tima ?? 'legacy')) ||
            !matches(
              name,
              meterLabel,
              typeName,
              m?.codigo,
              r.observacion,
              r.valor,
              r.fecha_lectura,
              formatReadingTimestamp(r.fecha_lectura, true)
            )
          )
            return [];
          const unit = readingUnit(data, r.id_medidor);
          const increment = increments.get(r.id_lectura);
          return [
            [
              name,
              readingLink(r, meterLabel),
              typeName,
              formatReadingTimestamp(r.fecha_lectura, true),
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
