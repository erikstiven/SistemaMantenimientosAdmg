import { styles } from '../../../../src/components/styles';
import { Tag, PageTitle as title } from '../../../../src/components/ui';
import { format, TODAY } from '../../../../src/utils/format';
import { useMaintenance } from '../../maintenance/context';
export default function PlansPage() {
  const { plans, setPlans, meters, log, asset, ruleEval, evalPlan, begin } = useMaintenance();
  return (
    <>
      {title(
        'Planes de mantenimiento',
        'Definición de frecuencias, reglas combinadas y vigencias',
        'Nuevo plan',
        () => begin('Plan')
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        {plans.map(p => (
          <div className={styles.card + ' p-5'} key={p.id}>
            <div className="flex justify-between gap-4">
              <div>
                <p className="text-xs font-semibold text-blue-700">{asset(p.asset)}</p>
                <h3 className="mt-1 text-lg font-bold">{p.name}</h3>
                <p className="mt-1 text-xs text-slate-500">
                  Plan #{p.id} · Inicio {p.startDate || 'No registrado'}
                </p>
              </div>
              {p.active === false ? <Tag status="Inactivo" /> : <Tag status={evalPlan(p).status} />}
            </div>
            <div className="mt-4 rounded-lg bg-slate-50 p-4 text-sm">
              Regla 1: cada{' '}
              <b>
                {format(p.freq)} {p.unit.toLowerCase()}
              </b>
              <p className="mt-1 text-slate-500">
                {['Horas', 'Kilómetros'].includes(p.unit)
                  ? 'Base: ' +
                    format(p.base) +
                    ' · Medidor: ' +
                    (meters.find(m => m.id === p.meter)?.name || p.unit)
                  : 'Desde: ' + (p.startDate || TODAY)}{' '}
                · Avisar antes: {p.alert}
              </p>
            </div>
            {p.second && (
              <div className="mt-2 rounded-lg bg-blue-50 p-3 text-sm">
                Regla 2 (OR): cada{' '}
                <b>
                  {format(p.second.freq)} {p.second.unit.toLowerCase()}
                </b>{' '}
                · {ruleEval(p, p.second).remaining}
              </div>
            )}
            <div className="mt-4 flex flex-wrap justify-between gap-3 text-sm">
              <span className="text-slate-500">{evalPlan(p).remaining}</span>
              <div className="flex flex-wrap gap-3">
                {p.active !== false && (
                  <>
                    <button
                      className="font-semibold text-blue-700"
                      onClick={() =>
                        begin('Regla', {
                          plan: p.id,
                          unit: 'Meses',
                          freq: 6,
                          startDate: p.startDate,
                          alert: 30,
                        })
                      }
                    >
                      + Regla
                    </button>
                    <button
                      className="font-semibold text-blue-700"
                      onClick={() =>
                        begin('Cambiar control', {
                          plan: p.id,
                          asset: p.asset,
                          unit: p.unit,
                          freq: p.freq,
                          base: p.base,
                          alert: p.alert,
                          startDate: TODAY,
                          meter: p.meter,
                        })
                      }
                    >
                      Cambiar control
                    </button>
                    <button
                      className="text-red-700"
                      onClick={() => {
                        setPlans(ps =>
                          ps.map(x =>
                            x.id === p.id
                              ? {
                                  ...x,
                                  active: false,
                                  endDate: TODAY,
                                }
                              : x
                          )
                        );
                        log('Plan', 'Desactivado plan #' + p.id);
                      }}
                    >
                      Cerrar plan
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
      <p className="text-sm text-slate-500">
        Al cambiar la unidad se cierra el plan previo y se crea otro: las órdenes anteriores
        conservan su referencia histórica.
      </p>
    </>
  );
}
