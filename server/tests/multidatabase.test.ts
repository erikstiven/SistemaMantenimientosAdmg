import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { hash } from 'bcryptjs';
import { createApp } from '../app.ts';
import { AuthService, verifyPassword, hashPassword } from '../modules/auth/auth.service.ts';
import { config, fixture, password, seedUser } from './fixtures.ts';
import type { User } from '../../shared/state.ts';

test('aislamiento de conexiones y controles de autenticación', async t => {
  const databases = await fixture();
  const { app } = await createApp(config, databases);
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert(address && typeof address !== 'string');
  const auth = new AuthService(databases, config);
  const db = databases.get('principal').db;
  const first = await auth.login('principal', 'admin', password);
  const second = await auth.login('segunda', 'admin', 'second-password-123');
  const call = (
    path: string,
    token = first.token,
    connection = 'principal',
    method = 'GET',
    body?: unknown,
    user = '1'
  ) =>
    fetch(`http://127.0.0.1:${address.port}/api/v1${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Cookie: `sismant_session=${token}`,
        'X-Sismant-Connection': connection,
        'X-Sismant-User': user,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  try {
    await t.test('solo publica identificador y etiqueta', async () => {
      const response = await call('/auth/connections');
      assert.deepEqual(await response.json(), databases.list());
      await assert.rejects(auth.login('no-registrada', 'admin', password), { status: 422 });
    });
    await t.test('mismo usuario e identificador usa credenciales independientes', async () => {
      await assert.rejects(auth.login('segunda', 'admin', password), { status: 401 });
      const identity = await auth.authenticate(second.token);
      assert.equal(identity?.connectionId, 'segunda');
      assert.equal(identity?.id, first.user.id);
      assert.equal('password' in (identity as User), false);
    });
    await t.test(
      'aislamiento por conexi?n, empresa y sucursal con c?digos ERP repetidos',
      async () => {
        const a = await call('/maintenance/bootstrap');
        const b = await call('/maintenance/bootstrap', second.token, 'segunda');
        assert.equal(a.status, 200);
        assert.equal(b.status, 200);
        const firstData = (await a.json()) as {
          assets: { id_activo: string; act_cod_act: string }[];
        };
        const secondData = (await b.json()) as {
          assets: { id_activo: string; act_cod_act: string }[];
        };
        assert.equal(firstData.assets[0].act_cod_act, secondData.assets[0].act_cod_act);
        assert.notEqual(firstData.assets[0].id_activo, secondData.assets[0].id_activo);
        assert.equal((await call('/state')).status, 410);
      }
    );
    await t.test('bloquea cambios de contexto entre pestañas y tokens redirigidos', async () => {
      assert.equal((await call('/maintenance/bootstrap', second.token, 'principal')).status, 409);
      assert.equal(
        (await call('/maintenance/bootstrap', first.token, 'principal', 'GET', undefined, '99'))
          .status,
        409
      );
      assert.equal((await call('/auth/logout', second.token, 'principal', 'POST')).status, 409);
      assert.equal(
        (
          await call(
            '/maintenance/bootstrap',
            first.token.replace('principal.', 'segunda.'),
            'segunda'
          )
        ).status,
        401
      );
      assert.equal((await call('/maintenance/bootstrap', 'invalido')).status, 401);
    });
    await t.test(
      'rechaza inactivos, vencimientos comerciales y SAE, perfiles y vínculos inválidos',
      async () => {
        for (const [set, restore] of [
          ['usuario_activo=false', 'usuario_activo=true'],
          ["usuario_fecha_caduca='2000-01-01'", 'usuario_fecha_caduca=NULL'],
          ['perfil_id=99', 'perfil_id=1'],
          ['usua_cod_usua=99', 'usua_cod_usua=1'],
        ]) {
          await db.query(`UPDATE comercial.usuario SET ${set}`);
          await assert.rejects(auth.login('principal', 'admin', password), { status: 401 });
          await db.query(`UPDATE comercial.usuario SET ${restore}`);
        }
        await db.query("UPDATE public.saeusua SET usua_fec_cadu='2000-01-01'");
        await assert.rejects(auth.login('principal', 'admin', password), { status: 401 });
        await db.query('UPDATE public.saeusua SET usua_fec_cadu=NULL');
        await assert.rejects(auth.login('principal', "admin' OR 1=1 --", password), {
          status: 401,
        });
      }
    );
    await t.test(
      'vincula SAE por código y conserva la sucursal comercial sin exigir igualdad',
      async () => {
        await db.query('UPDATE comercial.usuario SET sucursal_id=99');
        try {
          const session = await auth.login('principal', 'admin', password);
          assert.equal(session.user.branchId, 99);
          assert.equal(session.user.connectionId, 'principal');
        } finally {
          await db.query('UPDATE comercial.usuario SET sucursal_id=1');
        }
      }
    );
    await t.test(
      'solo informa la restricción concreta después de verificar la contraseña',
      async () => {
        const body = { connectionId: 'principal', username: 'admin', password };
        const checks = [
          [
            'UPDATE comercial.usuario SET usuario_activo=false',
            'UPDATE comercial.usuario SET usuario_activo=true',
            'USER_DISABLED',
          ],
          [
            "UPDATE comercial.usuario SET usuario_fecha_caduca='2000-01-01'",
            'UPDATE comercial.usuario SET usuario_fecha_caduca=NULL',
            'USER_EXPIRED',
          ],
          [
            "UPDATE public.saeusua SET usua_fec_cadu='2000-01-01'",
            'UPDATE public.saeusua SET usua_fec_cadu=NULL',
            'SAE_ACCESS_DENIED',
          ],
          [
            'UPDATE comercial.usuario SET perfil_id=999',
            'UPDATE comercial.usuario SET perfil_id=1',
            'PROFILE_NOT_AUTHORIZED',
          ],
        ];
        for (const [change, restore, expected] of checks) {
          await db.query(change);
          try {
            const valid = await call('/auth/login', '', 'principal', 'POST', body);
            assert.equal(valid.status, 401);
            assert.equal(
              ((await valid.json()) as { error: { code: string } }).error.code,
              expected
            );
            const invalid = await call('/auth/login', '', 'principal', 'POST', {
              ...body,
              password: 'incorrecta',
            });
            assert.equal(invalid.status, 401);
            assert.equal(
              ((await invalid.json()) as { error: { code: string } }).error.code,
              'INVALID_CREDENTIALS'
            );
          } finally {
            await db.query(restore);
          }
        }
      }
    );
    await t.test('revalida roles y revoca al deshabilitar el usuario', async () => {
      const session = await auth.login('principal', 'admin', password);
      await db.query('UPDATE comercial.usuario SET perfil_id=3');
      assert.equal((await auth.authenticate(session.token))?.role, 'viewer');
      await db.query('UPDATE comercial.usuario SET usuario_activo=false');
      assert.equal(await auth.authenticate(session.token), undefined);
      await db.query('UPDATE comercial.usuario SET usuario_activo=true,perfil_id=1');
      assert.equal(await auth.authenticate(session.token), undefined);
    });
    await t.test('respeta duración comercial, guarda hash y vence sesiones', async () => {
      const session = await auth.login('principal', 'admin', password);
      const digest = createHash('sha256').update(session.token).digest('hex');
      const {
        rows: [row],
      } = await db.query('SELECT token,expires FROM sismant.sessions WHERE token=$1', [digest]);
      assert.notEqual(row.token, session.token);
      assert(Number(row.expires) <= Date.now() + 3600000);
      await db.query('UPDATE sismant.sessions SET expires=0 WHERE token=$1', [digest]);
      assert.equal(await auth.authenticate(session.token), undefined);
    });
    await t.test('SAE y comercial se pueden configurar por separado', async () => {
      const sae = await auth.login('sae', 'admin', password);
      assert.equal(sae.user.role, 'viewer');
      const definition = databases.get('principal').definition;
      definition.authMode = 'commercial';
      await db.query("UPDATE public.saeusua SET usua_fec_cadu='2000-01-01'");
      assert.equal((await auth.login('principal', 'admin', password)).user.role, 'admin');
      definition.authMode = 'combined';
      await db.query('UPDATE public.saeusua SET usua_fec_cadu=NULL');
    });
    await t.test(
      'inicia sesión HTTP con contraseña MD5 comercial existente y conserva restricciones',
      async () => {
        const definition = databases.get('principal').definition;
        const previousFormat = definition.passwordFormat;
        const {
          rows: [previous],
        } = await db.query('SELECT usuario_password FROM comercial.usuario WHERE usuario_id=1');
        definition.passwordFormat = 'legacy-md5';
        try {
          await db.query('UPDATE comercial.usuario SET usuario_password=$1 WHERE usuario_id=1', [
            createHash('md5').update(password).digest('hex'),
          ]);
          const response = await call('/auth/login', '', 'principal', 'POST', {
            connectionId: 'principal',
            username: 'admin',
            password,
          });
          assert.equal(response.status, 200);
          assert.equal(((await response.json()) as User).role, 'admin');
          assert(response.headers.get('set-cookie')?.includes('HttpOnly'));
          await db.query('UPDATE comercial.usuario SET usuario_activo=false WHERE usuario_id=1');
          assert.equal(
            (
              await call('/auth/login', '', 'principal', 'POST', {
                connectionId: 'principal',
                username: 'admin',
                password,
              })
            ).status,
            401
          );
        } finally {
          definition.passwordFormat = previousFormat;
          await db.query(
            'UPDATE comercial.usuario SET usuario_password=$1,usuario_activo=true WHERE usuario_id=1',
            [previous.usuario_password]
          );
        }
      }
    );
    await t.test('cerrar una sesión no afecta a la otra conexión', async () => {
      assert.equal((await call('/auth/logout', first.token, 'principal', 'POST')).status, 204);
      assert.equal(await auth.authenticate(first.token), undefined);
      assert.equal((await auth.authenticate(second.token))?.connectionId, 'segunda');
      assert.equal((await call('/auth/logout', '', 'principal', 'POST')).status, 204);
    });
    await t.test('una conexión caída no afecta las otras ni revela errores internos', async () => {
      const broken = databases.get('principal').db;
      const query = broken.query;
      broken.query = (() => {
        throw new Error('secret-host-password');
      }) as typeof query;
      try {
        const response = await call('/auth/login', '', 'principal', 'POST', {
          connectionId: 'principal',
          username: 'admin',
          password,
        });
        assert.equal(response.status, 503);
        assert.equal((await response.text()).includes('secret'), false);
        assert.equal((await call('/maintenance/bootstrap', second.token, 'segunda')).status, 200);
      } finally {
        broken.query = query;
      }
    });
  } finally {
    await new Promise<void>(resolve => server.close(() => resolve()));
    await databases.close();
  }
});
test('acepta variaciones de mayúsculas del usuario sin alterar contraseñas ni aceptar identidades ambiguas', async () => {
  const databases = await fixture();
  const auth = new AuthService(databases, config);
  try {
    const commercial = databases.get('principal').db;
    await commercial.query("UPDATE comercial.usuario SET usuario_user='ADMIN' WHERE usuario_id=1");
    for (const username of ['Admin', 'admin', 'ADMIN']) {
      const session = await auth.login('principal', username, password);
      assert.equal(session.user.username, 'ADMIN');
      assert.equal(session.user.id, 1);
      assert.equal(session.user.role, 'admin');
      assert.equal((await auth.login('sae', username, password)).user.id, 1);
    }
    await assert.rejects(auth.login('principal', 'Admin', password.toUpperCase()), {
      code: 'INVALID_CREDENTIALS',
    });
    await seedUser(commercial, 'aDmIn', 'viewer');
    await assert.rejects(auth.login('principal', 'Admin', password), {
      code: 'INVALID_CREDENTIALS',
    });
    await seedUser(databases.get('sae').db, 'ADMIN', 'viewer');
    await assert.rejects(auth.login('sae', 'Admin', password), { code: 'INVALID_CREDENTIALS' });
  } finally {
    await databases.close();
  }
});

test('valida hashes existentes sin aceptar texto plano, formatos desconocidos ni bcrypt truncado', async () => {
  const bcrypt = await hash(password, 4);
  const scrypt = await hashPassword(password);
  assert(await verifyPassword(password, bcrypt, 'bcrypt'));
  assert(await verifyPassword(password, scrypt, 'scrypt'));
  assert.equal(await verifyPassword('incorrecta', bcrypt, 'bcrypt'), false);
  assert.equal(await verifyPassword('incorrecta', scrypt, 'scrypt'), false);
  for (const value of [password, 'hash-desconocido', 'a:b'])
    assert.equal(await verifyPassword(password, value, 'scrypt'), false);
  const long = 'a'.repeat(72);
  assert.equal(await verifyPassword(long + 'b', await hash(long, 4), 'bcrypt'), false);
});

test('compatibilidad MD5 explícita: vectores conocidos, comparación exacta y sin fallback', async () => {
  const md5 = '5f4dcc3b5aa765d61d8327deb882cf99';
  assert.equal(await verifyPassword('password', md5, 'legacy-md5'), true);
  assert.equal(await verifyPassword('password', md5.toUpperCase(), 'legacy-md5'), true);
  assert.equal(await verifyPassword('Password', md5, 'legacy-md5'), false);
  assert.equal(await verifyPassword('password ', md5, 'legacy-md5'), false);
  assert.equal(await verifyPassword('password', md5, 'bcrypt'), false);
  assert.equal(await verifyPassword('password', md5, 'scrypt'), false);
  assert.equal(await verifyPassword('password', 'password', 'legacy-md5'), false);
  assert.equal(await verifyPassword('password', md5.slice(1), 'legacy-md5'), false);
  assert.equal(await verifyPassword('password', 'z'.repeat(32), 'legacy-md5'), false);
});
