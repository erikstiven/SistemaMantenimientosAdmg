import type { FormEvent, Dispatch, SetStateAction } from 'react';
import { cents, decimal, subtotal, type RelationalData } from '../../../shared/relational';
import { styles } from '../../components/styles';
import { Modal } from '../../components/Modal';
import { Notice } from '../../components/Feedback';
import { moduleInfo, titles, type ModuleKey } from './relational-labels';
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
}: Props) {
  const activeAssets = data.assets.filter(a => a.act_usa_mant === 'S');
  const currentOrder =
    editor?.kind === 'complete' ? data?.orders.find(o => o.id_ordm === editor.id) : undefined;
  const currentPlan = data?.plans.find(p => p.id_plan === currentOrder?.id_plan);
  const completionMeters =
    data?.rules
      .filter(r => r.id_plan === currentPlan?.id_plan && r.estado && r.id_medidor)
      .map(r => r.id_medidor!) ?? [];
  function field(label: string, key: string, type = 'text', required = true) {
    return (
      <label className="block text-sm font-medium">
        {label}
        <input
          required={required}
          type={type}
          step={type === 'number' ? '0.01' : type === 'datetime-local' ? '1' : undefined}
          min={type === 'number' ? '0' : undefined}
          className={styles.input + ' mt-1'}
          value={String(editor?.draft[key] ?? '')}
          onChange={event =>
            setEditor(old =>
              old ? { ...old, draft: { ...old.draft, [key]: event.target.value } } : old
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
    let path = '/' + editor.kind,
      method = editor.id ? 'PUT' : 'POST';
    if (editor.kind === 'plans') {
      draft.fecha_fin = draft.fecha_fin || null;
      path = editor.id ? `/plans/${editor.id}/replace` : '/plans';
      method = 'POST';
    } else if (editor.id && editor.kind !== 'complete') path += '/' + editor.id;
    if (editor.kind === 'orders') {
      draft.fecha_programada = draft.fecha_programada || null;
      draft.valor_programado = draft.valor_programado || null;
    }
    if (editor.kind === 'complete') {
      path = `/orders/${editor.id}/complete`;
      method = 'POST';
      draft.valor_realizado = completionMeters.length ? draft.valor_realizado : null;
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
    <Modal labelledBy="relational-editor-title" onClose={() => !busy && setEditor(null)}>
      <form onSubmit={submit} className="sm-modal-content space-y-4">
        <div className="flex justify-between">
          <h2 id="relational-editor-title">
            {editor.kind === 'complete'
              ? 'Completar servicio'
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
              {field('Código del medidor', 'codigo')}
              {field('Nombre del medidor', 'nombre_medidor')}
            </>
          )}
          {['units', 'types', 'parts', 'meters'].includes(editor.kind) && (
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
            <>
              {select(
                'Medidor',
                'id_medidor',
                data.meters
                  .filter(m => m.estado && activeAssets.some(a => a.id_activo === m.id_activo))
                  .map(m => ({ id: m.id_medidor, name: meterName(m.id_medidor) }))
              )}
              {field('Fecha y hora', 'fecha_lectura', 'datetime-local')}
              {field('Valor acumulado', 'valor', 'number')}
              {field('Observación', 'observacion', 'text', false)}
            </>
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
              {field('Nombre del plan', 'nombre_plan')}
              {field('Fecha inicial', 'fecha_inicio', 'date')}
              {field('Fecha final', 'fecha_fin', 'date', false)}
              {field('Observación', 'observacion', 'text', false)}
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
              {field('Lectura programada', 'valor_programado', 'number', false)}
              {field('Observación', 'observacion', 'text', false)}
            </>
          )}
          {editor.kind === 'complete' && (
            <>
              <p className="rounded-lg bg-blue-50 p-3 text-sm">
                {currentPlan?.nombre_plan} · {currentPlan && assetName(currentPlan.id_activo)}
              </p>
              {field('Fecha y hora de ejecución', 'fecha_realizada', 'datetime-local')}
              {completionMeters.length > 0 &&
                field('Lectura del servicio', 'valor_realizado', 'number')}
              {field('Observación', 'observacion', 'text', false)}
              <h3 className="font-semibold">Repuestos utilizados</h3>
              {editor.details.map((detail, i) => (
                <div key={i} className="grid grid-cols-2 gap-3 rounded-lg border p-3">
                  <label className="col-span-2 text-sm">
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
