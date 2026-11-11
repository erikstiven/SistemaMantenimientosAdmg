import assert from 'node:assert/strict';
import { test } from 'node:test';
import { config, fixture, password, seedUser } from './fixtures.ts';
import { AuthService } from '../modules/auth/auth.service.ts';
import { RelationalRepository } from '../modules/maintenance/relational.repository.ts';
import { RelationalService } from '../modules/maintenance/relational.service.ts';
import { evaluatePlan } from '../../shared/maintenance-evaluation.ts';
import { lastValidReadingAt } from '../../shared/relational.ts';
import { defaultPermissions } from '../../shared/permissions.ts';

test('un medidor conserva cinco series independientes al registrar, corregir, anular y completar servicios', async () => {
  const databases = await fixture();
  try {
    const { db, definition } = databases.get('principal');
    const auth = new AuthService(databases, config);
    const user = (await auth.login('principal', 'admin', password)).user;
    const repository = new RelationalRepository(db, definition);
    const service = new RelationalService(repository);
    let data = await service.read(user);
    const meter = await service.meter(user, data.revision, {
      id_activo: '1001',
      id_um: '1',
      codigo: 'MULTI',
      nombre_medidor: 'Horómetro',
      estado: true,
    });
    const meterId = meter.id!;
    data = await service.read(user);
    await assert.rejects(
      service.reading(user, data.revision, {
        id_medidor: meterId,
        fecha_lectura: '2026-01-01T08:00',
        valor: '10',
      }),
      { status: 422 }
    );
    const types = ['1'];
    for (const name of ['Aceite', 'Hidráulico', 'General', 'Inspección eléctrica']) {
      const type = await service.catalog(user, data.revision, 'types', { nombre: name });
      types.push(type.id!);
      data = await service.read(user);
    }
    for (const typeId of types) {
      await service.meterType(user, data.revision, meterId, { id_tima: typeId });
      data = await service.read(user);
    }
    assert.equal(data.meterTypes?.filter(row => row.id_medidor === meterId).length, 5);
    await assert.rejects(
      service.reading(user, data.revision, {
        id_medidor: meterId,
        id_tima: '999',
        fecha_lectura: '2026-01-01T08:00',
        valor: '10',
      }),
      { status: 422 }
    );
    for (let index = 0; index < types.length; index++) {
      await service.reading(user, data.revision, {
        id_medidor: meterId,
        id_tima: types[index],
        fecha_lectura: '2026-01-01T08:00',
        valor: String(10 + index * 100),
      });
      data = await service.read(user);
    }
    const plans: string[] = [];
    for (const typeId of types.slice(0, 2)) {
      const plan = await service.plan(user, data.revision, {
        id_activo: '1001',
        id_tima: typeId,
        nombre_plan: 'Plan ' + typeId,
        fecha_inicio: '2026-01-01',
        condicion: 'OR',
        reglas: [
          {
            id_um: '1',
            id_medidor: meterId,
            frecuencia: '200',
            valor_base: '0',
            alerta_antes: '20',
          },
        ],
      });
      plans.push(plan.id!);
      data = await service.read(user);
    }
    const beforeOil = evaluatePlan(
      data,
      data.plans.find(row => row.id_plan === plans[1])!,
      '2026-02-01'
    );
    const reading = data.readings.find(row => row.id_tima === types[0])!;
    await service.reading(
      user,
      data.revision,
      {
        id_medidor: meterId,
        id_tima: types[0],
        fecha_lectura: reading.fecha_lectura,
        valor: '150',
        observacion: 'Corrección',
      },
      reading.id_lectura
    );
    data = await service.read(user);
    assert.deepEqual(
      evaluatePlan(data, data.plans.find(row => row.id_plan === plans[1])!, '2026-02-01'),
      beforeOil
    );
    assert.equal(lastValidReadingAt(data.readings, meterId, undefined, types[1])?.valor, '110');
    const order = await service.order(user, data.revision, { id_plan: plans[0] });
    await service.complete(user, order.revision, order.id!, {
      fecha_realizada: '2026-02-01T09:00',
      valor_realizado: '180',
      registrar_lectura: true,
      detalles: [],
    });
    data = await service.read(user);
    assert.equal(
      Number(lastValidReadingAt(data.readings, meterId, undefined, types[0])?.valor),
      180
    );
    assert.equal(
      Number(lastValidReadingAt(data.readings, meterId, undefined, types[1])?.valor),
      110
    );
    await service.voidReading(
      user,
      data.revision,
      data.readings.find(row => row.id_tima === types[1])!.id_lectura
    );
    data = await service.read(user);
    assert.equal(lastValidReadingAt(data.readings, meterId, undefined, types[1]), undefined);
    assert.equal(
      Number(lastValidReadingAt(data.readings, meterId, undefined, types[0])?.valor),
      180
    );
    await seedUser(db, 'consulta-medidas', 'viewer');
    const viewer = (await auth.login('principal', 'consulta-medidas', password)).user;
    await assert.rejects(service.meterType(viewer, data.revision, meterId, { id_tima: types[0] }), {
      status: 403,
    });
    const policy = await service.saveRole(
      user,
      data.revision,
      'technician',
      defaultPermissions('technician').filter(permission => permission !== 'types.read')
    );
    await seedUser(db, 'operador-sin-tipos', 'technician');
    const operator = (await auth.login('principal', 'operador-sin-tipos', password)).user;
    await assert.rejects(
      service.meterType(operator, policy.revision, meterId, { id_tima: types[0] }),
      { status: 403 }
    );
  } finally {
    await databases.close();
  }
});
