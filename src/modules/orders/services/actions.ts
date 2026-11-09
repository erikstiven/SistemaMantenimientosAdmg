import { TODAY, money } from '../../../utils/format';
import type { MutationContext } from '../../maintenance/services/mutationContext';
export function saveOrder({ setOrders, draft, notice, log }: MutationContext): boolean {
  if (!draft.plan) {
    notice('Selecciona plan');
    return false;
  }
  setOrders(os => [
    ...os,
    {
      id: Date.now(),
      plan: Number(draft.plan),
      date: draft.date || TODAY,
      status: 'Pendiente',
      notes: draft.notes || '',
    },
  ]);
  log('Orden', 'Nueva orden para plan ' + draft.plan);

  return true;
}
export function completeOrder({
  plans,
  orders,
  items,
  setPlans,
  setOrders,
  draft,
  partRows,
  notice,
  log,
  asset,
  current,
}: MutationContext): boolean {
  const order = orders.find(o => o.id === Number(draft.order));
  const plan = plans.find(p => p.id === order?.plan);
  if (!order || !plan || order.status === 'Realizada' || order.status === 'Cancelada') {
    notice('No se encontró la orden');
    return false;
  }
  const value = Number(draft.valueAt);
  if (
    ['Horas', 'Kilómetros'].includes(plan.unit) &&
    (!Number.isFinite(value) || draft.valueAt === '' || value < 0)
  ) {
    notice('Registra la lectura al realizar el servicio');
    return false;
  }
  if (
    ['Horas', 'Kilómetros'].includes(plan.unit) &&
    value > current(plan.asset, plan.unit, plan.meter)
  ) {
    notice('Registra primero la lectura actual en Medidores y lecturas');
    return false;
  }
  if (partRows.some(pr => !items[pr.index] || !Number.isFinite(pr.quantity) || pr.quantity <= 0)) {
    notice('Selecciona repuestos y cantidades mayores a cero');
    return false;
  }
  const parts = partRows
    .map(pr => ({
      index: pr.index,
      quantity: pr.quantity,
      price: items[pr.index]?.price || 0,
      name: items[pr.index]?.name || 'Repuesto',
    }))
    .filter(x => x.quantity > 0);
  const snapshot =
    plan.name +
    ' · ' +
    plan.freq +
    ' ' +
    plan.unit +
    (plan.second ? ' o ' + plan.second.freq + ' ' + plan.second.unit : '');
  const doneAt = draft.doneAt || TODAY;
  setOrders(os =>
    os.map(o =>
      o.id === order.id
        ? {
            ...o,
            status: 'Realizada',
            doneAt,
            valueAt: ['Horas', 'Kilómetros'].includes(plan.unit) ? value : undefined,
            notes: draft.notes || o.notes || '',
            parts,
            snapshot,
          }
        : o
    )
  );
  if (plan.active !== false)
    setPlans(ps =>
      ps.map(p =>
        p.id === plan.id
          ? {
              ...p,
              base: ['Horas', 'Kilómetros'].includes(p.unit) ? value : p.base,
              startDate: doneAt,
              second: p.second
                ? {
                    ...p.second,
                    startDate: doneAt,
                    base: ['Horas', 'Kilómetros'].includes(p.second.unit)
                      ? current(p.asset, p.second.unit, p.second.meter)
                      : p.second.base,
                  }
                : undefined,
            }
          : p
      )
    );
  log(
    'Servicio realizado',
    'ORD-' +
      order.id +
      ' · ' +
      asset(plan.asset) +
      ' · ' +
      plan.name +
      ' · ' +
      money(parts.reduce((sum, x) => sum + x.price * x.quantity, 0))
  );

  return true;
}
