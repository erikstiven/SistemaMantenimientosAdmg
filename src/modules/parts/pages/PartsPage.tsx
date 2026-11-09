import { styles } from '../../../../src/components/styles';
import { TableHeader as header, PageTitle as title } from '../../../../src/components/ui';
import { money } from '../../../../src/utils/format';
import { useMaintenance } from '../../maintenance/context';
export default function PartsPage() {
  const { orders, items, filter, begin } = useMaintenance();
  return (
    <>
      {title(
        'Catálogo de repuestos',
        'Insumos y materiales utilizados en las órdenes',
        'Nuevo repuesto',
        () => begin('Repuesto')
      )}
      <div className={styles.card + ' overflow-x-auto'}>
        <table className="w-full">
          {header(['Código', 'Nombre', 'Unidad', 'Costo referencial'])}
          <tbody>
            {items.map((r, i) => (
              <tr key={i} className="border-t text-sm">
                <td className="px-4 py-4">REP{String(i + 1).padStart(3, '0')}</td>
                <td className="px-4 py-4 font-semibold">{r.name}</td>
                <td className="px-4 py-4">{r.unit}</td>
                <td className="px-4 py-4">{money(r.price)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className={styles.card + ' p-5'}>
        <h3 className="font-bold">Consumo histórico en órdenes realizadas</h3>
        {orders
          .filter(o => o.status === 'Realizada')
          .map(o => (
            <div key={o.id} className="mt-3 border-t pt-3 text-sm">
              <b>ORD-{o.id}</b> ·{' '}
              {(o.parts || []).map(p => p.name + ' × ' + p.quantity).join(', ') || 'Sin repuestos'}{' '}
              · {money((o.parts || []).reduce((sum, p) => sum + p.price * p.quantity, 0))}
            </div>
          ))}
      </div>
    </>
  );
}
