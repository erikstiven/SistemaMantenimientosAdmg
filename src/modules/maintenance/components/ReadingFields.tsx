import { useId, useMemo } from 'react';
import type { RelationalData } from '../../../../shared/relational';
import { styles } from '../../../components/styles';
import type { Draft } from '../RelationalEditor';

import { latestValidReadings, readingObservation, readingUnit } from '../reading-format';
import { ReadingReference } from './ReadingReference';
import { readingSeriesKey } from '../../../../shared/relational';
import { BusinessDateTimeField } from './BusinessDateTimeField';

export function ReadingFields({
  data,
  draft,
  editing,
  customized,
  meterName,
  onChange,
}: {
  data: RelationalData;
  draft: Draft;
  editing: boolean;
  customized: boolean;
  meterName: (id: string) => string;
  onChange: (key: string, value: string) => void;
}) {
  const referenceId = useId();
  const latest = useMemo(() => latestValidReadings(data.readings), [data.readings]);
  const meters = data.meters.filter(meter =>
    editing
      ? meter.id_medidor === draft.id_medidor
      : meter.estado &&
        data.units.some(
          unit => unit.id_um === meter.id_um && unit.estado && unit.tipo_control === 'MEDIDOR'
        ) &&
        data.assets.some(asset => asset.id_activo === meter.id_activo && asset.act_usa_mant === 'S')
  );
  const meterId = String(draft.id_medidor ?? '');
  const typeId = String(draft.id_tima ?? '');
  const assignments =
    data.meterTypes?.filter(
      row => row.id_medidor === meterId && (row.estado || (editing && row.id_tima === typeId))
    ) ?? [];
  const types = data.types.filter(
    type =>
      assignments.some(row => row.id_tima === type.id_tima) &&
      (type.estado || (editing && type.id_tima === typeId))
  );
  const unit = readingUnit(data, meterId);
  const showReference =
    !editing &&
    meters.some(meter => meter.id_medidor === meterId) &&
    (!data.meterTypesReady || !!typeId);
  const reference = latest.get(readingSeriesKey(meterId, typeId));
  return (
    <>
      <label className="block text-sm font-medium">
        Medidor
        <select
          className={styles.input + ' mt-1'}
          disabled={editing}
          required
          value={String(draft.id_medidor ?? '')}
          onChange={event => onChange('id_medidor', event.target.value)}
        >
          <option value="">Seleccionar medidor</option>
          {meters.map(meter => (
            <option key={meter.id_medidor} value={meter.id_medidor}>
              {meterName(meter.id_medidor)}
            </option>
          ))}
        </select>
      </label>
      {data.meterTypesReady && (
        <label className="block text-sm font-medium">
          Tipo de mantenimiento
          <select
            className={styles.input + ' mt-1'}
            required={!editing || !!typeId}
            disabled={editing && !!typeId}
            value={typeId}
            onChange={event => onChange('id_tima', event.target.value)}
          >
            <option value="">
              {editing && !typeId ? 'Histórico sin tipo' : 'Seleccionar tipo'}
            </option>
            {types.map(type => (
              <option key={type.id_tima} value={type.id_tima}>
                {type.nombre}
              </option>
            ))}
          </select>
          {!editing && meterId && !types.length && (
            <small>Configura los tipos de mantenimiento del medidor para registrar lecturas.</small>
          )}
        </label>
      )}
      <BusinessDateTimeField
        label="Fecha y hora"
        value={String(draft.fecha_lectura ?? '')}
        onChange={value => onChange('fecha_lectura', value)}
      />
      {showReference && <ReadingReference id={referenceId} reading={reference} unit={unit} />}
      <label className="block text-sm font-medium">
        Valor acumulado
        <span className="mt-1 flex items-center gap-2">
          <input
            className={styles.input}
            type="number"
            min="0"
            step="0.01"
            required
            aria-describedby={showReference ? referenceId : undefined}
            value={String(draft.valor ?? '')}
            onChange={event => onChange('valor', event.target.value)}
          />
          {unit && <span className="sm-status sm-status-neutral">{unit}</span>}
        </span>
      </label>
      <label className="block text-sm font-medium">
        Observación
        <textarea
          className={styles.input + ' mt-1'}
          rows={3}
          maxLength={5000}
          value={customized ? String(draft.observacion ?? '') : readingObservation(data, draft)}
          onChange={event => onChange('observacion', event.target.value)}
        />
      </label>
    </>
  );
}
