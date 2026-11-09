import { styles } from '../../../../src/components/styles';
import { TableHeader as header, PageTitle as title } from '../../../../src/components/ui';
import { format } from '../../../../src/utils/format';
import { useMaintenance } from '../../maintenance/context';
export default function AssetsPage() {
  const {
    assets,
    setAssets,
    plans,
    orders,
    meters,
    filter,
    setFilter,
    detail,
    setDetail,
    log,
    asset,
    current,
    evalPlan,
    begin,
  } = useMaintenance();
  return (
    <>
      {title('Gestión de activos', 'Registro de equipos y vehículos', 'Nuevo activo', () =>
        begin('Activo')
      )}
      <div className={styles.card}>
        <div className="flex flex-wrap gap-3 border-b p-4">
          <input
            value={filter}
            onChange={e => setFilter(e.target.value)}
            className={styles.input + ' max-w-sm'}
            placeholder="Buscar por código o nombre"
          />
          <span className="self-center text-sm text-slate-500">
            {assets.length} equipos registrados
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            {header(['Código', 'Nombre', 'Tipo', 'Planes activos', 'Acciones'])}
            <tbody>
              {assets
                .filter(a => (a.name + a.code).toLowerCase().includes(filter.toLowerCase()))
                .map(a => (
                  <tr className="border-t text-sm" key={a.id}>
                    <td className="px-4 py-4 font-bold text-blue-800">{a.code}</td>
                    <td className="px-4 py-4">{a.name}</td>
                    <td className="px-4 py-4">{a.type}</td>
                    <td className="px-4 py-4">
                      {plans.filter(p => p.asset === a.id && p.active !== false).length}
                    </td>
                    <td className="px-4 py-4">
                      <button
                        className="mr-4 font-semibold text-blue-700"
                        onClick={() => setDetail(detail === a.id ? null : a.id)}
                      >
                        Ver ficha
                      </button>
                      <button className="text-slate-500" onClick={() => begin('Activo', a)}>
                        Editar
                      </button>
                      <button
                        className="ml-3 text-amber-700"
                        onClick={() => {
                          setAssets(xs =>
                            xs.map(x =>
                              x.id === a.id
                                ? {
                                    ...x,
                                    active: x.active === false,
                                  }
                                : x
                            )
                          );
                          log('Activo', 'Estado modificado: ' + a.name);
                        }}
                      >
                        {a.active === false ? 'Activar' : 'Desactivar'}
                      </button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
      {detail !== null && (
        <div className={styles.card + ' p-5'}>
          <div className="flex justify-between">
            <h3 className="text-lg font-bold">Ficha: {asset(detail)}</h3>
            <button onClick={() => setDetail(null)}>✕</button>
          </div>
          <div className="mt-4 grid gap-5 md:grid-cols-3">
            <div>
              <b className="text-sm">Medidores</b>
              {meters
                .filter(m => m.asset === detail)
                .map(m => (
                  <div key={m.id} className="mt-2 rounded-lg bg-slate-50 p-3 text-sm">
                    {m.name}
                    <b className="block">
                      {format(current(detail, m.unit, m.id))} {m.unit}
                    </b>
                  </div>
                ))}
            </div>
            <div>
              <b className="text-sm">Planes</b>
              {plans
                .filter(p => p.asset === detail)
                .map(p => (
                  <div key={p.id} className="mt-2 rounded-lg bg-slate-50 p-3 text-sm">
                    {p.name} · {p.active === false ? 'Histórico' : evalPlan(p).status}
                  </div>
                ))}
            </div>
            <div>
              <b className="text-sm">Historial de órdenes</b>
              {orders
                .filter(o => plans.some(p => p.id === o.plan && p.asset === detail))
                .map(o => (
                  <div key={o.id} className="mt-2 rounded-lg bg-slate-50 p-3 text-sm">
                    ORD-{o.id} · {o.status}
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
