import { styles } from '../../../../src/components/styles';
import { Tag, PageTitle as title } from '../../../../src/components/ui';
import { useMaintenance } from '../../maintenance/context';
export default function HistoryPage() {
  const { plans, history, items, filter, asset, evalPlan } = useMaintenance();
  return (
    <>
      {title('Alertas e historial', 'Mantenimientos vencidos, próximos y seguimiento de actividad')}
      <div className="flex gap-3">
        {['Vencido', 'Próximo', 'Al día'].map(x => (
          <div className={styles.card + ' px-5 py-4'}>
            <Tag status={x} />
            <p className="mt-2 text-2xl font-bold">
              {plans.filter(p => evalPlan(p).status === x).length}
            </p>
          </div>
        ))}
      </div>
      <div className="space-y-3">
        {plans
          .filter(p => p.active !== false)
          .map(p => (
            <div
              className={styles.card + ' flex flex-wrap items-center justify-between gap-3 p-4'}
              key={p.id}
            >
              <div>
                <b>
                  {asset(p.asset)} — {p.name}
                </b>
                <p className="text-sm text-slate-500">{evalPlan(p).remaining}</p>
              </div>
              <Tag status={evalPlan(p).status} />
            </div>
          ))}
      </div>
      <div className={styles.card + ' p-5'}>
        <b>Bitácora de actividad</b>
        {history.map(h => (
          <div key={h.id} className="mt-3 border-t pt-3 text-sm">
            <span className="font-semibold text-blue-700">{h.kind}</span> · {h.date} · {h.text}
          </div>
        ))}
      </div>
    </>
  );
}
