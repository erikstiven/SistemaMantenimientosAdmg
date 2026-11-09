import {
  Activity,
  ArrowUpRight,
  Bell,
  Boxes,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Gauge,
  LogOut,
  Plus,
  RefreshCw,
  Search,
  TriangleAlert,
} from 'lucide-react';
import { Workspace, Brand } from '../../components/Workspace';
import { EmptyState, Loading, Notice } from '../../components/Feedback';
import { Modal } from '../../components/Modal';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { User } from '../../../shared/state';
import { cents, decimal, type RelationalData } from '../../../shared/relational';
import { businessDay, evaluatePlan } from '../../../shared/maintenance-evaluation';
import { api, ApiError, request } from '../../services/api';
import { LoginPage } from '../auth/pages/LoginPage';
import { styles } from '../../components/styles';
import { moduleInfo, navigation, operations, labels, type ModuleKey } from './relational-labels';
import { Table, Status } from './components/RelationalTable';
import { RelationalEditor, type Draft, type Editor } from './RelationalEditor';
export default function RelationalApp() {
  const [user, setUser] = useState<User | null>(null),
    [checking, setChecking] = useState(true),
    [data, setData] = useState<RelationalData | null>(null);
  const [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [tab, setTab] = useState<ModuleKey>('dashboard'),
    [search, setSearch] = useState('');
  const [editor, setEditor] = useState<Editor | null>(null),
    [formError, setFormError] = useState(''),
    [day, setDay] = useState(businessDay());
  const [success, setSuccess] = useState('');
  const [alertFilter, setAlertFilter] = useState('all');
  const [confirmCancel, setConfirmCancel] = useState<string | null>(null);
  const generation = useRef(0);
  const load = useCallback(async () => {
    const run = generation.current;
    const result = await request<RelationalData>('/maintenance/bootstrap');
    if (run === generation.current) setData(result);
  }, []);
  const identify = useCallback(async () => {
    setChecking(true);
    setError('');
    try {
      const identity = await api.me();
      setUser(identity);
      await load();
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setUser(null);
        setData(null);
      } else setError(err instanceof Error ? err.message : 'No se pudieron cargar los datos');
    } finally {
      setChecking(false);
    }
  }, [load]);
  useEffect(() => {
    void identify();
  }, [identify]);
  async function refresh() {
    setBusy(true);
    setSuccess('');
    try {
      setUser(await api.me());
      await load();
      setError('');
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setData(null);
        setUser(null);
      } else setError(err instanceof Error ? err.message : 'No se pudieron actualizar los datos');
    } finally {
      setBusy(false);
    }
  }
  async function mutate(path: string, body: unknown, method = 'POST') {
    if (!data) return;
    setBusy(true);
    setFormError('');
    setSuccess('');
    try {
      await request('/maintenance' + path, {
        method,
        body: JSON.stringify({ revision: data.revision, data: body }),
      });
      setEditor(null);
      try {
        await load();
        setError('');
        setSuccess('Cambios guardados correctamente.');
      } catch (err) {
        setError(
          'La operación se guardó, pero falta recargar: ' +
            (err instanceof Error ? err.message : 'error de conexión')
        );
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'No se pudo guardar';
      if (editor) setFormError(message);
      else setError(message);
    } finally {
      setBusy(false);
    }
  }
  if (checking)
    return (
      <main className="sm-standalone">
        <Brand />
        <Loading>Comprobando sesión…</Loading>
      </main>
    );
  if (!user) return <LoginPage onLogin={() => void identify()} />;
  const edit = user.role !== 'viewer',
    admin = user.role === 'admin';
  function open(kind: string, record?: Record<string, unknown>, id?: string) {
    const defaults: Record<string, Draft> = {
      units: { codigo: '', nombre: '', tipo_control: 'MEDIDOR', estado: true },
      types: { nombre: '', descripcion: '', estado: true },
      parts: {
        codigo: '',
        nombre: '',
        unidad_medida: 'Unidad',
        costo_referencia: '0',
        estado: true,
      },
      meters: { id_activo: '', id_um: '', codigo: '', nombre_medidor: '', estado: true },
      readings: {
        id_medidor: '',
        fecha_lectura: businessDay() + 'T09:00',
        valor: '',
        observacion: '',
      },
      plans: {
        id_activo: '',
        id_tima: '',
        nombre_plan: '',
        fecha_inicio: businessDay(),
        fecha_fin: '',
        observacion: '',
        condicion: 'OR',
      },
      orders: {
        id_plan: '',
        fecha_programada: businessDay(),
        valor_programado: '',
        observacion: '',
      },
      complete: { fecha_realizada: businessDay() + 'T09:00', valor_realizado: '', observacion: '' },
    };
    const draft = { ...defaults[kind] };
    if (record)
      for (const key of Object.keys(draft))
        if (record[key] != null) draft[key] = record[key] as string | boolean;
    const rules =
      kind === 'plans' && id && data
        ? data.rules
            .filter(r => r.id_plan === id && r.estado)
            .sort((a, b) => a.orden_eval - b.orden_eval)
            .map(({ id_um, id_medidor, frecuencia, valor_base, alerta_antes, condicion }) => {
              draft.condicion = condicion;
              return { id_um, id_medidor, frecuencia, valor_base, alerta_antes };
            })
        : [];
    if (kind === 'plans' && id) {
      draft.fecha_inicio = businessDay();
      draft.fecha_fin = '';
    }
    setEditor({
      kind,
      id,
      draft,
      rules: rules.length
        ? rules
        : [{ id_um: '', id_medidor: null, frecuencia: '', valor_base: null, alerta_antes: '0' }],
      details: [],
    });
    setFormError('');
  }
  const assetName = (id: string) => {
    const asset = data?.assets.find(a => a.id_activo === id);
    return asset ? `${asset.clave ? asset.clave + ' · ' : ''}${asset.nombre}` : `Activo ${id}`;
  };
  const unitName = (id: string) => data?.units.find(u => u.id_um === id)?.nombre ?? id;
  const meterName = (id: string) => {
    const m = data?.meters.find(m => m.id_medidor === id);
    return m ? `${assetName(m.id_activo)} · ${m.nombre_medidor}` : id;
  };
  const planName = (id: string) => {
    const p = data?.plans.find(p => p.id_plan === id);
    return p ? `${assetName(p.id_activo)} · ${p.nombre_plan}` : id;
  };
  const matches = (...values: unknown[]) =>
    values.join(' ').toLocaleLowerCase().includes(search.trim().toLocaleLowerCase());
  const button = (label: string, action: () => void, disabled = false) => (
    <button
      type="button"
      disabled={busy || !!error || disabled}
      onClick={action}
      className={
        label === 'Cancelar' || label === 'Desactivar' ? 'sm-link sm-link-danger' : 'sm-link'
      }
    >
      {label}
    </button>
  );
  const activeAssets = data?.assets.filter(a => a.act_usa_mant === 'S') ?? [];
  const evaluations = data?.plans.map(p => ({ plan: p, ...evaluatePlan(data, p, day) })) ?? [];

  const [title, description, PageIcon, createLabel] = moduleInfo[tab];
  const calendarTab = ['dashboard', 'plans', 'alerts'].includes(tab);
  const attention = ['VENCIDO', 'PROXIMO', 'SIN_LECTURA', 'CONFIGURACION_INVALIDA'];
  const alerts = evaluations.filter(e => attention.includes(e.status));
  const visibleAlerts = alerts.filter(e => alertFilter === 'all' || e.status === alertFilter);
  function navigate(key: ModuleKey) {
    setTab(key);
    setSearch('');
    setSuccess('');
    setAlertFilter('all');
  }
  async function logout() {
    setBusy(true);
    try {
      await api.logout();
      generation.current++;
      setUser(null);
      setData(null);
      setEditor(null);
      setError('');
      setSuccess('');
      navigate('dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cerrar la sesión');
    } finally {
      setBusy(false);
    }
  }
  return (
    <Workspace
      links={navigation}
      current={tab}
      onNavigate={key => navigate(key as ModuleKey)}
      context={
        <>
          <span className="sm-connection">
            <span />
            {user.connectionLabel || 'Conexión ERP'}
          </span>
          <small>
            Empresa {user.companyId} ·{' '}
            {user.assetScope === 'company' ? 'Todas las sucursales' : 'Sucursal ' + user.branchId}
          </small>
        </>
      }
      actions={
        <>
          <div className="sm-user">
            <span className="sm-avatar" aria-hidden>
              {user.username.slice(0, 2).toUpperCase()}
            </span>
            <div>
              <strong>{user.username}</strong>
              <small>{admin ? 'Administrador' : edit ? 'Operador' : 'Consulta'}</small>
            </div>
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={() => void logout()}
            className="sm-secondary sm-icon-button"
            aria-label="Cerrar sesión"
            title="Cerrar sesión"
          >
            <LogOut size={17} aria-hidden />
          </button>
        </>
      }
      overlay={
        <>
          {editor && data && (
            <RelationalEditor
              editor={editor}
              data={data}
              busy={busy}
              formError={formError}
              setEditor={setEditor}
              mutate={mutate}
              assetName={assetName}
              meterName={meterName}
              planName={planName}
            />
          )}
          {confirmCancel && (
            <Modal labelledBy="cancel-order-title" onClose={() => setConfirmCancel(null)}>
              <div className="sm-modal-content">
                <h2 id="cancel-order-title">Cancelar orden</h2>
                <p>La orden #{confirmCancel} quedará cancelada en el historial.</p>
                <div className="sm-modal-actions">
                  <button
                    type="button"
                    autoFocus
                    className="sm-secondary"
                    onClick={() => setConfirmCancel(null)}
                  >
                    Volver
                  </button>
                  <button
                    type="button"
                    className="sm-danger"
                    onClick={() => {
                      setConfirmCancel(null);
                      void mutate('/orders/' + confirmCancel + '/cancel', {});
                    }}
                  >
                    Cancelar orden
                  </button>
                </div>
              </div>
            </Modal>
          )}
        </>
      }
    >
      <div className="sm-page-header">
        <div className="sm-page-title">
          <span className="sm-module-icon">
            <PageIcon size={23} aria-hidden />
          </span>
          <div>
            <h1>{title}</h1>
            <p>{description}</p>
          </div>
        </div>
        <div className="sm-page-actions">
          <button
            type="button"
            disabled={busy}
            onClick={() => void refresh()}
            className="sm-secondary"
          >
            <RefreshCw size={16} aria-hidden />
            {busy && !editor ? 'Procesando…' : 'Actualizar'}
          </button>
          {data && edit && createLabel && (!['units', 'types'].includes(tab) || admin) && (
            <button
              type="button"
              disabled={busy || !!error}
              className={styles.button}
              onClick={() => open(tab)}
            >
              <Plus size={17} aria-hidden />
              {createLabel}
            </button>
          )}
        </div>
      </div>
      {error && <Notice kind="error">{error}</Notice>}
      {success && <Notice kind="success">{success}</Notice>}
      {data?.warnings.map(warning => (
        <Notice key={warning} kind="warning">
          {warning}
        </Notice>
      ))}
      {!data && !error && <Loading>Cargando mantenimiento…</Loading>}
      {data && (
        <>
          <div className="sm-toolbar">
            {calendarTab ? (
              <label className="sm-date">
                <CalendarDays size={17} aria-hidden /> Evaluar al
                <input
                  type="date"
                  required
                  value={day}
                  onChange={e => setDay(e.target.value || businessDay())}
                  className={styles.input}
                />
              </label>
            ) : (
              <label className="sm-search">
                <Search size={17} aria-hidden />
                <input
                  type="search"
                  aria-label="Buscar registros"
                  placeholder="Buscar en este módulo…"
                  className={styles.input}
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </label>
            )}
            {tab === 'alerts' && (
              <label className="sm-date">
                Estado{' '}
                <select
                  className={styles.input}
                  value={alertFilter}
                  onChange={e => setAlertFilter(e.target.value)}
                >
                  <option value="all">Todas las alertas</option>
                  {attention.map(status => (
                    <option value={status} key={status}>
                      {labels[status]}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {tab === 'meters' && edit && (
              <button
                type="button"
                className="sm-secondary"
                disabled={busy || !!error}
                onClick={() => open('readings')}
              >
                <Plus size={16} aria-hidden />
                Registrar lectura
              </button>
            )}
          </div>
          {tab === 'dashboard' && (
            <>
              <section className="sm-hero">
                <div className="sm-hero-copy">
                  <p>
                    <Activity size={15} aria-hidden /> CONTROL OPERATIVO
                  </p>
                  <h2>El mantenimiento, al día</h2>
                  <p>Revisa los próximos vencimientos y prioriza los servicios de tus equipos.</p>
                  <button
                    type="button"
                    onClick={() => navigate('alerts')}
                    className="sm-hero-button"
                  >
                    Ver alertas <ArrowUpRight size={16} aria-hidden />
                  </button>
                </div>
                <div className="sm-hero-visual" aria-hidden="true">
                  <Gauge />
                </div>
              </section>
              <div className="sm-kpis">
                {(
                  [
                    ['Activos incluidos', activeAssets.length, Boxes, 'assets', 'blue', 'all'],
                    [
                      'Planes próximos',
                      alerts.filter(e => e.status === 'PROXIMO').length,
                      Bell,
                      'alerts',
                      'amber',
                      'PROXIMO',
                    ],
                    [
                      'Planes vencidos',
                      alerts.filter(e => e.status === 'VENCIDO').length,
                      TriangleAlert,
                      'alerts',
                      'red',
                      'VENCIDO',
                    ],
                    [
                      'Órdenes pendientes',
                      data.orders.filter(o => o.estado === 'PENDIENTE').length,
                      ClipboardList,
                      'orders',
                      'blue',
                      'all',
                    ],
                    [
                      'Servicios realizados',
                      data.orders.filter(o => o.estado === 'REALIZADA').length,
                      CheckCircle2,
                      'orders',
                      'green',
                      'all',
                    ],
                  ] as const
                ).map(([label, value, Icon, destination, tone, filter]) => (
                  <button
                    type="button"
                    key={label}
                    className={'sm-kpi sm-card'}
                    onClick={() => {
                      navigate(destination);
                      setAlertFilter(filter);
                    }}
                  >
                    <span className={'sm-kpi-icon sm-kpi-' + tone}>
                      <Icon size={19} aria-hidden />
                    </span>
                    <ArrowUpRight className="sm-kpi-arrow" size={16} aria-hidden />
                    <strong>{value}</strong>
                    <span>{label}</span>
                  </button>
                ))}
              </div>
              <Table
                title="Seguimiento de planes"
                headers={['Activo / Plan', 'Estado', 'Próximas metas']}
                rows={evaluations.map(e => [
                  <strong>{planName(e.plan.id_plan)}</strong>,
                  <Status value={e.status} />,
                  e.rules.length
                    ? e.rules.map(r => (
                        <p key={r.id}>
                          {r.target} {r.unit} · {r.remaining}
                        </p>
                      ))
                    : '—',
                ])}
              />
            </>
          )}
          {tab === 'alerts' && (
            <section className="sm-card">
              <div className="sm-section-heading">
                <h2>Planes que requieren atención</h2>
                <span>
                  {visibleAlerts.length} {visibleAlerts.length === 1 ? 'alerta' : 'alertas'}
                </span>
              </div>
              {visibleAlerts.length ? (
                <ul className="sm-alert-list">
                  {[...visibleAlerts]
                    .sort((a, b) => attention.indexOf(a.status) - attention.indexOf(b.status))
                    .map(e => (
                      <li key={e.plan.id_plan}>
                        <div>
                          <strong>{planName(e.plan.id_plan)}</strong>
                          {e.rules.map(r => (
                            <p key={r.id}>{r.remaining}</p>
                          ))}
                        </div>
                        <Status value={e.status} />
                      </li>
                    ))}
                </ul>
              ) : (
                <EmptyState title="Sin alertas para esta vista">
                  Puedes cambiar la fecha o el filtro de estado.
                </EmptyState>
              )}
            </section>
          )}
          {tab === 'assets' && (
            <>
              <p className="text-sm text-slate-600">
                Los activos se administran y se incluyen en mantenimiento desde el ERP. Aquí solo se
                consultan los incluidos.
              </p>
              <Table
                title="Equipos incluidos"
                filtered={!!search.trim()}
                headers={[
                  'Código interno',
                  'Referencia ERP',
                  'Activo',
                  'Tipo',
                  'Empresa / Sucursal',
                ]}
                rows={activeAssets
                  .filter(a => matches(a.act_cod_act, a.clave, a.nombre))
                  .map(a => [
                    a.act_cod_act,
                    a.clave || '—',
                    a.nombre,
                    a.tipo,
                    `${a.empresa_id} / ${a.sucursal_id}`,
                  ])}
              />
            </>
          )}
          {tab === 'units' && (
            <Table
              title="Catálogo de unidades"
              filtered={!!search.trim()}
              headers={['Código', 'Nombre', 'Control', 'Estado', 'Acciones']}
              rows={data.units
                .filter(u => matches(u.codigo, u.nombre))
                .map(u => [
                  u.codigo,
                  u.nombre,
                  u.tipo_control,
                  <Status value={u.estado ? 'ACTIVO' : 'INACTIVO'} />,
                  admin && button('Editar', () => open('units', u, u.id_um)),
                ])}
            />
          )}
          {tab === 'types' && (
            <Table
              title="Catálogo de servicios"
              filtered={!!search.trim()}
              headers={['Nombre', 'Descripción', 'Estado', 'Acciones']}
              rows={data.types
                .filter(t => matches(t.nombre, t.descripcion))
                .map(t => [
                  t.nombre,
                  t.descripcion,
                  <Status value={t.estado ? 'ACTIVO' : 'INACTIVO'} />,
                  admin && button('Editar', () => open('types', t, t.id_tima)),
                ])}
            />
          )}
          {tab === 'parts' && (
            <Table
              title="Catálogo de repuestos"
              filtered={!!search.trim()}
              headers={[
                'Código',
                'Repuesto',
                'Unidad',
                'Costo de referencia',
                'Estado',
                'Acciones',
              ]}
              rows={data.parts
                .filter(p => matches(p.codigo, p.nombre))
                .map(p => [
                  p.codigo,
                  p.nombre,
                  p.unidad_medida,
                  p.costo_referencia,
                  <Status value={p.estado ? 'ACTIVO' : 'INACTIVO'} />,
                  edit && button('Editar', () => open('parts', p, p.id_repu)),
                ])}
            />
          )}

          {tab === 'meters' &&
            (() => {
              const meters = data.meters.filter(m =>
                matches(assetName(m.id_activo), m.codigo, m.nombre_medidor)
              );
              const latestReadings = new Map<string, (typeof data.readings)[number]>();
              for (const reading of data.readings) {
                const previous = latestReadings.get(reading.id_medidor);
                if (!previous || reading.fecha_lectura > previous.fecha_lectura)
                  latestReadings.set(reading.id_medidor, reading);
              }
              return meters.length ? (
                <div className="sm-meter-grid">
                  {meters.map(m => {
                    const latest = latestReadings.get(m.id_medidor);
                    return (
                      <article key={m.id_medidor} className="sm-card sm-meter">
                        <div className="sm-meter-header">
                          <span className="sm-module-icon">
                            <Gauge size={20} aria-hidden />
                          </span>
                          <Status value={m.estado ? 'ACTIVO' : 'INACTIVO'} />
                        </div>
                        <p>{assetName(m.id_activo)}</p>
                        <h2>{m.nombre_medidor}</h2>
                        <p>{m.codigo}</p>
                        <div className="sm-meter-value">
                          <strong>{latest?.valor ?? '—'}</strong> <span>{unitName(m.id_um)}</span>
                        </div>
                        <p>
                          {latest
                            ? latest.fecha_lectura.replace('T', ' ')
                            : 'Sin lecturas registradas'}
                        </p>
                        {edit && (
                          <div className="sm-card-actions">
                            {m.estado &&
                              button('Registrar lectura', () =>
                                open('readings', { id_medidor: m.id_medidor })
                              )}
                            {button('Editar', () => open('meters', m, m.id_medidor))}
                          </div>
                        )}
                      </article>
                    );
                  })}
                </div>
              ) : (
                <section className="sm-card">
                  <EmptyState
                    title={search.trim() ? 'Sin coincidencias' : 'Aún no hay medidores'}
                  />
                </section>
              );
            })()}
          {tab === 'readings' && (
            <>
              <p className="text-sm text-slate-600">
                Las lecturas registradas se conservan. Un cambio de contador requiere un medidor
                nuevo para mantener la trazabilidad.
              </p>
              <Table
                title="Lecturas registradas"
                filtered={!!search.trim()}
                headers={['Medidor', 'Fecha y hora', 'Lectura', 'Observación']}
                rows={data.readings
                  .filter(r => matches(meterName(r.id_medidor), r.observacion))
                  .sort((a, b) => b.fecha_lectura.localeCompare(a.fecha_lectura))
                  .map(r => [
                    meterName(r.id_medidor),
                    r.fecha_lectura.replace('T', ' '),
                    r.valor,
                    r.observacion,
                  ])}
              />
            </>
          )}
          {tab === 'plans' &&
            (evaluations.length ? (
              <div className="sm-plan-grid">
                {evaluations.map(e => (
                  <article key={e.plan.id_plan} className={styles.card + ' space-y-4 p-5'}>
                    <div className="flex justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold text-blue-700">
                          {assetName(e.plan.id_activo)}
                        </p>
                        <h2 className="text-lg font-bold">{e.plan.nombre_plan}</h2>
                      </div>
                      <Status value={e.status} />
                    </div>
                    <p className="text-sm text-slate-500">
                      {data.types.find(type => type.id_tima === e.plan.id_tima)?.nombre ??
                        'Mantenimiento'}
                      {' · Desde '}
                      {e.plan.fecha_inicio}
                      {e.plan.fecha_fin ? ' · Hasta ' + e.plan.fecha_fin : ''}
                    </p>
                    {data.rules
                      .filter(r => r.id_plan === e.plan.id_plan && r.estado)
                      .sort((a, b) => a.orden_eval - b.orden_eval)
                      .map(r => (
                        <div
                          key={r.id_regla}
                          className="rounded-lg bg-slate-50 p-3 text-sm break-words"
                        >
                          <b>
                            {r.orden_eval}. Cada {r.frecuencia} {unitName(r.id_um)}
                            {r.orden_eval > 1
                              ? r.condicion === 'OR'
                                ? ' · Cualquiera'
                                : ' · Todas'
                              : ''}
                          </b>
                          <p>
                            Base inicial: {r.valor_base ?? 'Calendario'} · Alerta: {r.alerta_antes}
                          </p>
                          {r.id_medidor && <p>{meterName(r.id_medidor)}</p>}
                          <p>{e.rules.find(v => v.id === r.id_regla)?.remaining}</p>
                        </div>
                      ))}
                    {edit && (
                      <div>
                        {button(
                          e.plan.estado === 'ACTIVO' ? 'Desactivar' : 'Activar',
                          () =>
                            void mutate(
                              `/plans/${e.plan.id_plan}/state`,
                              { estado: e.plan.estado === 'ACTIVO' ? 'INACTIVO' : 'ACTIVO' },
                              'PUT'
                            )
                        )}
                        {e.plan.estado === 'ACTIVO' &&
                          button('Sustituir estrategia', () =>
                            open('plans', e.plan, e.plan.id_plan)
                          )}
                      </div>
                    )}
                    <p className="text-xs text-slate-500">
                      La base inicial se conserva. El ciclo siguiente parte de la última ejecución
                      realizada.
                    </p>
                  </article>
                ))}
              </div>
            ) : (
              <section className="sm-card">
                <EmptyState title="Aún no hay planes" />
              </section>
            ))}
          {tab === 'orders' && (
            <Table
              title="Órdenes registradas"
              filtered={!!search.trim()}
              headers={[
                'Orden / Plan',
                'Programada',
                'Estado',
                'Ejecución',
                'Repuestos / Total',
                'Acciones',
              ]}
              rows={data.orders
                .filter(o => matches(o.id_ordm, planName(o.id_plan), o.estado))
                .map(o => {
                  const details = data.details.filter(d => d.id_ordm === o.id_ordm);
                  const meters = new Set(
                    data.rules
                      .filter(r => r.id_plan === o.id_plan && r.estado && r.id_medidor)
                      .map(r => r.id_medidor)
                  );
                  return [
                    `#${o.id_ordm} · ${planName(o.id_plan)}`,
                    o.fecha_programada ?? 'Sin fecha',
                    <Status value={o.estado} />,
                    o.fecha_realizada ? (
                      <>
                        {o.fecha_realizada.replace('T', ' ')}
                        <br />
                        Lectura: {o.valor_realizado ?? 'Calendario'}
                        <p>{o.observacion}</p>
                      </>
                    ) : (
                      '—'
                    ),
                    <>
                      {details.map(d => (
                        <p key={d.id_detm}>
                          {data.parts.find(p => p.id_repu === d.id_repu)?.nombre} × {d.cantidad} ·{' '}
                          {d.subtotal}
                        </p>
                      ))}
                      <b>
                        Total: {decimal(details.reduce((sum, d) => sum + cents(d.subtotal), 0n))}
                      </b>
                    </>,
                    edit && o.estado === 'PENDIENTE' && (
                      <>
                        {button(
                          'Completar',
                          () => open('complete', undefined, o.id_ordm),
                          meters.size > 1
                        )}
                        {button('Cancelar', () => setConfirmCancel(o.id_ordm))}
                        {meters.size > 1 && (
                          <p className="text-xs text-red-700">
                            Requiere detalle de ejecución por medidor.
                          </p>
                        )}
                      </>
                    ),
                  ];
                })}
            />
          )}
          {tab === 'audit' && (
            <Table
              title="Operaciones registradas"
              filtered={!!search.trim()}
              headers={['Fecha', 'Operación', 'Registro', 'Usuario']}
              rows={data.audit
                .filter(a => matches(operations[a.operation], a.entity_id))
                .map(a => [
                  a.created_at,
                  operations[a.operation] ?? a.operation,
                  a.entity_id ?? '—',
                  a.user_id,
                ])}
            />
          )}
        </>
      )}
    </Workspace>
  );
}
