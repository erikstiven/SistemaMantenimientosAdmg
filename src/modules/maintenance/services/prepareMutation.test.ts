import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initialState } from '../../../../shared/state';
import { prepareMutation } from './prepareMutation';
import type { MutationContext } from './mutationContext';
function fixture() {
  const data = initialState(true);
  let writes = 0;
  let logs = 0;
  let notice = '';
  const setter = () => {
    writes++;
  };
  const context: MutationContext = {
    assets: data.assets,
    plans: data.plans,
    readings: data.readings,
    meters: data.meters,
    orders: data.orders,
    maintTypes: data['maintenance-types'],
    appSettings: data['general-settings'],
    items: data.items,
    setAssets: setter,
    setPlans: setter,
    setReadings: setter,
    setMeters: setter,
    setOrders: setter,
    setMaintTypes: setter,
    setAppSettings: setter,
    setItems: setter,
    draft: {},
    partRows: [],
    notice: message => {
      notice = message;
    },
    log: () => {
      logs++;
    },
    asset: () => '',
    current: () => 0,
  };
  return { data, context, result: () => ({ writes, logs, notice }) };
}
test('un formulario inválido no aplica cambios parciales ni registra un éxito en el historial', () => {
  const { data, context, result } = fixture();
  assert.equal(
    prepareMutation(
      ctx => {
        ctx.setAssets(previous => [
          ...previous,
          { id: 999, code: 'TEST', name: 'Prueba', type: 'Equipo' },
        ]);
        ctx.setItems([{ name: 'Repuesto', unit: 'Unidad', price: -1 }]);
        ctx.log('Prueba', 'No guardar');
        return true;
      },
      context,
      data
    ),
    false
  );
  assert.equal(result().writes, 0);
  assert.equal(result().logs, 0);
  assert(result().notice.includes('items'));
});
test('confirma todos los módulos y el historial después de validar', () => {
  const { data, context, result } = fixture();
  assert.equal(
    prepareMutation(
      ctx => {
        ctx.setAssets(previous => [
          ...previous,
          { id: 999, code: 'TEST', name: 'Prueba', type: 'Equipo' },
        ]);
        ctx.setItems(previous => [...previous, { name: 'Repuesto', unit: 'Unidad', price: 1 }]);
        ctx.log('Prueba', 'Guardado');
        return true;
      },
      context,
      data
    ),
    true
  );
  assert.equal(result().writes, 2);
  assert.equal(result().logs, 1);
});
