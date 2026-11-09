import { controlUnits } from '../../../../shared/seed';
import { styles } from '../../../../src/components/styles';
import { TableHeader as header, Tag, PageTitle as title } from '../../../../src/components/ui';
import { useMaintenance } from '../../maintenance/context';
export default function SettingsPage() {
  const {
    plans,
    readings,
    maintTypes,
    setMaintTypes,
    configSearch,
    setConfigSearch,
    configTab,
    setConfigTab,
    items,
    filter,
    detail,
    log,
    begin,
  } = useMaintenance();
  return (
    <>
      {title('Configuración', 'Administra los catálogos base de SisMant')}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          {
            label: 'Tipos activos',
            value: maintTypes.filter(t => t.active).length,
          },
          {
            label: 'Unidades de control',
            value: controlUnits.length,
          },
          {
            label: 'Planes configurados',
            value: plans.length,
          },
          {
            label: 'Lecturas registradas',
            value: readings.length,
          },
        ].map(k => (
          <div className={styles.card + ' p-4'} key={k.label}>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {k.label}
            </p>
            <p className="mt-2 text-2xl font-bold text-slate-900">{k.value}</p>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">
        {[
          {
            id: 'tipos',
            label: 'Tipos de mantenimiento',
          },
          {
            id: 'unidades',
            label: 'Unidades de control',
          },
        ].map(x => (
          <button
            key={x.id}
            onClick={() => {
              setConfigTab(x.id);
              setConfigSearch('');
            }}
            className={`rounded-lg px-4 py-2 text-sm font-semibold ${configTab === x.id ? 'bg-blue-700 text-white' : 'bg-white text-slate-600 hover:bg-slate-100'}`}
          >
            {x.label}
          </button>
        ))}
      </div>
      {configTab === 'tipos' && (
        <div className={styles.card}>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
            <div>
              <h3 className="font-bold">saetima_mant · Tipos de mantenimiento</h3>
              <p className="mt-1 text-xs text-slate-500">
                Los tipos desactivados dejan de aparecer en nuevos planes, pero sus registros
                históricos se conservan.
              </p>
            </div>
            <button className={styles.button} onClick={() => begin('Tipo mantenimiento')}>
              + Nuevo tipo
            </button>
          </div>
          <div className="border-b p-4">
            <input
              className={styles.input + ' max-w-md'}
              value={configSearch}
              onChange={e => setConfigSearch(e.target.value)}
              placeholder="Buscar tipos por nombre o descripción..."
            />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              {header(['Nombre', 'Descripción', 'Planes vinculados', 'Estado', 'Acciones'])}
              <tbody>
                {maintTypes
                  .filter(t =>
                    (t.name + ' ' + t.description)
                      .toLowerCase()
                      .includes(configSearch.toLowerCase())
                  )
                  .map(t => (
                    <tr className="border-t text-sm" key={t.id}>
                      <td className="px-4 py-4 font-semibold">{t.name}</td>
                      <td className="px-4 py-4 text-slate-600">{t.description || '—'}</td>
                      <td className="px-4 py-4">{plans.filter(p => p.name === t.name).length}</td>
                      <td className="px-4 py-4">
                        <Tag status={t.active ? 'Al día' : 'Inactivo'} />
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex flex-wrap gap-3">
                          <button
                            className="font-semibold text-blue-700"
                            onClick={() => begin('Tipo mantenimiento', t)}
                          >
                            Editar
                          </button>
                          <button
                            className={
                              t.active
                                ? 'font-semibold text-red-700'
                                : 'font-semibold text-green-700'
                            }
                            onClick={() => {
                              setMaintTypes(ts =>
                                ts.map(x =>
                                  x.id === t.id
                                    ? {
                                        ...x,
                                        active: !x.active,
                                      }
                                    : x
                                )
                              );
                              log(
                                'Configuración',
                                (t.active ? 'Desactivado' : 'Activado') + ' tipo: ' + t.name
                              );
                            }}
                          >
                            {t.active ? 'Desactivar' : 'Activar'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
            {maintTypes.filter(t =>
              (t.name + ' ' + t.description).toLowerCase().includes(configSearch.toLowerCase())
            ).length === 0 && (
              <div className="p-6 text-center text-sm text-slate-500">
                No hay tipos que coincidan con la búsqueda.
              </div>
            )}
          </div>
        </div>
      )}
      {configTab === 'unidades' && (
        <div className={styles.card}>
          <div className="border-b px-5 py-4">
            <h3 className="font-bold">saeumd_mant · Unidades de control</h3>
            <p className="mt-1 text-sm text-slate-500">
              Catálogo protegido: cambiar el significado de una unidad alteraría el cálculo de
              vencimientos. Para añadir otra unidad se requiere ampliar la lógica del sistema.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              {header(['Código', 'Unidad', 'Tipo de control', 'Descripción', 'Estado'])}
              <tbody>
                {controlUnits.map(u => (
                  <tr className="border-t text-sm" key={u.code}>
                    <td className="px-4 py-4 font-bold text-blue-800">{u.code}</td>
                    <td className="px-4 py-4">{u.name}</td>
                    <td className="px-4 py-4">{u.kind}</td>
                    <td className="px-4 py-4 text-slate-500">{u.detail}</td>
                    <td className="px-4 py-4">
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                        Protegida
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="p-4 text-xs text-slate-500">
            Las unidades HORAS y KM necesitan un medidor físico del activo. DÍAS y MESES se calculan
            mediante fechas de referencia.
          </p>
        </div>
      )}
    </>
  );
}
