import assert from 'node:assert/strict';
import { test } from 'node:test';
import { initialSettings } from '../../../../shared/seed';
import type { MaintenancePlan } from '../../../../shared/types';
import { addDuration } from '../../../utils/format';
import { createMaintenanceEvaluator } from './evaluation';
const plan: MaintenancePlan = {
  id: 1,
  asset: 1,
  name: 'Motor',
  unit: 'Horas',
  freq: 100,
  base: 0,
  alert: 10,
  meter: 1,
  startDate: '2026-11-01',
};
const meters = [
  { id: 1, asset: 1, unit: 'Horas', name: 'Principal', active: true },
  { id: 2, asset: 1, unit: 'Horas', name: 'Secundario', active: true },
];
test('evalúa el medidor del plan sin mezclar lecturas de otro medidor', () => {
  const evaluator = createMaintenanceEvaluator(
    [
      { id: 1, asset: 1, unit: 'Horas', meter: 1, value: 95, date: '2026-11-07' },
      { id: 2, asset: 1, unit: 'Horas', meter: 2, value: 300, date: '2026-11-07' },
    ],
    meters,
    initialSettings,
    '2026-11-07'
  );
  assert.equal(evaluator.evalPlan(plan).status, 'Próximo');
  assert.equal(
    evaluator.evalPlan({ ...plan, second: { unit: 'Días', freq: 1, startDate: '2026-11-01' } })
      .status,
    'Vencido'
  );
  assert.equal(evaluator.evalPlan({ ...plan, active: false }).status, 'Inactivo');
});
test('desactivar avisos conserva los vencimientos y oculta los próximos', () => {
  const evaluator = createMaintenanceEvaluator(
    [{ id: 1, asset: 1, unit: 'Horas', meter: 1, value: 95, date: '2026-11-07' }],
    meters,
    { ...initialSettings, alerts: false },
    '2026-11-07'
  );
  assert.equal(evaluator.evalPlan(plan).status, 'Al día');
  assert.equal(evaluator.evalPlan({ ...plan, freq: 90 }).status, 'Vencido');
});
test('meses calendario respetan el último día del mes', () => {
  assert.equal(addDuration('2026-01-31', 1, 'Meses'), '2026-02-28');
  assert.equal(addDuration('2028-01-31', 1, 'Meses'), '2028-02-29');
});
test('la última lectura se determina por fecha, aunque se registre una lectura histórica después', () => {
  const evaluator = createMaintenanceEvaluator(
    [
      { id: 1, asset: 1, unit: 'Horas', meter: 1, value: 200, date: '2026-11-07' },
      { id: 2, asset: 1, unit: 'Horas', meter: 1, value: 100, date: '2026-11-01' },
    ],
    meters,
    initialSettings
  );
  assert.equal(evaluator.current(1, 'Horas', 1), 200);
});
