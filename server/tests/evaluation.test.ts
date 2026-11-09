import assert from 'node:assert/strict';
import { test } from 'node:test';
import { calendarDue, evaluatePlan } from '../../shared/maintenance-evaluation.ts';
import { pgId, subtotal, cents, decimal, type RelationalData } from '../../shared/relational.ts';
function scenario(): RelationalData {
  return {
    revision: 0,
    warnings: [],
    assets: [],
    types: [],
    parts: [],
    details: [],
    audit: [],
    units: [
      { id_um: '1', codigo: 'H', nombre: 'Horas', tipo_control: 'MEDIDOR', estado: true },
      { id_um: '4', codigo: 'MES', nombre: 'Meses', tipo_control: 'CALENDARIO', estado: true },
    ],
    meters: [
      {
        id_medidor: '5',
        id_activo: '9007199254740993',
        id_um: '1',
        codigo: 'H1',
        nombre_medidor: 'Horómetro',
        estado: true,
      },
    ],
    plans: [
      {
        id_plan: '1',
        id_activo: '9007199254740993',
        id_tima: '1',
        nombre_plan: 'Motor',
        fecha_inicio: '2020-01-31',
        fecha_fin: null,
        observacion: '',
        estado: 'ACTIVO',
      },
    ],
    rules: [
      {
        id_regla: '1',
        id_plan: '1',
        id_medidor: '5',
        id_um: '1',
        frecuencia: '250',
        valor_base: '1000',
        alerta_antes: '50',
        condicion: 'OR',
        orden_eval: 1,
        estado: true,
      },
      {
        id_regla: '2',
        id_plan: '1',
        id_medidor: null,
        id_um: '4',
        frecuencia: '1',
        valor_base: null,
        alerta_antes: '7',
        condicion: 'OR',
        orden_eval: 2,
        estado: true,
      },
    ],
    readings: [
      {
        id_lectura: '1',
        id_medidor: '5',
        fecha_lectura: '2020-03-01T08:00:00',
        valor: '1700',
        observacion: '',
      },
    ],
    orders: [
      {
        id_ordm: '1',
        id_plan: '1',
        fecha_programada: null,
        fecha_realizada: '2020-02-29T09:00:00',
        valor_realizado: '1400',
        valor_programado: null,
        estado: 'REALIZADA',
        observacion: '',
      },
      {
        id_ordm: '2',
        id_plan: '1',
        fecha_programada: '2020-03-01',
        fecha_realizada: null,
        valor_realizado: null,
        valor_programado: null,
        estado: 'CANCELADO',
        observacion: '',
      },
    ],
  };
}
test('ciclo desde ejecución válida sin cambiar base inicial; OR y AND producen vencimientos distintos', () => {
  const data = scenario(),
    original = structuredClone(data);
  const either = evaluatePlan(data, data.plans[0], '2020-03-01');
  assert.equal(either.rules[0].target, '1650.00');
  assert.equal(either.rules[1].target, '2020-03-29');
  assert.equal(either.status, 'VENCIDO');
  assert.deepEqual(data, original);
  data.rules.forEach(r => {
    r.condicion = 'AND';
  });
  assert.equal(evaluatePlan(data, data.plans[0], '2020-03-01').status, 'AL_DIA');
  assert.equal(evaluatePlan(data, data.plans[0], '2020-03-29').status, 'VENCIDO');
});
test('meses calendario respetan fin de mes, bisiestos y alertas expresadas en días', () => {
  assert.equal(calendarDue('2020-01-31', '1', 'MES'), '2020-02-29');
  assert.equal(calendarDue('2020-02-29', '12', 'MES'), '2021-02-28');
  assert.equal(calendarDue('2020-02-29', '1', 'DIA'), '2020-03-01');
  const data = scenario();
  data.rules = data.rules.filter(r => !r.id_medidor);
  data.rules[0].frecuencia = '12';
  data.rules[0].alerta_antes = '30';
  assert.equal(evaluatePlan(data, data.plans[0], '2021-02-01').status, 'PROXIMO');
  assert.throws(() => calendarDue('2020-01-01', '1.5', 'MES'));
});
test('cada regla usa su medidor, respeta vigencia y no inventa ciclos multimedidor', () => {
  const data = scenario();
  data.readings.push({ ...data.readings[0], id_lectura: '2', id_medidor: '99', valor: '999999' });
  assert.equal(evaluatePlan(data, data.plans[0], '2020-03-01').rules[0].remaining, '-50.00 Horas');
  data.readings = [];
  assert.equal(evaluatePlan(data, data.plans[0], '2020-03-01').status, 'SIN_LECTURA');
  data.plans[0].fecha_fin = '2020-02-29';
  assert.equal(evaluatePlan(data, data.plans[0], '2020-03-01').status, 'FUERA_VIGENCIA');
  data.plans[0].fecha_fin = null;
  data.rules.push({ ...data.rules[0], id_regla: '3', id_medidor: '99', orden_eval: 3 });
  assert.equal(evaluatePlan(data, data.plans[0], '2020-03-01').status, 'CONFIGURACION_INVALIDA');
});
test('BIGINT y redondeo decimal conservan precisión fuera del rango seguro de JavaScript', () => {
  assert.equal(pgId.parse('9007199254740993'), '9007199254740993');
  assert.equal(pgId.safeParse('9223372036854775808').success, false);
  assert.equal(subtotal('1.50', '0.67'), '1.01');
  assert.equal(subtotal('1', '999999999999.99'), '999999999999.99');
  assert.equal(decimal(cents('0.10') + cents('0.20')), '0.30');
});
