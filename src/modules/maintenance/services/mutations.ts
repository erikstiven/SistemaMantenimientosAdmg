import { saveAsset } from '../../assets/services/actions';
import { saveMeter, saveReading } from '../../meters/services/actions';
import { completeOrder, saveOrder } from '../../orders/services/actions';
import { savePart } from '../../parts/services/actions';
import { changeControl, savePlan, saveRule } from '../../plans/services/actions';
import { saveMaintenanceType } from '../../settings/services/actions';
import type { MutationContext } from './mutationContext';
export const mutations: Record<string, (context: MutationContext) => boolean> = {
  'Tipo mantenimiento': saveMaintenanceType,
  Activo: saveAsset,
  Medidor: saveMeter,
  Lectura: saveReading,
  Plan: savePlan,
  Regla: saveRule,
  'Cambiar control': changeControl,
  Orden: saveOrder,
  'Completar orden': completeOrder,
  Repuesto: savePart,
};
