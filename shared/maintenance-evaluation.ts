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
export function businessDay(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Guayaquil',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}
export type RuleEvaluation = {
  id: string;
  status: 'AL_DIA' | 'PROXIMO' | 'VENCIDO' | 'SIN_LECTURA' | 'CONFIGURACION_INVALIDA';
  target: string;
  remaining: string;
  unit: string;
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
      .filter(r => r.id_medidor === rule.id_medidor && r.fecha_lectura.slice(0, 10) <= today)
      .sort(
        (a, b) =>
          b.fecha_lectura.localeCompare(a.fecha_lectura) ||
          (BigInt(a.id_lectura) > BigInt(b.id_lectura) ? -1 : 1)
      )[0];
    const target = cents(previous?.valor_realizado ?? rule.valor_base) + cents(rule.frecuencia);
    if (!reading) return { ...invalid, status: 'SIN_LECTURA', target: decimal(target) };
    const remain = target - cents(reading.valor);
    return {
      id: rule.id_regla,
      target: decimal(target),
      remaining: `${remain < 0n ? '-' : ''}${decimal(remain < 0n ? -remain : remain)} ${unit.nombre}`,
      unit: unit.nombre,
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
  if (plan.estado !== 'ACTIVO') return { status: 'INACTIVO', rules: evaluations };
  if (today < plan.fecha_inicio || (plan.fecha_fin && today > plan.fecha_fin))
    return { status: 'FUERA_VIGENCIA', rules: evaluations };
  if (
    !rules.length ||
    new Set(rules.map(r => r.condicion)).size !== 1 ||
    evaluations.some(e => e.status === 'CONFIGURACION_INVALIDA')
  )
    return { status: 'CONFIGURACION_INVALIDA', rules: evaluations };
  const statuses = evaluations.map(e => e.status);
  if (rules[0].condicion === 'OR' && statuses.includes('VENCIDO'))
    return { status: 'VENCIDO', rules: evaluations };
  if (statuses.includes('SIN_LECTURA')) return { status: 'SIN_LECTURA', rules: evaluations };
  const rank = { AL_DIA: 0, PROXIMO: 1, VENCIDO: 2, SIN_LECTURA: -1, CONFIGURACION_INVALIDA: -1 };
  const severity =
    rules[0].condicion === 'AND'
      ? Math.min(...statuses.map(s => rank[s]))
      : Math.max(...statuses.map(s => rank[s]));
  return { status: ['AL_DIA', 'PROXIMO', 'VENCIDO'][severity], rules: evaluations };
}
