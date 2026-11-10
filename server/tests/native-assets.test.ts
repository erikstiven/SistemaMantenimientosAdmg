import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Databases } from '../database.ts';
import { AuthService } from '../modules/auth/auth.service.ts';
import { RelationalRepository } from '../modules/maintenance/relational.repository.ts';
import { RelationalService } from '../modules/maintenance/relational.service.ts';
import { config, fixture, password, seedUser } from './fixtures.ts';

test('activo ERP S: identidad automática, sucursal administrativa y flujo completo de mantenimiento', async () => {
  const databases = await fixture();
  try {
    const connection = databases.get('principal');
    connection.definition.assetIntegrationView = undefined;
    connection.definition.assetNamespace = 1;
    connection.definition.adminAssetScope = 'company';
    await connection.db.query(`INSERT INTO public.saeact VALUES
      (101,1,2,'MOLINO DE BOLAS',1,'S','MEP-MS-00022','2018-05-10'),
      (102,1,2,'ZARANDAS',1,'N','MEP-MS-00021','2019-03-15'),
      (101,2,2,'Equipo de otra empresa',1,'S','OTRA-EMPRESA','2018-05-10');
      UPDATE comercial.usuario SET sucursal_id=3 WHERE usuario_id=1`);
    const auth = new AuthService(databases, config);
    const { user } = await auth.login('principal', 'Admin', password);
    assert.equal(user.assetScope,'company');
    const repository = new RelationalRepository(connection.db, connection.definition);
    const service = new RelationalService(repository);
    let data = await repository.snapshot(user);
    const molino = data.assets.find(a => a.act_cod_act === '101' && a.sucursal_id === '2');
    assert(molino);
    assert.equal(molino.clave, 'MEP-MS-00022');
    assert.equal(molino.act_usa_mant, 'S');
    assert.notEqual(molino.id_activo, '101');
    assert.equal(data.warnings.length, 0);
    assert(!data.assets.some(a => a.empresa_id === '2'));
    const zarandas = data.assets.find(a => a.act_cod_act === '102');
    assert(zarandas);
    assert.equal(zarandas.act_usa_mant, 'N');
    assert.equal(
      (await repository.snapshot(user)).assets.find(a => a.act_cod_act === '101')?.id_activo,
      molino.id_activo
    );
    const meter = await service.meter(user, data.revision, {
      id_activo: molino.id_activo,
      id_um: '1',
      codigo: 'H-MOL',
      nombre_medidor: 'Horómetro',
    });
    const snapshotAfterMeter = await repository.snapshot(user);
    const initialReading = snapshotAfterMeter.readings.find(r => r.id_medidor === meter.id);
    assert(initialReading, 'Debe registrarse lectura inicial automática para el nuevo medidor');
    assert(initialReading.valor === '0' || initialReading.valor === '0.00');
    assert.equal(initialReading.fecha_lectura.slice(0, 10), '2018-05-10');
    await service.reading(user, meter.revision, {
      id_medidor: meter.id,
      fecha_lectura: '2020-01-02T08:00',
      valor: '100',
    });
    data = await repository.snapshot(user);
    const plan = await service.plan(user, data.revision, {
      id_activo: molino.id_activo,
      id_tima: '1',
      nombre_plan: 'Servicio molino',
      fecha_inicio: '2020-01-01',
      condicion: 'OR',
      reglas: [{ id_um: '1', id_medidor: meter.id, frecuencia: '25', valor_base: '100' }],
    });
    const order = await service.order(user, plan.revision, {
      id_plan: plan.id,
      fecha_programada: '2020-01-02',
    });
    await service.complete(user, order.revision, order.id!, {
      fecha_realizada: '2020-01-02T09:00',
      valor_realizado: '100',
      detalles: [],
    });
    data = await repository.snapshot(user);
    assert.equal(data.orders[0].estado, 'REALIZADA');
    assert.equal(data.plans[0].id_activo, molino.id_activo);
    assert.equal(Number(data.rules[0].valor_base), 100);

    await seedUser(connection.db, 'tecnico', 'technician');
    const tech = (await auth.login('principal', 'tecnico', password)).user;
    assert.equal(tech.assetScope,'branch');
    const restricted = await repository.snapshot(tech);
    assert(!restricted.assets.some(a => a.sucursal_id === '2'));
    assert.equal(restricted.plans.length, 0);
    await assert.rejects(
      service.meter(tech, restricted.revision, {
        id_activo: molino.id_activo,
        id_um: '1',
        codigo: 'FUERA',
        nombre_medidor: 'No autorizado',
      }),
      { status: 422 }
    );

    connection.definition.assetNamespace = 9;
    await assert.rejects(repository.snapshot(user), { code: 'ASSET_NAMESPACE_CHANGED' });
    connection.definition.assetNamespace = 1;
    await connection.db.query(
      "UPDATE public.saeact SET act_usa_mant='N' WHERE act_cod_act=101 AND act_cod_empr=1"
    );
    const historical = await repository.snapshot(user);
    assert.equal(historical.assets.find(a => a.act_cod_act === '101')?.id_activo, molino.id_activo);
    assert.equal(historical.assets.find(a => a.act_cod_act === '101')?.act_usa_mant, 'N');
    assert.equal(historical.orders[0].estado, 'REALIZADA');
    await service.assetState(user, historical.revision, zarandas.id_activo, { act_usa_mant: 'S' });
    const selected = await repository.snapshot(user);
    assert(selected.assets.some(a => a.act_cod_act === '102' && a.act_usa_mant === 'S'));
    assert.equal(selected.assets.find(a => a.act_cod_act === '102')?.id_activo, zarandas.id_activo);
    assert.equal(selected.audit[0].operation, 'assets.state');
    assert.notEqual(
      selected.assets.find(a => a.act_cod_act === '102')?.id_activo,
      molino.id_activo
    );

    const second = databases.get('segunda');
    second.definition.assetIntegrationView = undefined;
    second.definition.assetNamespace = 2;
    const secondUser = (await auth.login('segunda', 'admin', 'second-password-123')).user;
    const independent = await new RelationalRepository(second.db, second.definition).snapshot(
      secondUser
    );
    assert.notEqual(
      independent.assets[0].id_activo,
      selected.assets.find(a => a.act_cod_act === '1')?.id_activo
    );
    assert.equal(independent.plans.length, 0);
  } finally {
    await databases.close();
  }
});
test('espacios globales de conexiones no pueden repetirse', () => {
  assert.throws(
    () =>
      new Databases({
        ...config,
        connections: config.connections.map(c => ({ ...c, assetNamespace: 1 })),
      }),
    /assetNamespace/
  );
});
