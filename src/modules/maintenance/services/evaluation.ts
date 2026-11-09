import type { AppSettings, MaintenancePlan, Meter, MeterReading } from '../../../../shared/types';
import { TODAY, addDuration, daysBetween, format } from '../../../utils/format';
export function createMaintenanceEvaluator(
  readings: MeterReading[],
  meters: Meter[],
  appSettings: AppSettings,
  today = TODAY
) {
  const latest = new Map<string, MeterReading>();
  const groupedMeters = new Map<string, Meter[]>();
  for (const meter of meters) {
    const key = `${meter.asset}:${meter.unit}`;
    groupedMeters.set(key, [...(groupedMeters.get(key) ?? []), meter]);
  }
  function index(key: string, reading: MeterReading) {
    const previous = latest.get(key);
    if (
      !previous ||
      reading.date > previous.date ||
      (reading.date === previous.date && reading.id >= previous.id)
    )
      latest.set(key, reading);
  }
  for (const reading of readings) {
    const key = `${reading.asset}:${reading.unit}`;
    index(key, reading);
    const candidates = groupedMeters.get(key) ?? [];
    const meter = reading.meter ?? (candidates.length === 1 ? candidates[0].id : undefined);
    if (meter != null) index(`${key}:${meter}`, reading);
  }
  const current = (id: number, u: string, meter?: number) => {
    return latest.get(`${id}:${u}${meter == null ? '' : ':' + meter}`)?.value ?? 0;
  };
  const ruleEval = (
    p: MaintenancePlan,
    r: {
      unit: string;
      freq: number;
      base?: number;
      alert?: number;
      startDate?: string;
      meter?: number;
    }
  ) => {
    if (r.unit === 'Meses' || r.unit === 'Días') {
      const due = addDuration(r.startDate || p.startDate || today, r.freq, r.unit);
      const remain = daysBetween(due, today);
      const warning = r.unit === 'Meses' ? (r.alert ?? 30) : (r.alert ?? 7);
      return {
        status:
          remain <= 0 ? 'Vencido' : appSettings.alerts && remain <= warning ? 'Próximo' : 'Al día',
        remaining:
          remain < 0
            ? `Vencido hace ${-remain} días (${due})`
            : `Vence ${due} · ${remain} días restantes`,
        due,
      };
    }
    const meter = r.meter ?? p.meter;
    const val = current(p.asset, r.unit, meter);
    const remaining = (r.base ?? 0) + r.freq - val;
    return {
      status:
        remaining <= 0
          ? 'Vencido'
          : appSettings.alerts && remaining <= (r.alert ?? 0)
            ? 'Próximo'
            : 'Al día',
      remaining:
        remaining < 0
          ? `Excedido ${format(-remaining)} ${r.unit}`
          : `Faltan ${format(remaining)} ${r.unit} (meta ${format((r.base ?? 0) + r.freq)})`,
      due: String((r.base ?? 0) + r.freq),
    };
  };
  const evalPlan = (p: MaintenancePlan) => {
    if (p.active === false)
      return {
        status: 'Inactivo',
        remaining: 'Plan cerrado',
        due: '',
      };
    const first = ruleEval(p, {
      unit: p.unit,
      freq: p.freq,
      base: p.base,
      alert: p.alert,
      startDate: p.startDate,
      meter: p.meter,
    });
    if (!p.second) return first;
    const second = ruleEval(p, p.second);
    const severity = (v: string) =>
      v === 'Vencido' ? 3 : v === 'Próximo' ? 2 : v === 'Al día' ? 1 : 0;
    const worse = severity(first.status) >= severity(second.status) ? first : second;
    return {
      ...worse,
      remaining:
        worse.remaining + ' · OR: ' + (worse === first ? second.remaining : first.remaining),
    };
  };

  return { current, ruleEval, evalPlan };
}
