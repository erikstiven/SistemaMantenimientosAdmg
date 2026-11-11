import { ClipboardList, Droplets, Plus, Settings, Wrench } from 'lucide-react';
import type { ReactNode } from 'react';
import {
  cents,
  decimal,
  lastValidReadingAt,
  type MeterRow,
  type OrderRow,
  type PlanRow,
  type RuleRow,
  type RelationalData,
} from '../../../../shared/relational';
import type { RuleEvaluation } from '../../../../shared/maintenance-evaluation';
import { formatReadingTimestamp, formatReadingValue } from '../reading-format';

const statuses = { normal: 'Normal', near: 'Próximo', overdue: 'Vencido' };

function typeIcon(name: string) {
  if (/aceite|lubric/i.test(name)) return Droplets;
  if (/motor/i.test(name)) return Wrench;
  if (/hidr[aá]ul/i.test(name)) return Settings;
  return ClipboardList;
}

function meterProgress(evaluation: RuleEvaluation, rule: RuleRow, order?: OrderRow) {
  if (!evaluation.meterCycle) return;
  const { base, current } = evaluation.meterCycle;
  const start = cents(base);
  const reading = cents(current);
  const ruleTarget = cents(evaluation.target);
  const scheduled = order?.valor_programado != null ? cents(order.valor_programado) : ruleTarget;
  const target = scheduled < ruleTarget ? scheduled : ruleTarget;
  const remaining = target - reading;
  const interval = target - start;
  const percent =
    remaining <= 0n
      ? 100
      : reading <= start || interval <= 0n
        ? 0
        : Number(((reading - start) * 100n) / interval);
  return {
    percent,
    status: remaining <= 0n ? 'overdue' : remaining <= cents(rule.alerta_antes) ? 'near' : 'normal',
    remaining,
  } as const;
}

