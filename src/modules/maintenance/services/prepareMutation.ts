import type { Dispatch, SetStateAction } from 'react';
import { stateSchema } from '../../../../shared/state';
import type { MaintenanceState, StateKey } from '../../../../shared/state';
import type { MutationContext, Values } from './mutationContext';

/** Validate every affected module before applying any React state update. */
export function prepareMutation(
  action: (context: MutationContext) => boolean,
  context: MutationContext,
  state: MaintenanceState
) {
  let staged = { ...state };
  const commits: (() => void)[] = [];
  const logs: [string, string][] = [];
  function stage<K extends keyof Values>(
    key: K,
    stateKey: StateKey,
    setter: Dispatch<SetStateAction<Values[K]>>
  ): Dispatch<SetStateAction<Values[K]>> {
    return value => {
      const previous = staged[stateKey] as Values[K];
      Object.assign(staged, {
        [stateKey]:
          typeof value === 'function' ? (value as (old: Values[K]) => Values[K])(previous) : value,
      });
      commits.push(() => setter(staged[stateKey] as Values[K]));
    };
  }
  const valid = action({
    ...context,
    setAssets: stage('assets', 'assets', context.setAssets),
    setPlans: stage('plans', 'plans', context.setPlans),
    setReadings: stage('readings', 'readings', context.setReadings),
    setOrders: stage('orders', 'orders', context.setOrders),
    setMeters: stage('meters', 'meters', context.setMeters),
    setMaintTypes: stage('maintTypes', 'maintenance-types', context.setMaintTypes),
    setAppSettings: stage('appSettings', 'general-settings', context.setAppSettings),
    setItems: stage('items', 'items', context.setItems),
    log: (kind, text) => {
      logs.push([kind, text]);
    },
  });
  if (!valid) return false;
  const parsed = stateSchema.safeParse(staged);
  if (!parsed.success) {
    context.notice(
      'Revisa los campos: ' +
        parsed.error.issues
          .map(issue => issue.path.join('.') + ' (' + issue.message + ')')
          .join(', ')
    );
    return false;
  }
  staged = parsed.data;
  for (const commit of commits) commit();
  for (const [kind, text] of logs) context.log(kind, text);
  return true;
}
