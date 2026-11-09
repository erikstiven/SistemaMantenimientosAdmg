import assert from 'node:assert/strict';
import { test } from 'node:test';
import { config, fixture, password } from './fixtures.ts';
import { AuthService } from '../modules/auth/auth.service.ts';
import { RelationalRepository } from '../modules/maintenance/relational.repository.ts';
test('una conexión nueva prepara sesiones solo después de validar las credenciales', async () => {
  const databases = await fixture({ sessions: false });
  try {
    const db = databases.get('principal').db;
    const auth = new AuthService(databases, config);
    assert.equal(await auth.authenticate('principal.' + 'a'.repeat(64)), undefined);
    await assert.rejects(auth.login('principal', 'admin', 'incorrecta'), {
      code: 'INVALID_CREDENTIALS',
    });
    await assert.rejects(db.query('SELECT * FROM sismant.sessions'), { code: '42P01' });
    const session = await auth.login('principal', 'admin', password);
    assert.equal((await auth.authenticate(session.token))?.id, 1);
    assert.equal(
      (await db.query('SELECT COUNT(*) AS count FROM sismant.sessions')).rows[0].count,
      1
    );
    await auth.logout(session.token);
    assert.equal(await auth.authenticate(session.token), undefined);
  } finally {
    await databases.close();
  }
});
test('el soporte técnico se prepara sin recrear tablas ni datasets de mantenimiento', async () => {
  const databases = await fixture({ support: false });
  try {
    const connection = databases.get('principal');
    const { user } = await new AuthService(databases, config).login('principal', 'admin', password);
    const data = await new RelationalRepository(connection.db, connection.definition).snapshot(
      user
    );
    assert.equal(data.revision, 0);
    assert.equal(data.units.length, 4);
    assert.equal(data.types.length, 1);
    assert.equal(data.plans.length, 0);
  } finally {
    await databases.close();
  }
});
