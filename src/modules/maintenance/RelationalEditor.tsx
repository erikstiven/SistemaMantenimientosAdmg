import { useId, type FormEvent, type Dispatch, type SetStateAction } from 'react';
import { Plus } from 'lucide-react';
import {
  cents,
  decimal,
  subtotal,
  amount,
  timestamp,
  lastValidReadingAt,
  normalizeTimestamp,
  meterCodeMaxLength,
  meterNameMaxLength,
  type RelationalData,
} from '../../../shared/relational';
import { styles } from '../../components/styles';
import { Modal } from '../../components/Modal';
import { Notice } from '../../components/Feedback';
import { moduleInfo, titles, type ModuleKey } from './relational-labels';
import { ReadingFields } from './components/ReadingFields';
import { ReadingReference } from './components/ReadingReference';
import {
  formatReadingTimestamp,
  formatReadingValue,
  latestValidReadings,
  readingObservation,
  readingUnitSymbol,
} from './reading-format';
import { suggestPlanText, type PlanTextField } from './plan-text';
import { suggestMeterText, type MeterTextField } from './meter-text';
import { describeNewOrder, describeService } from './order-description';
export type Draft = Record<string, string | boolean | null>;
type RuleDraft = {
  id_um: string;
  id_medidor: string | null;
  frecuencia: string;
  valor_base: string | null;
  alerta_antes: string;
};
type DetailDraft = { id_repu: string; cantidad: string; costo_unitario: string };
export type Editor = {
  kind: string;
  id?: string;
  draft: Draft;
  rules: RuleDraft[];
  details: DetailDraft[];
  readingCustomized?: boolean;
  planTextCustomized?: Partial<Record<PlanTextField, boolean>>;
  meterTextCustomized?: Partial<Record<MeterTextField, boolean>>;
  orderDescriptionCustomized?: boolean;
};
type Props = {
  editor: Editor;
  data: RelationalData;
  busy: boolean;
  formError: string;
  setEditor: Dispatch<SetStateAction<Editor | null>>;
  mutate: (path: string, body: unknown, method?: string) => Promise<void>;
  assetName: (id: string) => string;
  meterName: (id: string) => string;
  planName: (id: string) => string;
  onQuickPart?: (row: number) => void;
  quickPart?: boolean;
  confirmServiceReading?: (message: string, accept: () => void) => void;
  canReadReadings?: boolean;
};
export function RelationalEditor({
  editor,
  data,
  busy,
  formError,
  setEditor,
  mutate,
  assetName,
  meterName,
  planName,
  onQuickPart,
  quickPart,
  confirmServiceReading,
  canReadReadings = true,
}: Props) {
  const titleId = useId();
  const orderUnitHintId = useId();
  const orderReadingId = useId();
  const serviceReadingId = useId();
  const scheduledReadingId = useId();
  const newOrder =
    editor.kind === 'orders' && !editor.id ? describeNewOrder(data, editor.draft) : null;
  const meterSuggestions =
    editor.kind === 'meters' && !editor.id
      ? suggestMeterText(data, editor.draft.id_activo, editor.draft.id_um)
      : null;
  const orderMeters = canReadReadings ? (newOrder?.meters ?? []) : [];
  const orderReadings = latestValidReadings(orderMeters.length ? data.readings : []);
  const meterText = (key: MeterTextField) =>
    editor.meterTextCustomized?.[key] ? editor.draft[key] : meterSuggestions?.[key];
  const suggestions = editor.kind === 'plans' ? suggestPlanText(data, editor) : null;
  const planText = (key: PlanTextField) =>
    String((editor.planTextCustomized?.[key] ? editor.draft[key] : suggestions?.[key]) ?? '');
  function changePlanText(key: PlanTextField, value: string) {
    setEditor(
      old =>
        old && {
          ...old,
          planTextCustomized: { ...old.planTextCustomized, [key]: true },
          draft: { ...old.draft, [key]: value },
        }
    );
  }
  function suggestionButton(key: PlanTextField) {
    return (
      editor.planTextCustomized?.[key] &&
      suggestions?.[key] && (
        <button
          type="button"
          className="sm-link text-sm"
          onClick={() =>
            setEditor(
              old =>
                old && {
                  ...old,
                  planTextCustomized: { ...old.planTextCustomized, [key]: false },
                }
            )
          }
        >
          Usar sugerencia
        </button>
      )
    );
  }
  const activeAssets = data.assets.filter(a => a.act_usa_mant === 'S');
  const currentOrder =
    editor?.kind === 'complete' ? data?.orders.find(o => o.id_ordm === editor.id) : undefined;
  const currentPlan = data?.plans.find(p => p.id_plan === currentOrder?.id_plan);
  const completionRules = data.rules.filter(
    r => r.id_plan === currentPlan?.id_plan && r.estado && r.id_medidor
  );
  const completionMeters = new Set(completionRules.map(r => r.id_medidor!));
  const completionMeterId =
    completionMeters.size === 1 ? completionRules[0].id_medidor! : undefined;
  const serviceUnit = completionMeterId ? readingUnitSymbol(data, completionRules[0].id_um) : '';
  const latestServiceReading = completionMeterId
    ? lastValidReadingAt(data.readings, completionMeterId)
    : undefined;
  const suggestedDescription =
    newOrder?.description ??
    (currentPlan ? describeService(data, currentPlan, editor, serviceUnit) : '');
  const orderDescription =
    editor.orderDescriptionCustomized || (editor.id && editor.kind === 'orders')
      ? String(editor.draft.observacion ?? '')
      : suggestedDescription;

  function descriptionField(label: string) {
    return (
      <div>
        <label className="block text-sm font-medium">
          {label}
          <textarea
            rows={4}
            maxLength={5000}
            className={styles.input + ' mt-1'}
            value={orderDescription}
            onChange={event => {
              const value = event.target.value;
              setEditor(
                old =>
                  old && {
                    ...old,
                    orderDescriptionCustomized: true,
                    draft: { ...old.draft, observacion: value },
                  }
              );
            }}
          />
        </label>
        {editor.orderDescriptionCustomized && suggestedDescription && (
          <button
            type="button"
            className="sm-link text-sm"
            onClick={() => setEditor(old => old && { ...old, orderDescriptionCustomized: false })}
          >
            Usar sugerencia
          </button>
        )}
      </div>
    );
  }
  function field(label: string, key: string, type = 'text', required = true, maxLength?: number) {
    const meterKey =
      meterSuggestions && (key === 'codigo' || key === 'nombre_medidor') ? key : null;
    return (
      <label className="block text-sm font-medium">
        {label}
        <input
          required={required}
          maxLength={maxLength}
          type={type}
          step={type === 'number' ? '0.01' : type === 'datetime-local' ? '1' : undefined}
          min={type === 'number' ? '0' : undefined}
          className={styles.input + ' mt-1'}
          value={String((meterKey ? meterText(meterKey) : editor.draft[key]) ?? '')}
          onChange={event =>
            setEditor(
              old =>
                old && {
                  ...old,
                  draft: { ...old.draft, [key]: event.target.value },
                  ...(meterKey
                    ? {
                        meterTextCustomized: { ...old.meterTextCustomized, [meterKey]: true },
                      }
                    : {}),
                }
            )
          }
        />
      </label>
    );
  }
  function select(
    label: string,
    key: string,
    options: { id: string; name: string }[],
    required = true
  ) {
    return (
      <label className="block text-sm font-medium">
        {label}
        <select
          required={required}
          className={styles.input + ' mt-1'}
          value={String(editor?.draft[key] ?? '')}
          onChange={event =>
            setEditor(old =>
              old
                ? {
                    ...old,
                    draft: { ...old.draft, [key]: event.target.value },
                    rules:
                      key === 'id_activo'
                        ? old.rules.map(r => ({ ...r, id_medidor: null }))
                        : old.rules,
                  }
                : old
            )
          }
        >
          <option value="">Seleccionar</option>
          {options.map(o => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
      </label>
    );
  }
  function ruleField(index: number, patch: Partial<RuleDraft>) {
    setEditor(old =>
      old ? { ...old, rules: old.rules.map((r, i) => (i === index ? { ...r, ...patch } : r)) } : old
    );
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!editor) return;
    const draft = { ...editor.draft };
    if (meterSuggestions) {
      draft.codigo = meterText('codigo') ?? '';
      draft.nombre_medidor = meterText('nombre_medidor') ?? '';
    }
    if (editor.kind === 'readings' && !editor.id && !editor.readingCustomized)
      draft.observacion = readingObservation(data, draft);
    let path = '/' + editor.kind,
      method = editor.id ? 'PUT' : 'POST';
    if (editor.kind === 'assets') {
      draft.act_fcmp_act = draft.act_fcmp_act || null;
      if (!draft.act_cod_act) delete draft.act_cod_act;
    }
    if (editor.kind === 'plans') {
      draft.nombre_plan = planText('nombre_plan');
      draft.observacion = planText('observacion');
      draft.fecha_fin = draft.fecha_fin || null;
      path = editor.id ? `/plans/${editor.id}/replace` : '/plans';
      method = 'POST';
    } else if (editor.id && editor.kind !== 'complete') path += '/' + editor.id;
    if (editor.kind === 'orders') {
      draft.fecha_programada = draft.fecha_programada || null;
      draft.valor_programado = draft.valor_programado || null;
      draft.observacion = orderDescription;
    }
    if (editor.kind === 'complete') {
      path = `/orders/${editor.id}/complete`;
      method = 'POST';
      draft.valor_realizado = completionMeters.size ? draft.valor_realizado : null;
      draft.observacion = orderDescription;
      const value = amount.safeParse(draft.valor_realizado);
      const date = timestamp.safeParse(draft.fecha_realizada);
      if (completionMeterId && confirmServiceReading && value.success && date.success) {
        const previous = lastValidReadingAt(data.readings, completionMeterId, date.data);
        const timestampTaken = data.readings.some(
          reading =>
            reading.id_medidor === completionMeterId &&
            normalizeTimestamp(reading.fecha_lectura) === normalizeTimestamp(date.data)
        );
        if (!timestampTaken && (!previous || cents(previous.valor) !== cents(value.data))) {
          const measurement = [formatReadingValue(value.data), serviceUnit]
            .filter(Boolean)
            .join(' ');
          confirmServiceReading(
            `También se registrará una lectura de ${measurement} el ${formatReadingTimestamp(date.data)}.`,
            () =>
              void mutate(
                path,
                { ...draft, detalles: editor.details, registrar_lectura: true },
                method
              )
          );
          return;
        }
      }
    }
    await mutate(
      path,
      {
        ...draft,
        ...(editor.kind === 'plans' ? { reglas: editor.rules } : {}),
        ...(editor.kind === 'complete' ? { detalles: editor.details } : {}),
      },
      method
    );
  }

  return (
    <Modal labelledBy={titleId} onClose={() => !busy && setEditor(null)}>
      <form onSubmit={submit} className="sm-modal-content space-y-4">
        <div className="flex justify-between">
          <h2 id={titleId}>
            {editor.kind === 'complete'
              ? 'Completar servicio'
              : editor.kind === 'readings' && editor.id
                ? 'Editar lectura'
                : editor.kind === 'plans' && editor.id
                  ? 'Sustituir estrategia'
                  : !editor.id && editor.kind in moduleInfo
                    ? (moduleInfo[editor.kind as ModuleKey][3] ?? titles[editor.kind])
                    : 'Editar · ' + titles[editor.kind]}
          </h2>
          <button
            type="button"
            aria-label="Cerrar formulario"
            className="sm-secondary sm-icon-button"
            disabled={busy}
            onClick={() => setEditor(null)}
          >
            ✕
          </button>
        </div>
        <fieldset disabled={busy} className="space-y-4">
          {editor.kind === 'assets' && (
            <>
              {field('Nombre del activo', 'nombre')}
              {field('Clave / Referencia ERP', 'clave', 'text', false)}
              {!editor.id && field('Código interno (opcional)', 'act_cod_act', 'text', false)}
              {field('Fecha de compra', 'act_fcmp_act', 'date', false)}
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={editor.draft.act_usa_mant === 'S'}
                  onChange={e =>
                    setEditor(old =>
                      old
                        ? {
                            ...old,
                            draft: {
                              ...old.draft,
                              act_usa_mant: e.target.checked ? 'S' : 'N',
                            },
                          }
                        : old
                    )
                  }
                />
                Habilitado para mantenimiento (act_usa_mant)
              </label>
            </>
          )}
          {editor.kind === 'units' && (
            <>
              {field('Código', 'codigo')}
              {field('Nombre', 'nombre')}
              {select('Tipo de control', 'tipo_control', [
                { id: 'MEDIDOR', name: 'Medidor' },
                { id: 'CALENDARIO', name: 'Calendario' },
              ])}
              <p className="text-sm text-slate-500">Para calendario usa DIA o MES.</p>
            </>
          )}
          {editor.kind === 'types' && (
            <>
              {field('Nombre', 'nombre')}
              {field('Descripción', 'descripcion', 'text', false)}
            </>
          )}
          {editor.kind === 'parts' && (
            <>
              {field('Código', 'codigo')}
              {field('Nombre', 'nombre')}
              {field('Unidad de medida', 'unidad_medida')}
              {field('Costo de referencia', 'costo_referencia', 'number')}
            </>
          )}
          {editor.kind === 'meters' && (
            <>
              {select(
                'Activo',
                'id_activo',
                data.assets
                  .filter(a => a.act_usa_mant === 'S' || a.id_activo === editor.draft.id_activo)
                  .map(a => ({ id: a.id_activo, name: assetName(a.id_activo) }))
              )}
              {select(
                'Unidad de medición',
                'id_um',
                data.units
                  .filter(
                    u =>
                      u.tipo_control === 'MEDIDOR' && (u.estado || u.id_um === editor.draft.id_um)
                  )
                  .map(u => ({ id: u.id_um, name: u.nombre }))
              )}
              {field('Código del medidor', 'codigo', 'text', true, meterCodeMaxLength)}
              {field('Nombre del medidor', 'nombre_medidor', 'text', true, meterNameMaxLength)}
            </>
          )}
          {!quickPart && ['units', 'types', 'parts', 'meters'].includes(editor.kind) && (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={!!editor.draft.estado}
                onChange={e =>
                  setEditor(old =>
                    old ? { ...old, draft: { ...old.draft, estado: e.target.checked } } : old
                  )
                }
              />
              Activo
            </label>
          )}
          {editor.kind === 'readings' && (
            <ReadingFields
              data={data}
              draft={editor.draft}
              editing={!!editor.id}
              customized={!!editor.id || !!editor.readingCustomized}
              meterName={meterName}
              onChange={(key, value) =>
                setEditor(old =>
                  old
                    ? {
                        ...old,
                        readingCustomized: old.readingCustomized || key === 'observacion',
                        draft: { ...old.draft, [key]: value },
                      }
                    : old
                )
              }
            />
          )}
          {editor.kind === 'plans' && (
            <>
              {select(
                'Activo incluido',
                'id_activo',
                activeAssets.map(a => ({ id: a.id_activo, name: assetName(a.id_activo) }))
              )}
              {select(
                'Tipo de mantenimiento',
                'id_tima',
                data.types.filter(t => t.estado).map(t => ({ id: t.id_tima, name: t.nombre }))
              )}
              <div>
                <label className="block text-sm font-medium">
                  Nombre del plan
                  <input
                    required
                    maxLength={150}
                    className={styles.input + ' mt-1'}
                    value={planText('nombre_plan')}
                    onChange={e => changePlanText('nombre_plan', e.target.value)}
                  />
                </label>
                {suggestionButton('nombre_plan')}
              </div>
              {field('Fecha inicial', 'fecha_inicio', 'date')}
              {field('Fecha final', 'fecha_fin', 'date', false)}
              <div>
                <label className="block text-sm font-medium">
                  Observación
                  <textarea
                    rows={3}
                    maxLength={5000}
                    className={styles.input + ' mt-1'}
                    value={planText('observacion')}
                    onChange={e => changePlanText('observacion', e.target.value)}
                  />
                </label>
                {suggestionButton('observacion')}
              </div>
              {select('Vencimiento del plan', 'condicion', [
                { id: 'OR', name: 'Cuando venza cualquiera de las reglas (OR)' },
                { id: 'AND', name: 'Cuando venzan todas las reglas (AND)' },
              ])}
              <h3 className="font-semibold">Reglas</h3>
              {editor.rules.map((rule, i) => {
                const unit = data.units.find(u => u.id_um === rule.id_um),
                  meter = unit?.tipo_control === 'MEDIDOR';
                return (
                  <div key={i} className="space-y-3 rounded-lg border p-4">
                    <div className="flex justify-between">
                      <b>Regla {i + 1}</b>
                      {editor.rules.length > 1 && (
                        <button
                          type="button"
                          onClick={() =>
                            setEditor(old =>
                              old ? { ...old, rules: old.rules.filter((_, j) => j !== i) } : old
                            )
                          }
                        >
                          Quitar
                        </button>
                      )}
                    </div>
                    <label className="block text-sm">
                      Unidad
                      <select
                        required
                        className={styles.input}
                        value={rule.id_um}
                        onChange={e => {
                          const next = data.units.find(u => u.id_um === e.target.value);
                          ruleField(i, {
                            id_um: e.target.value,
                            id_medidor: null,
                            valor_base: next?.tipo_control === 'MEDIDOR' ? '0' : null,
                          });
                        }}
                      >
                        <option value="">Seleccionar</option>
                        {data.units
                          .filter(u => u.estado)
                          .map(u => (
                            <option key={u.id_um} value={u.id_um}>
                              {u.nombre}
                            </option>
                          ))}
                      </select>
                    </label>
                    {meter && (
                      <>
                        <label className="block text-sm">
                          Medidor
                          <select
                            required
                            value={rule.id_medidor ?? ''}
                            className={styles.input}
                            onChange={e => ruleField(i, { id_medidor: e.target.value })}
                          >
                            <option value="">Seleccionar</option>
                            {data.meters
                              .filter(
                                m =>
                                  m.estado &&
                                  m.id_activo === editor.draft.id_activo &&
                                  m.id_um === rule.id_um
                              )
                              .map(m => (
                                <option key={m.id_medidor} value={m.id_medidor}>
                                  {m.nombre_medidor}
                                </option>
                              ))}
                          </select>
                        </label>
                        <label className="block text-sm">
                          Base inicial
                          <input
                            required
                            type="number"
                            min="0"
                            step="0.01"
                            className={styles.input}
                            value={rule.valor_base ?? ''}
                            onChange={e => ruleField(i, { valor_base: e.target.value })}
                          />
                        </label>
                      </>
                    )}
                    <label className="block text-sm">
                      Frecuencia
                      <input
                        required
                        type="number"
                        min={meter ? '0.01' : '1'}
                        step={meter ? '0.01' : '1'}
                        className={styles.input}
                        value={rule.frecuencia}
                        onChange={e => ruleField(i, { frecuencia: e.target.value })}
                      />
                    </label>
                    <label className="block text-sm">
                      Anticipación de alerta ({meter ? unit?.nombre : 'días'})
                      <input
                        required
                        type="number"
                        min="0"
                        step="0.01"
                        className={styles.input}
                        value={rule.alerta_antes}
                        onChange={e => ruleField(i, { alerta_antes: e.target.value })}
                      />
                    </label>
                  </div>
                );
              })}
              <button
                type="button"
                disabled={editor.rules.length >= 100}
                onClick={() =>
                  setEditor(old =>
                    old
                      ? {
                          ...old,
                          rules: [
                            ...old.rules,
                            {
                              id_um: '',
                              id_medidor: null,
                              frecuencia: '',
                              valor_base: null,
                              alerta_antes: '0',
                            },
                          ],
                        }
                      : old
                  )
                }
                className="text-blue-700"
              >
                + Añadir regla
              </button>
            </>
          )}
          {editor.kind === 'orders' && (
            <>
              {select(
                'Plan activo',
                'id_plan',
                data.plans
                  .filter(
                    p =>
                      p.estado === 'ACTIVO' && activeAssets.some(a => a.id_activo === p.id_activo)
                  )
                  .map(p => ({ id: p.id_plan, name: planName(p.id_plan) }))
              )}
              {field('Fecha programada', 'fecha_programada', 'date', false)}
              {orderMeters.length > 0 && (
                <div id={orderReadingId} className="grid gap-2">
                  {orderMeters.map(meter => (
                    <ReadingReference
                      key={meter.id}
                      reading={orderReadings.get(meter.id)}
                      unit={meter.unit}
                      meter={
                        orderMeters.length > 1
                          ? (data.meters.find(item => item.id_medidor === meter.id)
                              ?.nombre_medidor ?? `Medidor #${meter.id}`)
                          : undefined
                      }
                    />
                  ))}
                </div>
              )}
              <label className="block text-sm font-medium">
                Lectura programada
                <span className="mt-1 flex items-center gap-2">
                  <input
                    className={styles.input}
                    type="number"
                    min="0"
                    step="0.01"
                    aria-describedby={
                      [
                        orderMeters.length && orderReadingId,
                        (newOrder?.unit || newOrder?.unitHint) && orderUnitHintId,
                      ]
                        .filter(Boolean)
                        .join(' ') || undefined
                    }
                    value={String(editor.draft.valor_programado ?? '')}
                    onChange={event => {
                      const value = event.target.value;
                      setEditor(
                        old =>
                          old && {
                            ...old,
                            draft: { ...old.draft, valor_programado: value },
                          }
                      );
                    }}
                  />
                  {newOrder?.unit && (
                    <span id={orderUnitHintId} className="sm-status sm-status-neutral">
                      {newOrder.unit}
                    </span>
                  )}
                </span>
              </label>
              {newOrder?.unitHint && (
                <p id={orderUnitHintId} className="text-sm text-slate-600">
                  {newOrder.unitHint}
                </p>
              )}
              {descriptionField('Descripción de la orden')}
            </>
          )}
          {editor.kind === 'complete' && (
            <>
              {field('Fecha y hora de ejecución', 'fecha_realizada', 'datetime-local')}
              {currentOrder?.valor_programado != null && (
                <div id={scheduledReadingId} className="rounded-lg bg-slate-50 p-3 text-sm">
                  <strong className="block">Lectura programada</strong>
                  <p>
                    {formatReadingValue(currentOrder.valor_programado)} {serviceUnit}
                  </p>
                </div>
              )}
              {completionMeterId && (
                <ReadingReference
                  id={serviceReadingId}
                  reading={latestServiceReading}
                  unit={serviceUnit}
                />
              )}
              {completionMeters.size > 0 && (
                <label className="block text-sm font-medium">
                  Lectura del servicio
                  <span className="mt-1 flex items-center gap-2">
                    <input
                      className={styles.input}
                      type="number"
                      min="0"
                      step="0.01"
                      required
                      aria-describedby={
                        [
                          currentOrder?.valor_programado != null && scheduledReadingId,
                          completionMeterId && serviceReadingId,
                        ]
                          .filter(Boolean)
                          .join(' ') || undefined
                      }
                      value={String(editor.draft.valor_realizado ?? '')}
                      onChange={event => {
                        const value = event.target.value;
                        setEditor(
                          old =>
                            old && {
                              ...old,
                              draft: { ...old.draft, valor_realizado: value },
                            }
                        );
                      }}
                    />
                    {serviceUnit && (
                      <span className="sm-status sm-status-neutral">{serviceUnit}</span>
                    )}
                  </span>
                </label>
              )}
              {descriptionField('Observación')}
              <h3 className="font-semibold">Repuestos utilizados</h3>
              {editor.details.map((detail, i) => (
                <div key={i} className="grid grid-cols-2 gap-3 rounded-lg border p-3">
                  <div className="col-span-2 flex items-end gap-2">
                    <label className="min-w-0 flex-1 text-sm">
                      Repuesto
                      <select
                        required
                        className={styles.input}
                        value={detail.id_repu}
                        onChange={e => {
                          const part = data.parts.find(p => p.id_repu === e.target.value);
                          setEditor(old =>
                            old
                              ? {
                                  ...old,
                                  details: old.details.map((d, j) =>
                                    j === i
                                      ? {
                                          ...d,
                                          id_repu: e.target.value,
                                          costo_unitario: part?.costo_referencia ?? '0',
                                        }
                                      : d
                                  ),
                                }
                              : old
                          );
                        }}
                      >
                        <option value="">Seleccionar</option>
                        {data.parts
                          .filter(p => p.estado)
                          .map(p => (
                            <option key={p.id_repu} value={p.id_repu}>
                              {p.nombre}
                            </option>
                          ))}
                      </select>
                    </label>
                    {onQuickPart && (
                      <button
                        type="button"
                        className="sm-record-action"
                        aria-label="Crear repuesto"
                        title="Crear repuesto"
                        onClick={() => onQuickPart(i)}
                      >
                        <Plus size={17} aria-hidden />
                      </button>
                    )}
                  </div>
                  {(['cantidad', 'costo_unitario'] as const).map(key => (
                    <label key={key} className="text-sm">
                      {key === 'cantidad' ? 'Cantidad' : 'Costo unitario'}
                      <input
                        required
                        type="number"
                        min={key === 'cantidad' ? '0.01' : '0'}
                        step="0.01"
                        className={styles.input}
                        value={detail[key]}
                        onChange={e =>
                          setEditor(old =>
                            old
                              ? {
                                  ...old,
                                  details: old.details.map((d, j) =>
                                    i === j ? { ...d, [key]: e.target.value } : d
                                  ),
                                }
                              : old
                          )
                        }
                      />
                    </label>
                  ))}
                  <button
                    type="button"
                    onClick={() =>
                      setEditor(old =>
                        old ? { ...old, details: old.details.filter((_, j) => j !== i) } : old
                      )
                    }
                    className="text-left text-sm text-red-700"
                  >
                    Quitar
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() =>
                  setEditor(old =>
                    old
                      ? {
                          ...old,
                          details: [
                            ...old.details,
                            { id_repu: '', cantidad: '1', costo_unitario: '0' },
                          ],
                        }
                      : old
                  )
                }
                className="text-blue-700"
              >
                + Añadir repuesto
              </button>
              <p className="text-right font-bold">
                Total:{' '}
                {(() => {
                  try {
                    return decimal(
                      editor.details.reduce(
                        (total, d) => total + cents(subtotal(d.cantidad, d.costo_unitario)),
                        0n
                      )
                    );
                  } catch {
                    return '—';
                  }
                })()}
              </p>
            </>
          )}
          {formError && <Notice kind="error">{formError}</Notice>}
          <div className="sm-modal-actions">
            <button type="button" className="sm-secondary" onClick={() => setEditor(null)}>
              Cerrar
            </button>
            <button type="submit" disabled={busy} className={styles.button}>
              {busy ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </fieldset>
      </form>
    </Modal>
  );
}
