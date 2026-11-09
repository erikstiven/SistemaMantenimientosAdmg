import { styles } from '../../../../src/components/styles';
import { TableHeader as header, Tag, PageTitle as title } from '../../../../src/components/ui';
import { money, TODAY } from '../../../../src/utils/format';
import { useMaintenance } from '../../maintenance/context';
export default function OrdersPage() {
  const { plans, orders, setOrders, log, asset, current, begin } = useMaintenance();
  return (
    <>
      {title(
        'Órdenes de mantenimiento',
        'Programación, cierre de servicios y consumo de repuestos',
        'Nueva orden',
        () => begin('Orden')
      )}
      <div className={styles.card + ' overflow-x-auto'}>
        <table className="w-full">
          {header([
            'Orden',
            'Equipo',
            'Mantenimiento',
            'Programada',
            'Estado',
            'Costo',
            'Acciones',
          ])}
          <tbody>
            {[...orders].reverse().map(o => {
              const p = plans.find(x => x.id === o.plan);
              const cost = (o.parts || []).reduce((sum, pr) => sum + pr.price * pr.quantity, 0);
              return (
                <tr key={o.id} className="border-t text-sm">
                  <td className="px-4 py-4 font-bold">ORD-{o.id}</td>
                  <td className="px-4 py-4">{asset(p?.asset || 0)}</td>
                  <td className="px-4 py-4">{o.snapshot || p?.name}</td>
                  <td className="px-4 py-4">{o.date}</td>
                  <td className="px-4 py-4">
                    <Tag status={o.status} />
                  </td>
                  <td className="px-4 py-4">{money(cost)}</td>
                  <td className="px-4 py-4">
                    {o.status !== 'Realizada' && o.status !== 'Cancelada' ? (
                      <div className="flex gap-3">
                        <button
                          className="font-semibold text-blue-700"
                          onClick={() =>
                            begin('Completar orden', {
                              order: o.id,
                              doneAt: TODAY,
                              valueAt:
                                p && ['Horas', 'Kilómetros'].includes(p.unit)
                                  ? current(p.asset, p.unit, p.meter)
                                  : '',
                              notes: o.notes || '',
                            })
                          }
                        >
                          Ejecutar
                        </button>
                        <button
                          className="font-semibold text-red-700"
                          onClick={() => {
                            setOrders(os =>
                              os.map(x =>
                                x.id === o.id
                                  ? {
                                      ...x,
                                      status: 'Cancelada',
                                    }
                                  : x
                              )
                            );
                            log('Orden', 'Cancelada ORD-' + o.id);
                          }}
                        >
                          Cancelar
                        </button>
                      </div>
                    ) : (
                      <button
                        className="font-semibold text-blue-700"
                        onClick={() =>
                          begin('Detalle orden', {
                            order: o.id,
                          })
                        }
                      >
                        Ver detalle
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
