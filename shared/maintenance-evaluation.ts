import { cents, decimal, type RelationalData, type PlanRow, type RuleRow } from './relational.ts';
export function calendarDue(start: string, frequency: string, code: string): string {
  const count = Number(frequency);
  if (!Number.isSafeInteger(count) || count <= 0 || !['DIA', 'MES'].includes(code))
    throw new Error('Intervalo calendario inválido');
  const day = new Date(start.slice(0, 10) + 'T00:00:00Z');
  if (code === 'DIA') day.setUTCDate(day.getUTCDate() + count);
  else {
    const original = day.getUTCDate();
    day.setUTCDate(1);
    day.setUTCMonth(day.getUTCMonth() + count);
    const last = new Date(day.getTime());
    last.setUTCMonth(last.getUTCMonth() + 1);
    last.setUTCDate(0);
    day.setUTCDate(Math.min(original, last.getUTCDate()));
  }
  if (!Number.isFinite(day.getTime()) || day.getUTCFullYear() > 9999)
    throw new Error('Vencimiento fuera de rango');
  return day.toISOString().slice(0, 10);
}
const businessZone = 'America/Guayaquil';
export function businessDay(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: businessZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}
export function businessTimestamp(now = new Date()): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: businessZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(now)
      .map(({ type, value }) => [type, value])
  );
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}`;
}
export type RuleEvaluation = {
  id: string;
  status: 'AL_DIA' | 'PROXIMO' | 'VENCIDO' | 'SIN_LECTURA' | 'CONFIGURACION_INVALIDA';
  target: string;
  remaining: string;
  unit: string;
  proposedDate?: string;
};
export function latestExecution(data: RelationalData, planId: string) {
  return data.orders
    .filter(o => o.id_plan === planId && o.estado === 'REALIZADA' && o.fecha_realizada)
    .sort(
      (a, b) =>
        b.fecha_realizada!.localeCompare(a.fecha_realizada!) ||
        (BigInt(a.id_ordm) > BigInt(b.id_ordm) ? -1 : 1)
    )[0];
}
export function evaluateRule(
  data: RelationalData,
  plan: PlanRow,
  rule: RuleRow,
  today = businessDay()
): RuleEvaluation {
  const unit = data.units.find(u => u.id_um === rule.id_um);
  const invalid: RuleEvaluation = {
    id: rule.id_regla,
    status: 'CONFIGURACION_INVALIDA',
    target: '',
    remaining: '',
    unit: unit?.nombre ?? '',
  };
  if (!unit) return invalid;
  const previous = latestExecution(data, plan.id_plan);
  try {
    if (unit.tipo_control === 'CALENDARIO') {
      const target = calendarDue(
        previous?.fecha_realizada ?? plan.fecha_inicio,
        rule.frecuencia,
        unit.codigo
      );
      const remain = Math.round(
        (Date.parse(target + 'T00:00:00Z') - Date.parse(today + 'T00:00:00Z')) / 86400000
      );
      return {
        id: rule.id_regla,
        target,
        remaining: `${remain} días`,
        unit: unit.nombre,
        proposedDate: target,
        status:
          remain <= 0
            ? 'VENCIDO'
            : remain <= Number(rule.alerta_antes ?? '0')
              ? 'PROXIMO'
              : 'AL_DIA',
      };
    }
    if (!rule.id_medidor || rule.valor_base == null) return invalid;
    const distinct = new Set(
      data.rules
        .filter(r => r.id_plan === plan.id_plan && r.estado && r.id_medidor)
        .map(r => r.id_medidor)
    );
    // One order value cannot safely reset several different meters.
    if (distinct.size > 1) return invalid;
    const reading = data.readings
      .filter(
        r =>
          !r.anulacion && r.id_medidor === rule.id_medidor && r.fecha_lectura.slice(0, 10) <= today
      )
      .sort(
        (a, b) =>
          b.fecha_lectura.localeCompare(a.fecha_lectura) ||
          (BigInt(a.id_lectura) > BigInt(b.id_lectura) ? -1 : 1)
      )[0];
    const target = cents(previous?.valor_realizado ?? rule.valor_base) + cents(rule.frecuencia);
    if (!reading) return { ...invalid, status: 'SIN_LECTURA', target: decimal(target) };
    const remain = target - cents(reading.valor);
    let proposedDate: string | undefined;
    if (remain <= 0n) {
      proposedDate = today;
    } else {
      const meterReadings = data.readings
        .filter(
          r =>
            !r.anulacion &&
            r.id_medidor === rule.id_medidor &&
            r.fecha_lectura.slice(0, 10) <= today
        )
        .sort((a, b) => a.fecha_lectura.localeCompare(b.fecha_lectura));
      if (meterReadings.length >= 2) {
        const oldest = meterReadings[0];
        const newest = meterReadings[meterReadings.length - 1];
        const oldestDay = oldest.fecha_lectura.slice(0, 10);
        const newestDay = newest.fecha_lectura.slice(0, 10);
        const days = Math.round(
          (Date.parse(newestDay + 'T00:00:00Z') - Date.parse(oldestDay + 'T00:00:00Z')) / 86400000
        );
        const valDiff = cents(newest.valor) - cents(oldest.valor);
        if (days > 0 && valDiff > 0n) {
          const rate = Number(valDiff) / days;
          const daysNeeded = Math.ceil(Number(remain) / rate);
          if (daysNeeded > 0 && daysNeeded <= 3650) {
            const proj = new Date(today + 'T00:00:00Z');
            proj.setUTCDate(proj.getUTCDate() + daysNeeded);
            proposedDate = proj.toISOString().slice(0, 10);
          }
        }
      }
    }
    return {
      id: rule.id_regla,
      target: decimal(target),
      remaining: `${remain < 0n ? '-' : ''}${decimal(remain < 0n ? -remain : remain)} ${unit.nombre}`,
      unit: unit.nombre,
      proposedDate,
      status:
        remain <= 0n ? 'VENCIDO' : remain <= cents(rule.alerta_antes ?? '0') ? 'PROXIMO' : 'AL_DIA',
    };
  } catch {
    return invalid;
  }
}
export function evaluatePlan(data: RelationalData, plan: PlanRow, today = businessDay()) {
  const rules = data.rules
    .filter(r => r.id_plan === plan.id_plan && r.estado)
    .sort((a, b) => a.orden_eval - b.orden_eval);
  const evaluations = rules.map(rule => evaluateRule(data, plan, rule, today));
  if (
    plan.estado !== 'ACTIVO' ||
    data.assets.some(asset => asset.id_activo === plan.id_activo && asset.act_usa_mant === 'N')
  )
    return { status: 'INACTIVO', rules: evaluations };
  if (today < plan.fecha_inicio || (plan.fecha_fin && today > plan.fecha_fin))
    return { status: 'FUERA_VIGENCIA', rules: evaluations };
  if (
    !rules.length ||
    new Set(rules.map(r => r.condicion)).size !== 1 ||
    evaluations.some(e => e.status === 'CONFIGURACION_INVALIDA')
  )
    return { status: 'CONFIGURACION_INVALIDA', rules: evaluations };
  const statuses = evaluations.map(e => e.status);

  // 1. Prioridad Máxima: Si ya existe una Orden PENDIENTE con fecha programada para este plan
  const pendingOrder = data.orders
    ?.filter(o => o.id_plan === plan.id_plan && o.estado === 'PENDIENTE' && o.fecha_programada)
    .sort((a, b) => a.fecha_programada!.localeCompare(b.fecha_programada!))[0];

  let proposedDate: string | undefined = pendingOrder?.fecha_programada ?? undefined;

  // 2. Proyección por reglas (calendario exacto o consumo de medidor)
  if (!proposedDate) {
    const ruleDates = evaluations
      .map(e => e.proposedDate)
      .filter((d): d is string => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d));
    if (ruleDates.length) {
      if (rules[0]?.condicion === 'AND') {
        proposedDate = ruleDates.sort().reverse()[0];
      } else {
        proposedDate = ruleDates.sort()[0];
      }
    }
  }

  // 3. Cascada de respaldo: Si está Vencido o Próximo y aún no tiene fecha calculada
  if (!proposedDate) {
    if (
      statuses.includes('VENCIDO') ||
      (rules[0]?.condicion === 'OR' && statuses.includes('VENCIDO'))
    ) {
      proposedDate = today;
    } else if (statuses.includes('PROXIMO')) {
      if (plan.fecha_fin && plan.fecha_fin >= today) {
        proposedDate = plan.fecha_fin;
      } else {
        const nextWeek = new Date(today + 'T00:00:00Z');
        nextWeek.setUTCDate(nextWeek.getUTCDate() + 7);
        proposedDate = nextWeek.toISOString().slice(0, 10);
      }
    }
  }

  if (rules[0].condicion === 'OR' && statuses.includes('VENCIDO'))
    return { status: 'VENCIDO', rules: evaluations, proposedDate };
  if (statuses.includes('SIN_LECTURA'))
    return { status: 'SIN_LECTURA', rules: evaluations, proposedDate };
  const rank = { AL_DIA: 0, PROXIMO: 1, VENCIDO: 2, SIN_LECTURA: -1, CONFIGURACION_INVALIDA: -1 };
  const severity =
    rules[0].condicion === 'AND'
      ? Math.min(...statuses.map(s => rank[s]))
      : Math.max(...statuses.map(s => rank[s]));
  return { status: ['AL_DIA', 'PROXIMO', 'VENCIDO'][severity], rules: evaluations, proposedDate };
}
