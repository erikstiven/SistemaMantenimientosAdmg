import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initialState } from '../../shared/state';
import { readLocal, writeLocal, storageKey } from './localStorage';
test('recupera los datos locales v3 y escribe un único estado sin eliminar el respaldo', () => {
  const legacy = [{ id: 55, code: 'TEST', name: 'Equipo local', type: 'Equipo' }];
  const values = new Map([['sismant-v3-assets', JSON.stringify(legacy)]]);
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  };
  const recovered = readLocal(storage);
  assert.deepEqual(recovered.data.assets, legacy);
  writeLocal(storage, recovered.data);
  assert(values.has(storageKey));
  assert(values.has('sismant-v3-assets'));
  assert.deepEqual(readLocal(storage).data.assets, legacy);
});
test('identifica datos dañados y conserva los otros módulos y los valores originales', () => {
  const assets = JSON.stringify([{ id: 55, code: 'TEST', name: 'Equipo local', type: 'Equipo' }]);
  const values = new Map([
    ['sismant-v3-assets', assets],
    ['sismant-v3-plans', '{'],
  ]);
  const result = readLocal({ getItem: key => values.get(key) ?? null });
  assert.equal(result.data.assets[0].id, 55);
  assert.deepEqual(result.issues, ['sismant-v3-plans']);
  assert.equal(result.backup['sismant-v3-plans'], '{');
});
test('no escribe un estado inválido', () => {
  let written = false;
  const state = initialState();
  state['general-settings'].hours = -1;
  assert.throws(() =>
    writeLocal(
      {
        setItem: () => {
          written = true;
        },
      },
      state
    )
  );
  assert.equal(written, false);
});
