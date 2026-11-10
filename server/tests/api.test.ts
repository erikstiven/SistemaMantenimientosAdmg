import assert from 'node:assert/strict';
import { once } from 'node:events';
import { test } from 'node:test';
import type { MaintenanceBootstrap, RelationalData } from '../../shared/relational.ts';
import { evaluatePlan, evaluateRule } from '../../shared/maintenance-evaluation.ts';
import { defaultPermissions } from '../../shared/permissions.ts';
import { createApp } from '../app.ts';
import { AuthService } from '../modules/auth/auth.service.ts';
import { ASSET_IDENTITIES } from '../asset-identities.ts';
import { config, fixture, password, seedUser } from './fixtures.ts';

test('API relacional: tablas reales, ámbitos, reglas, ciclos, costos y transacciones', async t => {
  const databases = await fixture();
  const { app } = await createApp(config, databases);
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert(address && typeof address !== 'string');
  const auth = new AuthService(databases, config);
  const session = await auth.login('principal', 'admin', password);
  const db = databases.get('principal').db;
  const call = (
    path: string,
    method = 'GET',
    body?: unknown,
    token = session.token,
    user = '1',
    origin = config.APP_ORIGIN
  ) =>
    fetch(`http://127.0.0.1:${address.port}/api/v1${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Origin: origin,
        Cookie: `sismant_session=${token}`,
        'X-Sismant-Connection': 'principal',
        'X-Sismant-User': user,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  async function load() {
    const response = await call('/maintenance/bootstrap');
    assert.equal(response.status, 200, await response.clone().text());
    return (await response.json()) as RelationalData;
  }
  let data: RelationalData;
  async function write(path: string, value: unknown, status = 201, method = 'POST') {
    const previous = data.revision;
    const response = await call('/maintenance' + path, method, { revision: previous, data: value });
    const result = (await response.json()) as {
      id: string;
      revision: number;
      error?: { message: string };
    };
    assert.equal(response.status, status, JSON.stringify(result));
    data = await load();
    assert.equal(
      data.revision,
      status < 300 ? previous + 1 : previous,
      'La revisión debe revertirse al fallar'
    );
    return result.id;
  }
  let meter = '',
    plan = '',
    order = '',
    part = '';
  const meterBody = {
    id_activo: '1001',
    id_um: '1',
    codigo: 'H001',
    nombre_medidor: 'Horómetro',
    estado: true,
  };
  const planBody = {
    id_activo: '1001',
    id_tima: '1',
    nombre_plan: 'Motor preventivo',
    fecha_inicio: '2020-01-01',
    fecha_fin: null,
    observacion: '',
    condicion: 'OR',
    reglas: [
      { id_um: '1', id_medidor: '', frecuencia: '250', valor_base: '1000', alerta_antes: '50' },
      { id_um: '4', id_medidor: null, frecuencia: '1', valor_base: null, alerta_antes: '7' },
    ],
  };
  try {
    data = await load();
    await t.test('exige sesión y retira el agregado JSON', async () => {
      assert.equal((await call('/maintenance/bootstrap', 'GET', undefined, '')).status, 401);
      assert.equal((await call('/state')).status, 410);
      assert.equal(data.assets[0].id_activo, '1001');
      assert.equal(data.units.length, 4);
      assert.equal('password' in session.user, false);
      assert.equal(
        (
          await call(
            '/maintenance/units',
            'POST',
            { revision: data.revision, data: {} },
            session.token,
            '1',
            'https://otro.example'
          )
        ).status,
        403
      );
    });
    await t.test(
      'medidores usan unidad MEDIDOR, identidad global y código único por activo',
      async () => {
        await write('/meters', { ...meterBody, id_um: '3' }, 422);
        await write('/meters', { ...meterBody, id_activo: '2001' }, 422);
        meter = await write('/meters', meterBody);
        assert.match(meter, /^\d+$/);
        await write('/meters', meterBody, 409);
        assert.equal(data.meters.length, 1);
        const initialReading = data.readings.find(r => r.id_medidor === meter);
        assert(initialReading, 'Debe crearse una lectura inicial automática para el medidor');
        assert(initialReading.valor === '0' || initialReading.valor === '0.00');
        assert(
          initialReading.fecha_lectura.slice(0, 10) === '2017-06-09' ||
            initialReading.fecha_lectura.slice(0, 10) === '1970-01-01'
        );
      }
    );
    await t.test(
      'lecturas con fecha y hora: corrección auditada sin duplicados ni retrocesos',
      async () => {
        await write('/readings', {
          id_medidor: meter,
          fecha_lectura: '2020-01-01T08:00',
          valor: '1000',
          observacion: '',
        });
        await write('/readings', {
          id_medidor: meter,
          fecha_lectura: '2020-01-02T08:00',
          valor: '1200',
          observacion: '',
        });
        await write(
          '/readings',
          { id_medidor: meter, fecha_lectura: '2020-01-01T08:00', valor: '1100' },
          422
        );
        await write(
          '/readings',
          { id_medidor: meter, fecha_lectura: '2020-01-01T09:00', valor: '1300' },
          422
        );
        await write(
          '/readings',
          { id_medidor: meter, fecha_lectura: '2020-01-03T08:00', valor: '1100' },
          422
        );
        await write('/readings', {
          id_medidor: meter,
          fecha_lectura: '2020-01-03T08:00',
          valor: '1300',
        });
        const original = data.readings.find(row => row.fecha_lectura.startsWith('2020-01-02'))!;
        const { id_lectura, ...draft } = original;
        await write('/readings/' + id_lectura, { ...draft, valor: '900' }, 422, 'PUT');
        await write(
          '/readings/' + id_lectura,
          { ...draft, valor: '1210', observacion: 'Corrección' },
          200,
          'PUT'
        );
        assert.equal(Number(data.readings.find(row => row.id_lectura === id_lectura)?.valor), 1210);
        const { rows } = await db.query(
          'SELECT previous, corrected FROM sismant.maintenance_reading_corrections WHERE reading_id=$1',
          [id_lectura]
        );
        assert.equal(Number(rows[0].previous.valor), 1200);
        assert.equal(rows[0].corrected.valor, '1210');
        assert.equal(data.audit[0].operation, 'reading.update');
        assert.equal(data.audit[0].user_name, 'admin');
        assert.equal(Number(data.audit[0].before_state?.valor), 1200);
        assert.equal(Number(data.audit[0].after_state?.valor), 1210);
      }
    );
    await t.test(
      'planes validan reglas, frecuencia calendario entera y unidades del medidor',
      async () => {
        planBody.reglas[0].id_medidor = meter;
        await write(
          '/plans',
          { ...planBody, reglas: [{ ...planBody.reglas[1], frecuencia: '1.5' }] },
          422
        );
        await write(
          '/plans',
          { ...planBody, reglas: [{ ...planBody.reglas[0], id_um: '2' }] },
          422
        );
        await write(
          '/plans',
          { ...planBody, reglas: [{ ...planBody.reglas[1], id_medidor: meter }] },
          422
        );
        plan = await write('/plans', planBody);
        assert.equal(data.rules.length, 2);
        assert.equal(evaluatePlan(data, data.plans[0], '2020-01-03').status, 'VENCIDO');
        const oldRevision = data.revision - 1;
        assert.equal(
          (await call('/maintenance/plans', 'POST', { revision: oldRevision, data: planBody }))
            .status,
          409
        );
        assert.equal((await load()).plans.length, 1);
      }
    );
    await t.test(
      'el catálogo de repuestos tiene identidad estable y costos decimales',
      async () => {
        part = await write('/parts', {
          codigo: 'F001',
          nombre: 'Filtro',
          unidad_medida: 'Unidad',
          costo_referencia: '0.67',
        });
        await write(
          '/parts',
          { codigo: 'F001', nombre: 'Duplicado', unidad_medida: 'Unidad', costo_referencia: '1' },
          409
        );
        await write(
          '/parts',
          { codigo: 'F002', nombre: 'Negativo', unidad_medida: 'Unidad', costo_referencia: '-1' },
          422
        );
        order = await write('/orders', { id_plan: plan, fecha_programada: '2020-01-03' });
      }
    );
    await t.test(
      'un fallo posterior al primer detalle revierte detalles, orden, revisión y auditoría',
      async () => {
        const auditCount = data.audit.length;
        await write(
          `/orders/${order}/complete`,
          {
            fecha_realizada: '2020-01-03T09:00',
            valor_realizado: '1300',
            detalles: [
              { id_repu: part, cantidad: '1.50', costo_unitario: '0.67' },
              { id_repu: '999', cantidad: '1', costo_unitario: '1' },
            ],
          },
          422,
          'POST'
        );
        assert.equal(data.details.length, 0);
        assert.equal(data.orders[0].estado, 'PENDIENTE');
        assert.equal(data.audit.length, auditCount);
      }
    );
    await t.test(
      'completa atómicamente, redondea costos y conserva base/fecha iniciales',
      async () => {
        await write(
          `/orders/${order}/complete`,
          {
            fecha_realizada: '2020-01-03T09:00',
            valor_realizado: '1300',
            detalles: [{ id_repu: part, cantidad: '1.50', costo_unitario: '0.67' }],
          },
          200
        );
        assert.equal(data.orders[0].estado, 'REALIZADA');
        assert.equal(Number(data.details[0].subtotal), 1.01);
        assert.equal(Number(data.rules.find(r => r.id_medidor)?.valor_base), 1000);
        assert.equal(data.plans[0].fecha_inicio, '2020-01-01');
        const evaluated = evaluatePlan(data, data.plans[0], '2020-01-04');
        assert.equal(Number(evaluated.rules[0].target), 1550);
        assert.equal(evaluated.rules[1].target, '2020-02-03');
        await write(
          '/readings',
          { id_medidor: meter, fecha_lectura: '2020-01-03T08:30', valor: '1350' },
          422
        );
        const latest = data.readings.find(row => row.fecha_lectura.startsWith('2020-01-03'))!;
        await write(
          '/readings/' + latest.id_lectura,
          { id_medidor: meter, fecha_lectura: latest.fecha_lectura, valor: '1290' },
          422,
          'PUT'
        );
        await write(`/readings/${latest.id_lectura}/void`, {}, 422);
        assert.equal(
          data.readings.find(r => r.id_lectura === latest.id_lectura)?.anulacion,
          undefined
        );
        await write(`/plans/${plan}/replace`, { ...planBody, fecha_inicio: '2020-01-02' }, 422);
        await write(
          `/orders/${order}/complete`,
          { fecha_realizada: '2020-01-04T09:00', valor_realizado: '1300', detalles: [] },
          422
        );
        await write(`/orders/${order}/cancel`, {}, 422);
      }
    );
    await t.test('las cancelaciones son terminales y no modifican el ciclo', async () => {
      const pending = await write('/orders', { id_plan: plan });
      await write(`/plans/${plan}/replace`, { ...planBody, fecha_inicio: '2020-02-01' }, 422);
      await write(`/orders/${pending}/cancel`, {}, 200);
      await write(
        `/orders/${pending}/complete`,
        { fecha_realizada: '2020-01-04T09:00', valor_realizado: '1300', detalles: [] },
        422
      );
      assert.equal(Number(evaluatePlan(data, data.plans[0], '2020-01-04').rules[0].target), 1550);
    });
    await t.test('no inventa ejecuciones para planes de varios medidores', async () => {
      const meter2 = await write('/meters', {
        ...meterBody,
        codigo: 'KM001',
        id_um: '2',
        nombre_medidor: 'Odómetro',
      });
      const multi = await write('/plans', {
        ...planBody,
        nombre_plan: 'Multimedidor',
        reglas: [
          planBody.reglas[0],
          {
            id_um: '2',
            id_medidor: meter2,
            frecuencia: '500',
            valor_base: '0',
            alerta_antes: '10',
          },
        ],
      });
      const pending = await write('/orders', { id_plan: multi });
      await write(
        `/orders/${pending}/complete`,
        { fecha_realizada: '2020-01-04T09:00', valor_realizado: '1300', detalles: [] },
        422
      );
    });
    await t.test(
      'cambiar estrategia crea otro plan y preserva sus referencias históricas',
      async () => {
        const newPlan = await write(`/plans/${plan}/replace`, {
          ...planBody,
          fecha_inicio: '2020-02-01',
          nombre_plan: 'Motor nueva estrategia',
        });
        assert.notEqual(newPlan, plan);
        assert.equal(data.plans.find(p => p.id_plan === plan)?.estado, 'INACTIVO');
        assert.equal(data.orders.find(o => o.id_ordm === order)?.id_plan, plan);
        assert.equal(
          Number(data.rules.find(r => r.id_plan === plan && r.id_medidor)?.valor_base),
          1000
        );
      }
    );
    await t.test('los roles se aplican también a cada escritura relacional', async () => {
      await seedUser(db, 'viewer', 'viewer');
      await seedUser(db, 'technician', 'technician');
      const viewer = await auth.login('principal', 'viewer', password),
        tech = await auth.login('principal', 'technician', password);
      assert.equal(
        (
          await call(
            '/maintenance/bootstrap',
            'GET',
            undefined,
            viewer.token,
            String(viewer.user.id)
          )
        ).status,
        200
      );
      const body = {
        revision: data.revision,
        data: { codigo: 'X', nombre: 'X', tipo_control: 'MEDIDOR' },
      };
      assert.equal(
        (await call('/maintenance/units', 'POST', body, viewer.token, String(viewer.user.id)))
          .status,
        403
      );
      assert.equal(
        (await call('/maintenance/units', 'POST', body, tech.token, String(tech.user.id))).status,
        403
      );
      const { id_lectura, ...reading } = data.readings[0];
      const correct = (session: typeof tech) =>
        call(
          '/maintenance/readings/' + id_lectura,
          'PUT',
          {
            revision: data.revision,
            data: { ...reading, observacion: 'Corrección por operador' },
          },
          session.token,
          String(session.user.id)
        );
      assert.equal((await correct(tech)).status, 403);
      const denied = await call(
        '/maintenance/roles/technician',
        'PUT',
        { revision: data.revision, data: ['readings.read'] },
        tech.token,
        String(tech.user.id)
      );
      assert.equal(denied.status, 403);
      const grants = [
        ...defaultPermissions('technician').filter(
          permission => permission !== 'audit.read' && permission !== 'meters.update'
        ),
        'readings.update',
      ];
      await write('/roles/technician', grants, 200, 'PUT');
      const techSnapshot = (await (
        await call('/maintenance/bootstrap', 'GET', undefined, tech.token, String(tech.user.id))
      ).json()) as MaintenanceBootstrap;
      assert.deepEqual(techSnapshot.audit, []);
      assert.equal(techSnapshot.rolePermissions, undefined);
      assert(!techSnapshot.permissions.includes('meters.update'));
      assert.equal(
        (
          await call(
            '/maintenance/meters/' + meter,
            'PUT',
            {
              revision: data.revision,
              data: meterBody,
            },
            tech.token,
            String(tech.user.id)
          )
        ).status,
        403
      );
      const corrected = await correct(tech);
      assert.equal(corrected.status, 200, await corrected.text());
      data = await load();
      await write(
        '/roles/technician',
        [...grants.filter(permission => permission !== 'readings.read'), 'audit.read'],
        200,
        'PUT'
      );
      assert.equal((await correct(tech)).status, 403);
      const refreshed = (await (
        await call('/maintenance/bootstrap', 'GET', undefined, tech.token, String(tech.user.id))
      ).json()) as MaintenanceBootstrap;
      assert.deepEqual(refreshed.readings, []);
      assert(!refreshed.permissions.includes('readings.update'));
      const readingAudit = refreshed.audit.find(row => row.operation === 'reading.update');
      assert.equal(readingAudit?.user_name, tech.user.username);
      assert.equal(readingAudit?.before_state, null);
      assert.equal(readingAudit?.after_state, null);
    });
    await t.test('administrador gestiona activos y controla act_usa_mant', async () => {
      const newAssetId = await write('/assets', {
        act_cod_act: '99',
        nombre: 'Generador Diésel 50kW',
        clave: 'GEN-050',
        tipo: 'Generadores',
        act_usa_mant: 'S',
        act_fcmp_act: '2021-04-15',
      });
      assert(newAssetId);
      const created = data.assets.find(a => a.id_activo === newAssetId);
      assert(created);
      assert.equal(created.nombre, 'Generador Diésel 50kW');
      assert.equal(created.act_usa_mant, 'S');

      await write(
        '/assets/' + newAssetId,
        {
          nombre: 'Generador Diésel 50kW Modificado',
          clave: 'GEN-050',
          tipo: 'Generadores',
          act_usa_mant: 'N',
          act_fcmp_act: '2021-04-15',
        },
        200,
        'PUT'
      );
      const updated = data.assets.find(a => a.id_activo === newAssetId);
      assert(updated);
      assert.equal(updated.act_usa_mant, 'N');
    });
    await t.test('datos de otras empresas/sucursales no se consultan ni se modifican', async () => {
      await db.query(
        "INSERT INTO integration.maintenance_assets VALUES(9001,'principal',1,2,'1','Otra sucursal','Equipo','S')"
      );
      await db.query('UPDATE comercial.usuario SET sucursal_id=2 WHERE usuario_id=1');
      try {
        const scoped = await load();
        assert.equal(scoped.assets.length, 1);
        assert.equal(scoped.assets[0].id_activo, '9001');
        assert.equal(scoped.plans.length, 0);
        assert.equal(scoped.meters.length, 0);
        assert.equal(
          (
            await call(`/maintenance/plans/${plan}/state`, 'PUT', {
              revision: scoped.revision,
              data: { estado: 'ACTIVO' },
            })
          ).status,
          404
        );
      } finally {
        await db.query('UPDATE comercial.usuario SET sucursal_id=1 WHERE usuario_id=1');
        data = await load();
      }
    });
    await t.test(
      'el adaptador nativo no supone id_activo ni habilita activos desde SisMant',
      async () => {
        const definition = databases.get('principal').definition,
          view = definition.assetIntegrationView;
        definition.assetIntegrationView = undefined;
        try {
          const unresolved = await load();
          assert.equal(unresolved.assets.length, 0);
          assert.equal(unresolved.warnings.length, 1);
          ASSET_IDENTITIES.push({
            id_activo: '1001',
            connectionId: 'principal',
            empresaId: '1',
            sucursalId: '1',
            actCodAct: '1',
          });
          const mapped = await load();
          assert.equal(mapped.assets[0].id_activo, '1001');
          assert.equal(mapped.assets[0].clave, 'MEP-001');
          await db.query("UPDATE public.saeact SET act_usa_mant='N'");
          data = await load();
          assert.equal(data.assets[0].act_usa_mant, 'N');
          assert(data.readings.length > 0);
          await write('/meters', { ...meterBody, codigo: 'H003' }, 422);
        } finally {
          ASSET_IDENTITIES.splice(0);
          definition.assetIntegrationView = view;
          await db.query("UPDATE public.saeact SET act_usa_mant='S'");
          data = await load();
        }
      }
    );
    await t.test('identidades globales duplicadas fallan de forma explícita', async () => {
      await db.query(
        "INSERT INTO integration.maintenance_assets VALUES(1001,'segunda',1,1,'1','Colisión','Equipo','S')"
      );
      try {
        const response = await call('/maintenance/bootstrap');
        assert.equal(response.status, 503);
        assert.equal(
          ((await response.json()) as { error: { code: string } }).error.code,
          'AMBIGUOUS_ASSET_IDENTITY'
        );
      } finally {
        await db.query("DELETE FROM integration.maintenance_assets WHERE conexion_erp='segunda'");
      }
    });
    await t.test(
      'el administrador anula sin perder historial y recalcula con lecturas válidas',
      async () => {
        const historicalPlan = data.plans.find(p => p.id_plan === plan)!;
        const rule = data.rules.find(r => r.id_plan === plan && r.id_medidor === meter)!;
        const evaluation = evaluateRule(data, historicalPlan, rule, '2020-01-10');
        const id = await write('/readings', {
          id_medidor: meter,
          fecha_lectura: '2020-01-10T08:00',
          valor: '1700',
        });
        assert.notEqual(
          evaluateRule(data, historicalPlan, rule, '2020-01-10').remaining,
          evaluation.remaining
        );
        await write(`/readings/${id}/void`, {}, 200);
        const voided = data.readings.find(r => r.id_lectura === id)!;
        assert.equal(Number(voided.valor), 1700);
        assert.equal(voided.anulacion?.usuario, '1');
        assert(voided.anulacion?.fecha);
        assert.equal(data.audit[0].operation, 'reading.void');
        assert.equal(data.audit[0].entity_id, id);
        assert.deepEqual(evaluateRule(data, historicalPlan, rule, '2020-01-10'), evaluation);
        await write(`/readings/${id}/void`, {}, 422);
        await write(
          `/readings/${id}`,
          {
            id_medidor: meter,
            fecha_lectura: voided.fecha_lectura,
            valor: '1700',
          },
          422,
          'PUT'
        );
        await write('/readings', {
          id_medidor: meter,
          fecha_lectura: '2020-01-11T08:00',
          valor: '1400',
        });
      }
    );
    await t.test(
      'eliminaciones administrativas auditadas y protegidas por referencias',
      async () => {
        await seedUser(db, 'operador-borrado', 'technician');
        const operator = await auth.login('principal', 'operador-borrado', password);
        const unused = await write('/parts', {
          codigo: 'LIBRE',
          nombre: 'Repuesto libre',
          unidad_medida: 'Unidad',
          costo_referencia: '1',
        });
        const body = { revision: data.revision, data: {} };
        for (const [path, method] of [
          [`/parts/${unused}`, 'DELETE'],
          [`/readings/${data.readings[0].id_lectura}/void`, 'POST'],
        ]) {
          const response = await call(
            '/maintenance' + path,
            method,
            body,
            operator.token,
            String(operator.user.id)
          );
          assert.equal(response.status, 403);
        }
        await write(`/parts/${unused}`, {}, 200, 'DELETE');
        assert(!data.parts.some(p => p.id_repu === unused));
        assert.equal(data.audit[0].operation, 'parts.delete');
        assert.equal(data.audit[0].entity_id, unused);
        await write(`/parts/${part}`, {}, 409, 'DELETE');
        await write(`/orders/${order}`, {}, 422, 'DELETE');
        await write(`/meters/${meter}`, {}, 200, 'DELETE');
        assert.equal(data.meters.find(m => m.id_medidor === meter)?.estado, false);
        assert(data.readings.some(r => r.id_medidor === meter));
        await write('/assets/1001', {}, 404, 'DELETE');
        assert.equal(data.assets.find(a => a.id_activo === '1001')?.act_usa_mant, 'S');
        await write('/assets/1001/state', { act_usa_mant: 'N' }, 200, 'PUT');
        assert.equal(data.assets.find(a => a.id_activo === '1001')?.act_usa_mant, 'N');
        assert.equal(data.audit[0].before_state?.act_usa_mant, 'S');
        assert.equal(data.audit[0].after_state?.act_usa_mant, 'N');
        await write('/assets/1001/state', { act_usa_mant: 'S' }, 200, 'PUT');
        assert.equal(data.assets.find(a => a.id_activo === '1001')?.act_usa_mant, 'S');
        await db.query(
          `INSERT INTO sismant.maintenance_audit(connection_id,user_id,company_id,branch_id,revision,operation)
           VALUES('principal',1,1,1,$1,'assets.update')`,
          [data.revision]
        );
        data = await load();
        assert.equal(data.audit[0].user_name, 'admin');
        assert.equal(data.audit[0].before_state, null);
      }
    );
    await t.test(
      'el cierre confirmado registra la lectura y revierte ambas escrituras si falla',
      async () => {
        const serviceMeter = await write('/meters', { ...meterBody, codigo: 'H-SERVICIO' });
        const servicePlan = await write('/plans', {
          ...planBody,
          nombre_plan: 'Plan con registro de lectura en el servicio',
          reglas: [{ id_um: '1', id_medidor: serviceMeter, frecuencia: '100', valor_base: '0' }],
        });
        const serviceOrder = await write('/orders', {
          id_plan: servicePlan,
          fecha_programada: '2020-02-01',
          valor_programado: '190',
          observacion: 'Trabajo programado de prueba.',
        });
        const path = `/orders/${serviceOrder}/complete`;
        const reportPath = `/maintenance/orders/${serviceOrder}/report`;
        const pendingReport = await call(reportPath);
        assert.equal(pendingReport.status, 200);
        assert.equal(pendingReport.headers.get('content-type'), 'application/pdf');
        assert.equal(
          pendingReport.headers.get('content-disposition'),
          `inline; filename="orden-${serviceOrder}.pdf"`
        );
        const pendingPdf = Buffer.from(await pendingReport.arrayBuffer()).toString('latin1');
        assert.match(pendingPdf, /^%PDF-/);
        assert.match(pendingPdf, /Trabajo programado de prueba/);
        assert.doesNotMatch(pendingPdf, /Ejecuci.n del servicio/);
        const execution = {
          fecha_realizada: '2020-02-01T09:00',
          valor_realizado: '200.50',
          observacion: 'Servicio con filtro reemplazado.',
          detalles: [{ id_repu: part, cantidad: '1', costo_unitario: '0.67' }],
        };
        const initialReadings = data.readings.length;
        const initialAudit = data.audit.length;
        await write(path, execution, 422);
        await write(
          path,
          {
            ...execution,
            registrar_lectura: true,
            detalles: [
              ...execution.detalles,
              { id_repu: '999', cantidad: '1', costo_unitario: '1' },
            ],
          },
          422
        );
        assert.equal(data.readings.length, initialReadings);
        assert.equal(data.audit.length, initialAudit);
        assert.equal(data.orders.find(row => row.id_ordm === serviceOrder)?.estado, 'PENDIENTE');
        assert(!data.details.some(row => row.id_ordm === serviceOrder));

        await write(
          '/roles/technician',
          defaultPermissions('technician').filter(permission => permission !== 'readings.create'),
          200,
          'PUT'
        );
        const operator = await auth.login('principal', 'operador-borrado', password);
        const callAsOperator = (endpoint: string, input: unknown) =>
          call(
            '/maintenance' + endpoint,
            'POST',
            { revision: data.revision, data: input },
            operator.token,
            String(operator.user.id)
          );
        const denied = await callAsOperator(path, { ...execution, registrar_lectura: true });
        assert.equal(denied.status, 403);
        assert.match(await denied.text(), /permiso para registrar la lectura/);

        await write(path, { ...execution, registrar_lectura: true }, 200);
        const reading = data.readings.find(
          row => row.id_medidor === serviceMeter && row.fecha_lectura === '2020-02-01T09:00:00'
        );
        assert.equal(Number(reading?.valor), 200.5);
        assert.match(reading?.observacion ?? '', new RegExp(`orden #${serviceOrder}\\.`));
        assert.equal(data.orders.find(row => row.id_ordm === serviceOrder)?.estado, 'REALIZADA');
        assert.equal(
          data.orders.find(row => row.id_ordm === serviceOrder)?.observacion,
          execution.observacion
        );
        assert.equal(data.audit[0].operation, 'order.complete');
        assert.equal(data.audit[1].operation, 'reading.create');
        assert.equal(data.audit[1].entity_id, reading?.id_lectura);
        const completedReport = await call(reportPath);
        assert.equal(completedReport.status, 200);
        const completedPdf = Buffer.from(await completedReport.arrayBuffer()).toString('latin1');
        assert.match(completedPdf, /Trabajo programado de prueba/);
        assert.match(completedPdf, /Servicio con filtro reemplazado/);
        assert.match(completedPdf, /Total de repuestos/);
        assert.equal((await call(reportPath, 'GET', undefined, '')).status, 401);

        const repeated = await write('/orders', { id_plan: servicePlan });
        const reused = await callAsOperator(`/orders/${repeated}/complete`, {
          ...execution,
          fecha_realizada: '2020-02-02T09:00',
          detalles: [],
        });
        assert.equal(reused.status, 200, await reused.clone().text());
        data = await load();
        assert.equal(data.readings.length, initialReadings + 1);
      }
    );
  } finally {
    await new Promise<void>(resolve => server.close(() => resolve()));
    await databases.close();
  }
});
