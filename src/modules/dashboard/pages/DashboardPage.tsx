import { styles } from '../../../../src/components/styles';
import { TableHeader as header, Tag, PageTitle as title } from '../../../../src/components/ui';
import { guideSteps } from '../../../../src/modules/maintenance/config';
import { useMaintenance } from '../../maintenance/context';
export default function DashboardPage() {
  const { setPage, assets, plans, orders, items, filter, asset, evalPlan, alertCount } =
    useMaintenance();
  return (
    <>
      {title('Dashboard', 'Resumen general del estado de mantenimiento de la flota')}
      <section className={styles.card + ' p-5'} aria-labelledby="guided-flow-title">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 id="guided-flow-title" className="text-lg font-bold text-slate-900">
              Flujo guiado del prototipo
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Sigue esta ruta para demostrar SisMant al cliente sin perder historial ni datos
              simulados.
            </p>
          </div>
          <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
            10 pasos
          </span>
        </div>
        <ol className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {guideSteps.map(step => (
            <li key={step.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <span className="text-xs font-bold uppercase tracking-wide text-blue-700">
                {step.title}
              </span>
              <p className="mt-2 text-sm text-slate-600">{step.text}</p>
            </li>
          ))}
        </ol>
      </section>
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-5">
        {[
          ['Activos', assets.length, 'Activos'],
          ['Al día', plans.filter(p => evalPlan(p).status === 'Al día').length, 'Planes'],
          [
            'Próximos',
            plans.filter(p => evalPlan(p).status === 'Próximo').length,
            'Alertas e historial',
          ],
          ['Vencidos', alertCount, 'Alertas e historial'],
          ['Órdenes realizadas', orders.filter(o => o.status === 'Realizada').length, 'Órdenes'],
        ].map(([name, n, target]) => (
          <button
            className={styles.card + ' p-5 text-left hover:border-blue-400'}
            onClick={() => setPage(String(target))}
            key={name}
          >
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{name}</p>
            <p className="mt-3 text-3xl font-extrabold">{n}</p>
            <p className="mt-2 text-xs font-semibold text-blue-700">Ver detalle →</p>
          </button>
        ))}
      </div>
      <div className={styles.card}>
        <h3 className="border-b px-5 py-4 font-bold">Próximos mantenimientos</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            {header(['Equipo', 'Mantenimiento', 'Vencimiento', 'Estado'])}
            <tbody>
              {plans.map(p => (
                <tr className="border-t text-sm" key={p.id}>
                  <td className="px-4 py-4 font-semibold">{asset(p.asset)}</td>
                  <td className="px-4 py-4">{p.name}</td>
                  <td className="px-4 py-4">{evalPlan(p).remaining}</td>
                  <td className="px-4 py-4">
                    <Tag status={evalPlan(p).status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className={styles.card + ' p-5'}>
        <b>Simulador de mantenimiento</b>
        <p className="mt-2 text-sm text-slate-500">
          Prueba cómo cambian los estados cuando aumentan las lecturas del horómetro o del odómetro.
        </p>
        <button className={styles.button + ' mt-4'} onClick={() => setPage('Simulación')}>
          Abrir simulación →
        </button>
      </div>
    </>
  );
}