export function MeterMaintenanceStatus({
  meter,
  data,
  evaluations,
  canEvaluate,
  day,
  unit,
  orderLink,
  registerReading,
  canReadReadings = true,
}: {
  meter: MeterRow;
  data: RelationalData;
  evaluations: Map<string, { plan: PlanRow; rules: RuleEvaluation[] }>;
  canEvaluate: boolean;
  day: string;
  unit: string;
  orderLink: (id: string, label: string) => ReactNode;
  registerReading?: (typeId: string) => void;
  canReadReadings?: boolean;
}) {
  const asset = data.assets.find(row => row.id_activo === meter.id_activo);
  const enabled = meter.estado && asset?.act_usa_mant !== 'N';
  const pending = new Map<string, OrderRow>();
  const rows =
    canEvaluate && enabled
      ? data.rules
          .flatMap(rule => {
            if (!rule.estado || rule.id_medidor !== meter.id_medidor || rule.id_um !== meter.id_um)
              return [];
            const result = evaluations.get(rule.id_plan);
            const plan = result?.plan;
            if (
              !plan ||
              plan.id_activo !== meter.id_activo ||
              plan.estado !== 'ACTIVO' ||
              plan.fecha_inicio > day ||
              (plan.fecha_fin && plan.fecha_fin < day)
            )
              return [];
            const evaluation = result.rules.find(item => item.id === rule.id_regla);
            if (!evaluation) return [];
            const type =
              data.types.find(item => item.id_tima === plan.id_tima)?.nombre ?? 'Mantenimiento';
            return [{ rule, plan, evaluation, type }];
          })
          .sort(
            (a, b) =>
              a.type.localeCompare(b.type, 'es') ||
              a.plan.nombre_plan.localeCompare(b.plan.nombre_plan, 'es')
          )
      : [];
  if (rows.length) {
    const planIds = new Set(rows.map(({ plan }) => plan.id_plan));
    for (const order of data.orders) {
      if (order.estado !== 'PENDIENTE' || !planIds.has(order.id_plan)) continue;
      const previous = pending.get(order.id_plan);
      if (
        !previous ||
        (order.fecha_programada ?? '9999-12-31') < (previous.fecha_programada ?? '9999-12-31') ||
        (order.fecha_programada === previous.fecha_programada &&
          BigInt(order.id_ordm) < BigInt(previous.id_ordm))
      )
        pending.set(order.id_plan, order);
    }
  }
  const configured = data.meterTypesReady
    ? (data.meterTypes
        ?.filter(item => item.id_medidor === meter.id_medidor && item.estado)
        .map(item => item.id_tima) ?? [])
    : [...new Set(rows.map(item => item.plan.id_tima))];

  return (
    <section className="sm-meter-maintenance" aria-label="Próximos mantenimientos">
      <h3>Próximos mantenimientos</h3>
      {configured.length ? (
        <ul>
          {configured.map(typeId => {
            const type = data.types.find(item => item.id_tima === typeId);
            const current = lastValidReadingAt(
              data.readings,
              meter.id_medidor,
              undefined,
              data.meterTypesReady ? typeId : null
            );
            const Icon = typeIcon(type?.nombre ?? '');
            const plans = rows.filter(row => row.plan.id_tima === typeId);
            return (
              <li key={typeId} className="sm-meter-measure">
                <div className="sm-meter-maintenance-title">
                  <Icon size={16} aria-hidden />
                  <strong>{type?.nombre ?? `Tipo #${typeId}`}</strong>
                  {registerReading && enabled && type?.estado && (
                    <button
                      type="button"
                      className="sm-record-action"
                      aria-label={`Registrar lectura de ${type.nombre}`}
                      title={`Registrar lectura de ${type.nombre}`}
                      onClick={() => registerReading(typeId)}
                    >
                      <Plus size={16} aria-hidden />
                    </button>
                  )}
                </div>
                <p className="sm-meter-measure-value">
                  {canReadReadings ? (
                    <>
                      <strong>
                        {formatReadingValue(current?.valor)} {unit}
                      </strong>
                      {' · '}
                      {current
                        ? formatReadingTimestamp(current.fecha_lectura)
                        : 'Sin lecturas registradas'}
                    </>
                  ) : (
                    'Sin permiso para consultar lecturas'
                  )}
                </p>
                {!plans.length && (
                  <p>
                    {!enabled
                      ? 'Medidor o activo fuera de mantenimiento.'
                      : !canEvaluate
                        ? 'Avance no disponible con los permisos actuales.'
                        : 'Sin plan de mantenimiento vigente para esta medida.'}
                  </p>
                )}
                <ul>
                  {plans.map(({ rule, plan, evaluation }) => {
                    const order = pending.get(plan.id_plan);
                    const progress = meterProgress(evaluation, rule, order);
                    const distance = progress
                      ? [
                          formatReadingValue(
                            decimal(
                              progress.remaining < 0n ? -progress.remaining : progress.remaining
                            )
                          ),
                          unit,
                        ]
                          .filter(Boolean)
                          .join(' ')
                      : '';
                    return (
                      <li key={rule.id_regla} className="sm-meter-maintenance-row">
                        <div className="sm-meter-maintenance-title">
                          <div>
                            <p>{plan.nombre_plan}</p>
                          </div>
                        </div>
                        {progress ? (
                          <>
                            <progress
                              className={`sm-meter-progress sm-meter-progress-${progress.status}`}
                              aria-label={`Avance de ${plan.nombre_plan}, cada ${rule.frecuencia} ${unit}`}
                              max={100}
                              value={progress.percent}
                            />
                            <div className="sm-meter-progress-caption">
                              <span>{progress.percent}% utilizado</span>
                              <strong className={`sm-meter-progress-label-${progress.status}`}>
                                {progress.remaining < 0n
                                  ? `Excedido por ${distance}`
                                  : `${distance} restantes`}
                                {' · '}
                                {statuses[progress.status]}
                              </strong>
                            </div>
                          </>
                        ) : (
                          <p>
                            {evaluation.status === 'SIN_LECTURA'
                              ? 'Sin lecturas válidas'
                              : 'Revisar reglas del plan'}
                          </p>
                        )}
                        <p>
                          {order ? (
                            <>
                              {orderLink(order.id_ordm, `Orden #${order.id_ordm}`)}
                              {' · '}
                              {order.fecha_programada
                                ? formatReadingTimestamp(order.fecha_programada)
                                : 'Sin fecha'}
                              {order.valor_programado != null && (
                                <>
                                  {' '}
                                  · Programada a {formatReadingValue(order.valor_programado)} {unit}
                                </>
                              )}
                            </>
                          ) : evaluation.proposedDate ? (
                            `Fecha estimada ${formatReadingTimestamp(evaluation.proposedDate)}`
                          ) : (
                            'Sin orden programada'
                          )}
                        </p>
                      </li>
                    );
                  })}
                </ul>
              </li>
            );
          })}
        </ul>
      ) : (
        <p>
          {!enabled
            ? 'Medidor o activo fuera de mantenimiento.'
            : !canEvaluate
              ? 'Avance no disponible con los permisos actuales.'
              : 'Configura los tipos de mantenimiento de este medidor para agregar sus medidas.'}
        </p>
      )}
    </section>
  );
}
