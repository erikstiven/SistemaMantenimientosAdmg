import { useId, useMemo } from 'react';
import type { RelationalData } from '../../../../shared/relational';
import { styles } from '../../../components/styles';
import type { Draft } from '../RelationalEditor';

import { latestValidReadings, readingObservation, readingUnit } from '../reading-format';
import { ReadingReference } from './ReadingReference';

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
  const unit = readingUnit(data, meterId);
  const showReference = !editing && meters.some(meter => meter.id_medidor === meterId);
  const reference = latest.get(meterId);
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
      <label className="block text-sm font-medium">
        Fecha y hora
        <input
          className={styles.input + ' mt-1'}
          type="datetime-local"
          step="1"
          required
          value={String(draft.fecha_lectura ?? '')}
          onChange={event => onChange('fecha_lectura', event.target.value)}
        />
      </label>
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
