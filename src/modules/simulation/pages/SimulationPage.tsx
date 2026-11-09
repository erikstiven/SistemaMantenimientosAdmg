import { useState } from 'react';
import { styles } from '../../../../src/components/styles';
import { Tag, PageTitle as title } from '../../../../src/components/ui';
import { format, TODAY } from '../../../../src/utils/format';
import { useMaintenance } from '../../maintenance/context';
import { createMaintenanceEvaluator } from '../../maintenance/services/evaluation';
export default function SimulationPage() {
  const { plans, readings, meters, appSettings, asset } = useMaintenance();
  const [simulatedReadings, setReadings] = useState(readings);
  const { current, evalPlan } = createMaintenanceEvaluator(simulatedReadings, meters, appSettings);
  const baseline = createMaintenanceEvaluator(readings, meters, appSettings).current;
  return (
    <>
      {title(
        'Simulación de mantenimiento',
        'Ajusta las lecturas y verifica qué planes se aproximan o vencen'
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className={styles.card + ' p-5'}>
          <h3 className="font-bold">Contadores</h3>
          <p className="mt-1 text-sm text-slate-500">
            Las lecturas de esta simulación son temporales.
          </p>
          <button className="mt-2 text-sm text-blue-700" onClick={() => setReadings(readings)}>
            Restablecer simulación
          </button>
          {meters
            .filter(m => ['Horas', 'Kilómetros'].includes(m.unit))
            .map(m => (
              <div className="mt-5 rounded-lg border p-4" key={m.id}>
                <p className="text-sm font-semibold">
                  {asset(m.asset)} · {m.name}
                </p>
                <p className="text-sm text-slate-500">
                  {format(current(m.asset, m.unit, m.id))} {m.unit}
                </p>
                <input
                  type="range"
                  className="mt-3 w-full accent-blue-700"
                  min={baseline(m.asset, m.unit, m.id)}
                  max={baseline(m.asset, m.unit, m.id) + (m.unit === 'Horas' ? 750 : 10000)}
                  step={m.unit === 'Horas' ? 25 : 250}
                  value={current(m.asset, m.unit, m.id)}
                  onChange={e =>
                    setReadings(rs => [
                      ...rs,
                      {
                        id: Date.now() + Math.random(),
                        asset: m.asset,
                        meter: m.id,
                        unit: m.unit,
                        value: Number(e.target.value),
                        date: TODAY,
                      },
                    ])
                  }
                />
              </div>
            ))}
        </div>
        <div className={styles.card + ' p-5'}>
          <h3 className="font-bold">Evaluación automática</h3>
          {plans
            .filter(p => p.active !== false)
            .map(p => (
              <div
                className="mt-4 flex items-center justify-between gap-3 border-b pb-3 text-sm"
                key={p.id}
              >
                <div>
                  <b>{p.name}</b>
                  <p className="text-slate-500">
                    {asset(p.asset)} · {evalPlan(p).remaining}
                  </p>
                </div>
                <Tag status={evalPlan(p).status} />
              </div>
            ))}
        </div>
      </div>
    </>
  );
}
