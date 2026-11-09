import { styles } from '../../../../src/components/styles';
import { TableHeader as header, Tag, PageTitle as title } from '../../../../src/components/ui';
import { format } from '../../../../src/utils/format';
import { useMaintenance } from '../../maintenance/context';
export default function MetersPage() {
  const { readings, meters, asset, current, begin } = useMaintenance();
  return (
    <>
      {title(
        'Medidores y lecturas',
        'Identificación de medidores e historial acumulado',
        'Registrar lectura',
        () => begin('Lectura')
      )}
      <div className="flex flex-wrap gap-2">
        <button className={styles.button} onClick={() => begin('Medidor')}>
          + Nuevo medidor
        </button>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {meters.map(m => (
          <div key={m.id} className={styles.card + ' p-5'}>
            <p className="text-xs text-slate-500">{asset(m.asset)}</p>
            <div className="mt-1 flex justify-between">
              <b>{m.name}</b>
              <Tag status={m.active ? 'Activo' : 'Inactivo'} />
            </div>
            <p className="mt-4 text-3xl font-extrabold">
              {format(current(m.asset, m.unit, m.id))}
              <span className="ml-2 text-sm text-slate-400">{m.unit === 'Horas' ? 'h' : 'km'}</span>
            </p>
            <button
              className="mt-3 text-sm font-semibold text-blue-700"
              onClick={() =>
                begin('Lectura', {
                  asset: m.asset,
                  meter: m.id,
                  unit: m.unit,
                })
              }
            >
              + Registrar lectura
            </button>
          </div>
        ))}
      </div>
      <div className={styles.card}>
        <h3 className="border-b p-4 font-bold">Historial de lecturas</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            {header(['Equipo', 'Medidor', 'Fecha', 'Valor'])}
            <tbody>
              {[...readings].reverse().map(r => (
                <tr className="border-t text-sm" key={r.id}>
                  <td className="px-4 py-3">{asset(r.asset)}</td>
                  <td className="px-4 py-3">
                    {meters.find(m => m.id === r.meter)?.name || r.unit}
                  </td>
                  <td className="px-4 py-3">{r.date}</td>
                  <td className="px-4 py-3 font-semibold">
                    {format(r.value)} {r.unit === 'Horas' ? 'h' : 'km'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
