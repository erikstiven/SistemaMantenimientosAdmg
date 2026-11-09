import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createApp } from '../dist-server/server/app.js';
import { fixture, config as testConfig, password } from '../server/tests/fixtures.ts';
const config = { ...testConfig, NODE_ENV: 'production', APP_ORIGIN: 'http://localhost:4176' };
const databases = await fixture();
const { app, db } = await createApp(config, databases);
const server = app.listen(0, '127.0.0.1');
try {
  await once(server, 'listening');
  const address = server.address();
  const base = `http://127.0.0.1:${address.port}`;
  const home = await fetch(base);
  assert.equal(home.status, 200);
  const html = await home.text();
  for (const match of html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)) {
    assert.equal((await fetch(base + match[1])).status, 200);
  }
  assert.equal((await fetch(base + '/api/v1/health')).status, 200);
  assert.equal((await fetch(base + '/api/v1/state')).status, 401);
  const login = await fetch(base + '/api/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: config.APP_ORIGIN },
    body: JSON.stringify({ connectionId: 'principal', username: 'admin', password }),
  });
  assert.equal(login.status, 200);
  const cookie = login.headers.get('set-cookie');
  assert(cookie.includes('Secure'));
  const state = await fetch(base + '/api/v1/maintenance/bootstrap', {
    headers: {
      Cookie: cookie.split(';')[0],
      'X-Sismant-Connection': 'principal',
      'X-Sismant-User': '1',
    },
  });
  assert.equal(state.status, 200);
  assert.equal((await state.json()).assets.length, 1);

  console.log('Producción verificada: HTML, recursos, API, autenticación y cookie Secure.');
} finally {
  await new Promise(resolve => server.close(resolve));
  await db.close();
}
