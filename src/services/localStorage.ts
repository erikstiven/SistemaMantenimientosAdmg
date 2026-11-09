import { initialState, stateSchema } from '../../shared/state';
import type { StateKey } from '../../shared/state';
export const storageKey = 'sismant-v4-state';
/** A single JSON value makes local writes atomic; v3 keys remain as a backup. */
export function readLocal(storage: Pick<Storage, 'getItem'>) {
  const data = initialState(true);
  const backup: Record<string, string | null> = {};
  const issues: string[] = [];
  const snapshot = storage.getItem(storageKey);
  backup[storageKey] = snapshot;
  if (snapshot) {
    try {
      return { data: stateSchema.parse(JSON.parse(snapshot)), issues, backup };
    } catch {
      issues.push(storageKey);
    }
  }
  for (const key of Object.keys(data) as StateKey[]) {
    const name = 'sismant-v3-' + key;
    const raw = storage.getItem(name);
    backup[name] = raw;
    if (!raw) continue;
    try {
      Object.assign(data, { [key]: stateSchema.shape[key].parse(JSON.parse(raw)) });
    } catch {
      issues.push(name);
    }
  }
  return { data, issues, backup };
}
export function writeLocal(storage: Pick<Storage, 'setItem'>, data: unknown) {
  storage.setItem(storageKey, JSON.stringify(stateSchema.parse(data)));
}
