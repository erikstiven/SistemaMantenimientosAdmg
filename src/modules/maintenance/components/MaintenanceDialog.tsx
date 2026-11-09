import { styles } from '../../../../src/components/styles';
import { Modal } from '../../../components/Modal';
import { Notice } from '../../../components/Feedback';
import { money } from '../../../../src/utils/format';
import { useMaintenance } from '../context';
export function MaintenanceDialog() {
  const {
    plans,
    orders,
    meters,
    maintTypes,
    appSettings,
    items,
    dialog,
    draft,
    setDraft,
    filter,
    partRows,
    setPartRows,
    message,
    asset,
    close,
    save,
    field,
    sel,
    assetOptions,
    units,
  } = useMaintenance();
  return (
    <>
      {dialog && (
        <Modal labelledBy="demo-editor-title" onClose={close}>
          <div className="sm-modal-content">
            <div className="flex justify-between">
              <h2 id="demo-editor-title">{dialog}</h2>
              <button
                onClick={close}
                className="sm-secondary sm-icon-button"
                aria-label="Cerrar formulario"
              >
                ✕
              </button>
            </div>
            <div className="mt-5 space-y-4">
              {dialog === 'Tipo mantenimiento' && (
                <>
                  {field('Nombre del tipo de mantenimiento', 'name')}
                  {field('Descripción', 'description')}
                </>
              )}
              {dialog === 'Activo' && (
                <>
                  {field('Código', 'code')}
                  {field('Nombre', 'name')}
                  {field('Tipo', 'type')}
                </>
              )}
              {dialog === 'Medidor' && (
                <>
                  {sel('Activo', 'asset', assetOptions)}
                  {sel('Unidad de medición', 'unit', units.slice(0, 2))}
                  {field('Nombre del medidor', 'name')}
                </>
              )}
              {(dialog === 'Lectura' || dialog === 'Plan') && sel('Activo', 'asset', assetOptions)}
              {dialog === 'Lectura' && (
                <>
                  {sel(
                    'Medidor',
                    'meter',
                    meters
                      .filter(m => m.asset === Number(draft.asset))
                      .map(m => ({
                        value: String(m.id),
                        label: m.name + ' (' + m.unit + ')',
                      }))
                  )}
                  {field('Fecha de lectura', 'date', 'date')}
                  {field('Valor de lectura', 'value', 'number')}
                </>
              )}
              {(dialog === 'Plan' || dialog === 'Regla' || dialog === 'Cambiar control') && (
                <>
                  {dialog === 'Plan' &&
                    sel(
                      'Tipo de mantenimiento',
                      'name',
                      maintTypes
                        .filter(t => t.active)
                        .map(t => ({
                          value: t.name,
                          label: t.name,
                        }))
                    )}
                  <label className="block text-sm font-medium text-slate-600">
                    Unidad de control
                    <select
                      className={styles.input + ' mt-1'}
                      value={draft.unit ?? ''}
                      onChange={e => {
                        const u = e.target.value;
                        const defaults =
                          u === 'Horas'
                            ? appSettings.hours
                            : u === 'Kilómetros'
                              ? appSettings.km
                              : u === 'Días'
                                ? appSettings.days
                                : appSettings.months;
                        setDraft(d => ({
                          ...d,
                          unit: u,
                          meter: '',
                          alert: defaults,
                        }));
                      }}
                    >
                      <option value="">Seleccionar unidad</option>
                      {units.map(u => (
                        <option key={u.value} value={u.value}>
                          {u.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  {['Horas', 'Kilómetros'].includes(draft.unit ?? '') &&
                    sel(
                      'Medidor del equipo',
                      'meter',
                      meters
                        .filter(
                          m =>
                            m.asset ===
                              Number(
                                draft.asset || plans.find(p => p.id === Number(draft.plan))?.asset
                              ) && m.unit === draft.unit
                        )
                        .map(m => ({
                          value: String(m.id),
                          label: m.name,
                        }))
                    )}
                  {field('Frecuencia', 'freq', 'number')}
                  {['Horas', 'Kilómetros'].includes(draft.unit ?? '') &&
                    field('Lectura base del ciclo', 'base', 'number')}
                  {field('Alerta anticipada (unidades o días)', 'alert', 'number')}
                  {field('Fecha de referencia', 'startDate', 'date')}
                </>
              )}
              {dialog === 'Orden' && (
                <>
                  {sel(
                    'Plan activo',
                    'plan',
                    plans
                      .filter(p => p.active !== false)
                      .map(p => ({
                        value: String(p.id),
                        label: asset(p.asset) + ' — ' + p.name,
                      }))
                  )}
                  {field('Fecha programada', 'date', 'date')}
                  {field('Observación', 'notes')}
                </>
              )}
              {dialog === 'Completar orden' && (
                <>
                  {(() => {
                    const ord = orders.find(o => o.id === Number(draft.order));
                    const p = plans.find(x => x.id === ord?.plan);
                    return (
                      <>
                        <div className="rounded-lg bg-blue-50 p-3 text-sm">
                          <b>ORD-{draft.order}</b> · {p?.name} · {asset(p?.asset || 0)}
                        </div>
                        {field('Fecha efectiva de ejecución', 'doneAt', 'date')}
                        {p &&
                          ['Horas', 'Kilómetros'].includes(p.unit) &&
                          field('Lectura real al terminar (' + p.unit + ')', 'valueAt', 'number')}
                        {field('Observaciones del servicio', 'notes')}
                        <div className="border-t pt-3">
                          <h3 className="mb-3 font-semibold">Repuestos utilizados</h3>
                          {partRows.map((pr, i) => (
                            <div className="mb-2 flex items-center gap-2" key={i}>
                              <select
                                className={styles.input}
                                value={pr.index}
                                onChange={e =>
                                  setPartRows(rows =>
                                    rows.map((x, k) =>
                                      k === i
                                        ? {
                                            ...x,
                                            index: Number(e.target.value),
                                          }
                                        : x
                                    )
                                  )
                                }
                              >
                                {items.map((it, j) => (
                                  <option key={j} value={j}>
                                    {it.name} · {money(it.price)}
                                  </option>
                                ))}
                              </select>
                              <input
                                type="number"
                                min="1"
                                className={styles.input + ' w-20'}
                                value={pr.quantity}
                                onChange={e =>
                                  setPartRows(rows =>
                                    rows.map((x, k) =>
                                      k === i
                                        ? {
                                            ...x,
                                            quantity: Number(e.target.value),
                                          }
                                        : x
                                    )
                                  )
                                }
                              />
                              <button
                                onClick={() => setPartRows(rows => rows.filter((_, k) => i !== k))}
                              >
                                ✕
                              </button>
                            </div>
                          ))}
                          <button
                            className="text-sm font-semibold text-blue-700"
                            onClick={() =>
                              setPartRows(rows => [
                                ...rows,
                                {
                                  index: 0,
                                  quantity: 1,
                                },
                              ])
                            }
                          >
                            + Añadir repuesto
                          </button>
                          <div className="mt-4 text-right font-bold">
                            Total:{' '}
                            {money(
                              partRows.reduce(
                                (sum, pr) => sum + (items[pr.index]?.price || 0) * pr.quantity,
                                0
                              )
                            )}
                          </div>
                        </div>
                      </>
                    );
                  })()}
                </>
              )}
              {dialog === 'Detalle orden' && (
                <>
                  {(() => {
                    const ord = orders.find(o => o.id === Number(draft.order));
                    return (
                      <>
                        <p className="text-sm">
                          <b>ORD-{ord?.id}</b> · {ord?.status}
                        </p>
                        <p className="text-sm">
                          Fecha: {ord?.doneAt || ord?.date} · Lectura: {ord?.valueAt ?? 'No aplica'}
                        </p>
                        <p className="text-sm">
                          Configuración histórica: {ord?.snapshot || 'No registrada'}
                        </p>
                        <p className="text-sm">
                          Observaciones: {ord?.notes || 'Sin observaciones'}
                        </p>
                        <div className="border-t pt-3">
                          {(ord?.parts || []).map(p => (
                            <div className="flex justify-between text-sm" key={p.index}>
                              <span>
                                {p.name} × {p.quantity}
                              </span>
                              <span>{money(p.price * p.quantity)}</span>
                            </div>
                          ))}
                          <p className="mt-3 text-right font-bold">
                            Total:{' '}
                            {money(
                              (ord?.parts || []).reduce((x, p) => x + p.price * p.quantity, 0)
                            )}
                          </p>
                        </div>
                      </>
                    );
                  })()}
                </>
              )}
              {dialog === 'Repuesto' && (
                <>
                  {field('Nombre', 'name')}
                  {field('Unidad', 'unit')}
                  {field('Costo de referencia USD', 'price', 'number')}
                </>
              )}
              {message && <Notice kind="error">{message}</Notice>}
              <div className="flex justify-end gap-3 border-t pt-4">
                <button className="sm-secondary" onClick={close}>
                  Cerrar
                </button>
                {dialog !== 'Detalle orden' && (
                  <button className={styles.button} onClick={save}>
                    Guardar
                  </button>
                )}
              </div>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
