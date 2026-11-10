import { useState, useMemo } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Clock,
  Gauge,
} from 'lucide-react';
import type { PlanRow, RuleRow, ExternalAsset, MaintTypeRow } from '../../../../shared/relational';
import type { RuleEvaluation } from '../../../../shared/maintenance-evaluation';
import { Status } from './RelationalTable';

export interface EvaluatedPlanItem {
  plan: PlanRow;
  status: string;
  rules: RuleEvaluation[];
  proposedDate?: string;
}

export interface CalendarDayCell {
  dateString: string;
  dayNumber: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
  plans: EvaluatedPlanItem[];
}

interface PlansCalendarProps {
  plans: EvaluatedPlanItem[];
  allRules: RuleRow[];
  assets: ExternalAsset[];
  types: MaintTypeRow[];
  today: string;
  onSelectPlan?: (planId: string) => void;
  onCreateOrder?: (planId: string) => void;
  canCreateOrder?: boolean;
}

export function PlansCalendar({
  plans,
  allRules,
  assets,
  types,
  today,
  onSelectPlan,
  onCreateOrder,
  canCreateOrder = false,
}: PlansCalendarProps) {
  // Current visible month (year and month 0-indexed)
  const [viewDate, setViewDate] = useState(() => {
    const initial = today ? new Date(today + 'T00:00:00Z') : new Date();
    return new Date(Date.UTC(initial.getUTCFullYear(), initial.getUTCMonth(), 1));
  });

  const [selectedDate, setSelectedDate] = useState<string | null>(today || null);

  const year = viewDate.getUTCFullYear();
  const month = viewDate.getUTCMonth();

  const prevMonth = () => {
    setViewDate(new Date(Date.UTC(year, month - 1, 1)));
  };

  const nextMonth = () => {
    setViewDate(new Date(Date.UTC(year, month + 1, 1)));
  };

  const goToday = () => {
    const now = today ? new Date(today + 'T00:00:00Z') : new Date();
    setViewDate(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)));
    setSelectedDate(today);
  };

  const monthName = new Intl.DateTimeFormat('es-EC', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(viewDate);

  // Group plans by proposedDate
  const { plansByDate, unscheduledPlans } = useMemo(() => {
    const map = new Map<string, EvaluatedPlanItem[]>();
    const unscheduled: EvaluatedPlanItem[] = [];

    for (const item of plans) {
      if (item.plan.estado !== 'ACTIVO') continue;
      if (item.proposedDate) {
        const list = map.get(item.proposedDate) || [];
        list.push(item);
        map.set(item.proposedDate, list);
      } else {
        unscheduled.push(item);
      }
    }
    return { plansByDate: map, unscheduledPlans: unscheduled };
  }, [plans]);

  // Compute 7x(5 or 6) calendar grid days starting on Monday
  const gridDays = useMemo(() => {
    const firstDay = new Date(Date.UTC(year, month, 1));
    const lastDay = new Date(Date.UTC(year, month + 1, 0));

    // First day weekday (1 = Mon, 7 = Sun)
    const firstWeekday = firstDay.getUTCDay() === 0 ? 7 : firstDay.getUTCDay();
    // Grid starts on previous Monday
    const startOffset = firstWeekday - 1;
    const startDate = new Date(Date.UTC(year, month, 1 - startOffset));

    const days: CalendarDayCell[] = [];
    const current = new Date(startDate);

    // Build 35 or 42 cells as needed
    const totalDaysNeeded = Math.ceil((startOffset + lastDay.getUTCDate()) / 7) * 7;

    for (let i = 0; i < totalDaysNeeded; i++) {
      const dateString = current.toISOString().slice(0, 10);
      const isCurrentMonth = current.getUTCMonth() === month;
      const isToday = dateString === today;
      const isSelected = dateString === selectedDate;
      const dayPlans = plansByDate.get(dateString) || [];

      days.push({
        dateString,
        dayNumber: current.getUTCDate(),
        isCurrentMonth,
        isToday,
        isSelected,
        plans: dayPlans,
      });

      current.setUTCDate(current.getUTCDate() + 1);
    }
    return days;
  }, [year, month, today, selectedDate, plansByDate]);

  const selectedPlans = selectedDate ? plansByDate.get(selectedDate) || [] : [];

  const assetName = (id: string) => {
    const a = assets.find(x => x.id_activo === id);
    return a ? (a.clave ? `${a.clave} · ` : '') + a.nombre : `Activo ${id}`;
  };

  const typeName = (id: string) => types.find(t => t.id_tima === id)?.nombre ?? 'Mantenimiento';

  return (
    <div className="space-y-4">
      {/* Barra de control del calendario */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 border rounded-xl shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex items-center rounded-lg border bg-slate-50 p-0.5">
            <button
              type="button"
              onClick={prevMonth}
              className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-white rounded-md transition-colors"
              title="Mes anterior"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              type="button"
              onClick={nextMonth}
              className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-white rounded-md transition-colors"
              title="Mes siguiente"
            >
              <ChevronRight size={18} />
            </button>
          </div>
          <button
            type="button"
            onClick={goToday}
            className="px-2.5 py-1 text-xs font-semibold border rounded-lg hover:bg-slate-50 text-slate-700 transition-colors"
          >
            Hoy
          </button>
          <h2 className="text-base font-bold text-slate-900 capitalize flex items-center gap-2">
            <CalendarIcon size={18} className="text-blue-600" />
            {monthName}
          </h2>
        </div>

        {/* Leyenda de estados */}
        <div className="flex items-center gap-4 text-xs font-medium text-slate-600">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
            <span>Al día</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" />
            <span>Próximo</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block" />
            <span>Vencido</span>
          </div>
        </div>
      </div>

      {/* Cuadrícula mensual */}
      <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
        {/* Cabecera de días de la semana */}
        <div className="grid grid-cols-7 border-b bg-slate-50 text-center text-xs font-semibold text-slate-600">
          {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map(d => (
            <div key={d} className="py-2.5">
              {d}
            </div>
          ))}
        </div>

        {/* Celdas del mes */}
        <div className="grid grid-cols-7 auto-rows-fr divide-x divide-y border-b">
          {gridDays.map(dayItem => {
            const hasPlans = dayItem.plans.length > 0;
            return (
              <div
                key={dayItem.dateString}
                onClick={() => setSelectedDate(dayItem.dateString)}
                className={`min-h-[90px] p-1.5 cursor-pointer transition-colors flex flex-col justify-between ${
                  !dayItem.isCurrentMonth
                    ? 'bg-slate-50/50 text-slate-400'
                    : dayItem.isSelected
                      ? 'bg-blue-50/60 ring-2 ring-inset ring-blue-500/30'
                      : 'hover:bg-slate-50 text-slate-800'
                }`}
              >
                {/* Número del día */}
                <div className="flex items-center justify-between">
                  <span
                    className={`inline-flex items-center justify-center text-xs font-semibold w-6 h-6 rounded-full ${
                      dayItem.isToday
                        ? 'bg-blue-600 text-white font-bold'
                        : dayItem.isSelected
                          ? 'bg-blue-100 text-blue-800'
                          : ''
                    }`}
                  >
                    {dayItem.dayNumber}
                  </span>
                  {hasPlans && (
                    <span className="text-[10px] font-bold text-slate-400">
                      {dayItem.plans.length}
                    </span>
                  )}
                </div>

                {/* Eventos / Planes del día */}
                <div className="space-y-1 mt-1 flex-1">
                  {dayItem.plans.slice(0, 2).map(item => {
                    const tone =
                      item.status === 'VENCIDO'
                        ? 'bg-rose-50 text-rose-800 border-rose-200 hover:bg-rose-100'
                        : item.status === 'PROXIMO'
                          ? 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
                          : 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100';

                    const dotTone =
                      item.status === 'VENCIDO'
                        ? 'bg-rose-500'
                        : item.status === 'PROXIMO'
                          ? 'bg-amber-500'
                          : 'bg-emerald-500';

                    return (
                      <div
                        key={item.plan.id_plan}
                        onClick={e => {
                          e.stopPropagation();
                          setSelectedDate(dayItem.dateString);
                          if (onSelectPlan) onSelectPlan(item.plan.id_plan);
                        }}
                        className={`text-[10px] px-1.5 py-0.5 rounded border font-medium truncate flex items-center gap-1 transition-colors ${tone}`}
                        title={`${item.plan.nombre_plan} · ${assetName(item.plan.id_activo)} (${item.status})`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dotTone}`} />
                        <span className="truncate">{item.plan.nombre_plan}</span>
                      </div>
                    );
                  })}
                  {dayItem.plans.length > 2 && (
                    <p className="text-[9px] font-semibold text-slate-500 pl-1">
                      +{dayItem.plans.length - 2} más
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Detalle del día seleccionado */}
      {selectedDate && (
        <section className="bg-white border rounded-xl p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between border-b pb-2.5">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Clock size={16} className="text-blue-600" />
                Planes previstos para el{' '}
                {new Intl.DateTimeFormat('es-EC', {
                  dateStyle: 'full',
                  timeZone: 'UTC',
                }).format(new Date(selectedDate + 'T00:00:00Z'))}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {selectedPlans.length}{' '}
                {selectedPlans.length === 1 ? 'servicio programado' : 'servicios programados'} para
                esta fecha
              </p>
            </div>
            {selectedDate !== today && (
              <button
                type="button"
                onClick={() => setSelectedDate(today)}
                className="text-xs font-semibold text-blue-600 hover:underline"
              >
                Volver al día actual
              </button>
            )}
          </div>

          {selectedPlans.length ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {selectedPlans.map(item => {
                const rules = allRules.filter(r => r.id_plan === item.plan.id_plan && r.estado);
                return (
                  <article
                    key={item.plan.id_plan}
                    className="p-3.5 border rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors space-y-2.5 flex flex-col justify-between"
                  >
                    <div className="space-y-1">
                      <div className="flex justify-between items-start gap-2">
                        <span className="text-xs font-semibold text-blue-700 line-clamp-1">
                          {assetName(item.plan.id_activo)}
                        </span>
                        <Status value={item.status} />
                      </div>
                      <h4 className="text-sm font-bold text-slate-900 leading-snug">
                        {item.plan.nombre_plan}
                      </h4>
                      <p className="text-xs text-slate-500">
                        {typeName(item.plan.id_tima)}
                        {item.plan.fecha_inicio ? ` · Desde ${item.plan.fecha_inicio}` : ''}
                      </p>
                      {rules.map(r => (
                        <div key={r.id_regla} className="text-[11px] text-slate-600 bg-white p-1.5 rounded border">
                          Frecuencia: <strong>{r.frecuencia}</strong> {r.id_medidor ? 'unidades' : 'días'}
                        </div>
                      ))}
                    </div>

                    <div className="pt-2 border-t flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => onSelectPlan && onSelectPlan(item.plan.id_plan)}
                        className="sm-link text-xs font-semibold"
                      >
                        Ver ficha del plan →
                      </button>
                      {canCreateOrder && (
                        <button
                          type="button"
                          onClick={() => onCreateOrder && onCreateOrder(item.plan.id_plan)}
                          className="px-2.5 py-1 text-xs font-semibold bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                        >
                          Generar orden
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="py-6 text-center text-xs text-slate-500">
              No hay planes de mantenimiento propuestos para este día.
            </div>
          )}
        </section>
      )}

      {/* Planes pendientes de proyección por lectura de medidor (si existen) */}
      {unscheduledPlans.length > 0 && (
        <details className="p-3 bg-slate-50 border rounded-xl text-xs text-slate-600">
          <summary className="font-semibold cursor-pointer text-slate-700 flex items-center gap-1.5">
            <Gauge size={14} />
            {unscheduledPlans.length}{' '}
            {unscheduledPlans.length === 1
              ? 'plan controlado exclusivamente por lectura (pendiente de lecturas para proyectar fecha)'
              : 'planes controlados exclusivamente por lectura (pendientes de lecturas para proyectar fecha)'}
          </summary>
          <ul className="mt-2.5 space-y-1.5 pl-4 list-disc">
            {unscheduledPlans.map(item => (
              <li key={item.plan.id_plan} className="flex items-center gap-2">
                <strong>{item.plan.nombre_plan}</strong>
                <span className="text-slate-500">({assetName(item.plan.id_activo)})</span>
                <Status value={item.status} />
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
