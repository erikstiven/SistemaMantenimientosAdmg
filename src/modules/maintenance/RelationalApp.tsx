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
import type { ReactNode } from 'react';
import type { User } from '../../../shared/state';
import { cents, decimal, type MaintenanceBootstrap } from '../../../shared/relational';
import {
  businessDay,
  businessTimestamp,
  evaluatePlan,
} from '../../../shared/maintenance-evaluation';
import { defaultPermissions, roleLabels, type Permission } from '../../../shared/permissions';
import { maintenanceHref, useMaintenanceLocation } from './hooks/useMaintenanceLocation';
import { Paginated } from './components/Pagination';
import { formatReadingTimestamp, formatReadingValue, readingUnit } from './reading-format';
import { RolePermissions } from './components/RolePermissions';
import { api, ApiError, request } from '../../services/api';
import { LoginPage } from '../auth/pages/LoginPage';
import { styles } from '../../components/styles';
import { moduleInfo, navigation, operations, labels, type ModuleKey } from './relational-labels';
import { Table, Status } from './components/RelationalTable';
import { RelationalEditor, type Draft, type Editor } from './RelationalEditor';
export default function RelationalApp() {
  const [user, setUser] = useState<User | null>(null),
    [checking, setChecking] = useState(true),
    [data, setData] = useState<MaintenanceBootstrap | null>(null);
  const [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const location = useMaintenanceLocation();
  const { tab, search, day, filter, record, meter, connection } = location;
  const [editor, setEditor] = useState<Editor | null>(null),
    [formError, setFormError] = useState('');
  const [success, setSuccess] = useState('');
  const [confirmCancel, setConfirmCancel] = useState<string | null>(null);
  const [meterPlansModal, setMeterPlansModal] = useState<string | null>(null);
  const generation = useRef(0);
  const load = useCallback(async () => {
    const run = generation.current;
    const result = await request<MaintenanceBootstrap>('/maintenance/bootstrap');
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
  useEffect(() => {
    const close = () => {
      setEditor(null);
      setConfirmCancel(null);
      setSuccess('');
    };
    window.addEventListener('popstate', close);
    return () => window.removeEventListener('popstate', close);
  }, []);
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
  if (!user) return <LoginPage preferredConnection={connection} onLogin={() => void identify()} />;
  const can = (permission: Permission) => !!data?.permissions.includes(permission);
  const canRead = (key: ModuleKey) => can((key + '.read') as Permission);
  const allowed = canRead(tab);
  const correctConnection = !connection || connection === user.connectionId;
  const selectedRole =
    location.view === 'viewer' || location.view === 'admin' ? location.view : 'technician';
  const selectRecord = (id: string) => !record || record === id;
  const pagination = {
    page: location.page,
    onPage: (page: number) => location.change({ pagina: page > 1 ? String(page) : '' }),
  };
  function recordLink(key: ModuleKey, id: string, label: ReactNode) {
    const href = maintenanceHref(key, {
      registro: id,
      conexion: user?.connectionId ?? '',
      ...(key === 'plans' ? { fecha: day } : {}),
    });
    return (
      <a
        href={href}
        className="sm-record-link"
        onClick={event => {
          if (
            event.ctrlKey ||
            event.metaKey ||
            event.shiftKey ||
            event.altKey ||
            event.button !== 0
          )
            return;
          event.preventDefault();
          location.visit(href);
          setSuccess('');
          window.scrollTo(0, 0);
        }}
      >
        {label}
      </a>
    );
  }
  function open(kind: string, record?: Record<string, unknown>, id?: string) {
    const permission =
      kind === 'complete'
        ? 'orders.complete'
        : kind === 'plans' && id
          ? 'plans.replace'
          : kind + (id ? '.update' : '.create');
    if (!can(permission as Permission) || !correctConnection) return;
    const defaults: Record<string, Draft> = {
      assets: {
        act_cod_act: '',
        clave: '',
        nombre: '',
        tipo: '',
        act_usa_mant: 'S',
        act_fcmp_act: '',
      },
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
        fecha_lectura: businessTimestamp(),
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
  const canEvaluate =
    can('plans.read') &&
    can('units.read') &&
    can('meters.read') &&
    can('readings.read') &&
    can('orders.read');
  const evaluations =
    data?.plans.map(plan => ({
      plan,
      ...(canEvaluate ? evaluatePlan(data, plan, day) : { status: plan.estado, rules: [] }),
    })) ?? [];
  const visiblePlans = evaluations.filter(
    e => selectRecord(e.plan.id_plan) && (filter === 'all' || e.status === filter)
  );

  const [title, description, PageIcon, createLabel] = moduleInfo[tab];
  const calendarTab = ['dashboard', 'plans', 'alerts'].includes(tab);
  const attention = ['VENCIDO', 'PROXIMO', 'SIN_LECTURA', 'CONFIGURACION_INVALIDA'];
  const alerts = evaluations.filter(e => attention.includes(e.status));
  const visibleAlerts = alerts.filter(
    e => selectRecord(e.plan.id_plan) && (filter === 'all' || e.status === filter)
  );
  function navigate(key: ModuleKey, params: Record<string, string> = {}) {
    location.visit(maintenanceHref(key, params));
    setEditor(null);
    setConfirmCancel(null);
    setSuccess('');
    window.scrollTo(0, 0);
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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cerrar la sesión');
    } finally {
      setBusy(false);
    }
  }
  return (
    <Workspace
      links={navigation
        .map(group => ({
          ...group,
          links: group.links.filter(link => canRead(link.key as ModuleKey)),
        }))
        .filter(group => group.links.length)}
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
              <small>{roleLabels[user.role]}</small>
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
          {editor && data && allowed && correctConnection && (
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
          {confirmCancel && allowed && correctConnection && can('orders.cancel') && (
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
          {meterPlansModal && data && (
            <Modal labelledBy="meter-plans-title" onClose={() => setMeterPlansModal(null)}>
              <div className="sm-modal-content space-y-4">
                <div className="border-b pb-3">
                  <h2 id="meter-plans-title" className="text-lg font-bold">
                    Planes de mantenimiento asociados
                  </h2>
                  <p className="text-xs text-slate-500">
                    {(() => {
                      const m = data.meters.find(meter => meter.id_medidor === meterPlansModal);
                      return m ? `${assetName(m.id_activo)} · ${m.nombre_medidor}` : '';
                    })()}
                  </p>
                </div>
                {(() => {
                  const associatedPlans = data.plans.filter(p =>
                    data.rules.some(
                      r => r.id_plan === p.id_plan && r.estado && r.id_medidor === meterPlansModal
                    )
                  );
                  if (!associatedPlans.length) {
                    return (
                      <div className="py-6 text-center text-sm text-slate-500">
                        No hay planes de mantenimiento vinculados a este medidor.
                      </div>
                    );
                  }
                  return (
                    <ul className="space-y-3 max-h-[60vh] overflow-y-auto">
                      {associatedPlans.map(p => {
                        const rules = data.rules.filter(
                          r => r.id_plan === p.id_plan && r.estado && r.id_medidor === meterPlansModal
                        );
                        return (
                          <li
                            key={p.id_plan}
                            className="p-3 border rounded-lg bg-slate-50 hover:bg-slate-100 flex items-center justify-between gap-3 transition-colors"
                          >
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <strong className="text-sm font-semibold text-slate-900">
                                  {p.nombre_plan}
                                </strong>
                                <Status value={p.estado} />
                              </div>
                              <p className="text-xs text-slate-500">
                                {data.types.find(t => t.id_tima === p.id_tima)?.nombre ?? 'Mantenimiento'}
                                {' · Desde ' + p.fecha_inicio}
                                {p.fecha_fin ? ' · Hasta ' + p.fecha_fin : ''}
                              </p>
                              <div className="text-xs text-slate-600">
                                {rules.map(r => (
                                  <span key={r.id_regla} className="inline-block mr-2 font-medium">
                                    • Cada {r.frecuencia} {unitName(r.id_um)}
                                  </span>
                                ))}
                              </div>
                            </div>
                            <button
                              type="button"
                              className="sm-link font-semibold text-sm whitespace-nowrap"
                              onClick={() => {
                                const planId = p.id_plan;
                                setMeterPlansModal(null);
                                navigate('plans', {
                                  registro: planId,
                                  conexion: user.connectionId ?? '',
                                });
                              }}
                            >
                              Ver plan →
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  );
                })()}
                <div className="sm-modal-actions">
                  <button
                    type="button"
                    className="sm-secondary"
                    onClick={() => setMeterPlansModal(null)}
                  >
                    Cerrar
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
          {data && correctConnection && createLabel && can((tab + '.create') as Permission) && (
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
      {data && !allowed && (
        <Notice kind="error">
          Tu rol no tiene permiso para consultar este módulo. Elige otro módulo en el menú.
        </Notice>
      )}
      {data && allowed && !correctConnection && (
        <Notice kind="error">
          Este enlace corresponde a otra conexión ERP. Inicia sesión en la conexión del enlace.
        </Notice>
      )}
      {data && allowed && correctConnection && (
        <>
          {record && (
            <div className="sm-toolbar">
              <span className="sm-status sm-status-neutral">Registro #{record}</span>
              <button
                className="sm-secondary"
                type="button"
                onClick={() => location.change({ registro: '', conexion: '', pagina: '' })}
              >
                Ver todos los registros
              </button>
            </div>
          )}
          {tab !== 'roles' && (
            <div className="sm-toolbar">
              {calendarTab ? (
                <label className="sm-date">
                  <CalendarDays size={17} aria-hidden /> Evaluar al
                  <input
                    type="date"
                    required
                    value={day}
                    onChange={e => location.change({ fecha: e.target.value, pagina: '' })}
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
                    onChange={e => location.change({ q: e.target.value, pagina: '' }, true)}
                  />
                </label>
              )}
              {['alerts', 'plans', 'orders'].includes(tab) && (
                <label className="sm-date">
                  Estado{' '}
                  <select
                    className={styles.input}
                    value={filter}
                    onChange={e =>
                      location.change({
                        estado: e.target.value === 'all' ? '' : e.target.value,
                        pagina: '',
                      })
                    }
                  >
                    <option value="all">Todos los estados</option>
                    {(tab === 'orders'
                      ? ['PENDIENTE', 'REALIZADA', 'CANCELADO']
                      : tab === 'plans'
                        ? canEvaluate
                          ? ['AL_DIA', ...attention, 'INACTIVO', 'FUERA_VIGENCIA']
                          : ['ACTIVO', 'INACTIVO']
                        : attention
                    ).map(status => (
                      <option value={status} key={status}>
                        {labels[status]}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {tab === 'readings' && can('meters.read') && (
                <label className="sm-date">
                  Medidor
                  <select
                    className={styles.input}
                    value={meter}
                    onChange={e => location.change({ medidor: e.target.value, pagina: '' })}
                  >
                    <option value="">Todos los medidores</option>
                    {data.meters.map(item => (
                      <option key={item.id_medidor} value={item.id_medidor}>
                        {meterName(item.id_medidor)}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>
          )}
          {tab === 'roles' && data.rolePermissions && (
            <RolePermissions
              key={selectedRole + ':' + data.revision}
              currentRole={user.role}
              role={selectedRole}
              saved={
                selectedRole === 'admin'
                  ? defaultPermissions('admin')
                  : data.rolePermissions[selectedRole]
              }
              busy={busy}
              onRole={role => location.change({ vista: role })}
              onSave={(role, permissions) => mutate('/roles/' + role, permissions, 'PUT')}
            />
          )}
          {tab === 'dashboard' && (
            <>
              <section className="sm-hero">
                <div className="sm-hero-copy">
                  <p>
                    <Activity size={15} aria-hidden /> CONTROL OPERATIVO
                  </p>
                  <h2>El mantenimiento, al día</h2>
                  <p>Revisa los próximos vencimientos y prioriza los servicios de tus equipos.</p>
                  {canRead('alerts') && canEvaluate && (
                    <button
                      type="button"
                      onClick={() => navigate('alerts', { fecha: day })}
                      className="sm-hero-button"
                    >
                      Ver alertas <ArrowUpRight size={16} aria-hidden />
                    </button>
                  )}
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
                      'PENDIENTE',
                    ],
                    [
                      'Servicios realizados',
                      data.orders.filter(o => o.estado === 'REALIZADA').length,
                      CheckCircle2,
                      'orders',
                      'green',
                      'REALIZADA',
                    ],
                  ] as const
                )
                  .filter(
                    ([, , , destination]) =>
                      canRead(destination) && (destination !== 'alerts' || canEvaluate)
                  )
                  .map(([label, value, Icon, destination, tone, status]) => (
                    <button
                      type="button"
                      key={label}
                      className={'sm-kpi sm-card'}
                      onClick={() =>
                        navigate(destination, {
                          ...(status === 'all' ? {} : { estado: status }),
                          ...(destination === 'alerts' ? { fecha: day } : {}),
                        })
                      }
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
              {canEvaluate && (
                <Table
                  pagination={pagination}
                  title="Seguimiento de planes"
                  headers={['Activo / Plan', 'Estado', 'Próximas metas']}
                  rows={evaluations.map(e => [
                    recordLink('plans', e.plan.id_plan, planName(e.plan.id_plan)),
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
              )}
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
              {!canEvaluate ? (
                <EmptyState title="Evaluación no disponible">
                  Se requieren permisos de consulta de planes, unidades, medidores, lecturas y
                  órdenes.
                </EmptyState>
              ) : visibleAlerts.length ? (
                <Paginated
                  rows={[...visibleAlerts].sort(
                    (a, b) => attention.indexOf(a.status) - attention.indexOf(b.status)
                  )}
                  pagination={pagination}
                >
                  {rows => (
                    <ul className="sm-alert-list">
                      {rows.map(e => (
                        <li key={e.plan.id_plan}>
                          <div>
                            {recordLink('plans', e.plan.id_plan, planName(e.plan.id_plan))}
                            {e.rules.map(r => (
                              <p key={r.id}>{r.remaining}</p>
                            ))}
                          </div>
                          <Status value={e.status} />
                        </li>
                      ))}
                    </ul>
                  )}
                </Paginated>
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
                Consulta y gestiona los activos habilitados para mantenimiento.
              </p>
              <Table
                pagination={pagination}
                title="Equipos incluidos"
                filtered={!!(search.trim() || record || meter || filter !== 'all')}
                headers={[
                  'Código interno',
                  'Referencia ERP',
                  'Activo',
                  'Tipo',
                  'Empresa / Sucursal',
                ]}
                rows={activeAssets
                  .filter(
                    a => selectRecord(a.id_activo) && matches(a.act_cod_act, a.clave, a.nombre)
                  )
                  .map(a => [
                    a.act_cod_act,
                    a.clave || '—',
                    recordLink('assets', a.id_activo, a.nombre),
                    a.tipo,
                    `${a.empresa_id} / ${a.sucursal_id}`,
                  ])}
              />
            </>
          )}
          {tab === 'units' && (
            <Table
              pagination={pagination}
              title="Catálogo de unidades"
              filtered={!!(search.trim() || record || meter || filter !== 'all')}
              headers={['Código', 'Nombre', 'Control', 'Estado', 'Acciones']}
              rows={data.units
                .filter(u => selectRecord(u.id_um) && matches(u.codigo, u.nombre))
                .map(u => [
                  u.codigo,
                  recordLink('units', u.id_um, u.nombre),
                  u.tipo_control,
                  <Status value={u.estado ? 'ACTIVO' : 'INACTIVO'} />,
                  can('units.update') && button('Editar', () => open('units', u, u.id_um)),
                ])}
            />
          )}
          {tab === 'types' && (
            <Table
              pagination={pagination}
              title="Catálogo de servicios"
              filtered={!!(search.trim() || record || meter || filter !== 'all')}
              headers={['Nombre', 'Descripción', 'Estado', 'Acciones']}
              rows={data.types
                .filter(t => selectRecord(t.id_tima) && matches(t.nombre, t.descripcion))
                .map(t => [
                  recordLink('types', t.id_tima, t.nombre),
                  t.descripcion,
                  <Status value={t.estado ? 'ACTIVO' : 'INACTIVO'} />,
                  can('types.update') && button('Editar', () => open('types', t, t.id_tima)),
                ])}
            />
          )}
          {tab === 'parts' && (
            <Table
              pagination={pagination}
              title="Catálogo de repuestos"
              filtered={!!(search.trim() || record || meter || filter !== 'all')}
              headers={[
                'Código',
                'Repuesto',
                'Unidad',
                'Costo de referencia',
                'Estado',
                'Acciones',
              ]}
              rows={data.parts
                .filter(p => selectRecord(p.id_repu) && matches(p.codigo, p.nombre))
                .map(p => [
                  p.codigo,
                  recordLink('parts', p.id_repu, p.nombre),
                  p.unidad_medida,
                  p.costo_referencia,
                  <Status value={p.estado ? 'ACTIVO' : 'INACTIVO'} />,
                  can('parts.update') && button('Editar', () => open('parts', p, p.id_repu)),
                ])}
            />
          )}

          {tab === 'meters' &&
            (() => {
              const meters = data.meters.filter(
                m =>
                  selectRecord(m.id_medidor) &&
                  matches(assetName(m.id_activo), m.codigo, m.nombre_medidor)
              );
              const latestReadings = new Map<string, (typeof data.readings)[number]>();
              for (const reading of data.readings) {
                const previous = latestReadings.get(reading.id_medidor);
                if (!previous || reading.fecha_lectura > previous.fecha_lectura)
                  latestReadings.set(reading.id_medidor, reading);
              }
              return meters.length ? (
                <Paginated rows={meters} pagination={pagination}>
                  {rows => (
                    <div className="sm-meter-grid">
                      {rows.map(m => {
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
                            <h2>{recordLink('meters', m.id_medidor, m.nombre_medidor)}</h2>
                            <p>{m.codigo}</p>
                            <div className="sm-meter-value">
                              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 block mb-1">
                                Valor actual:
                              </span>
                              <strong>{latest ? formatReadingValue(latest.valor) : '0'}</strong>{' '}
                              <span>{readingUnit(data, m.id_medidor) || unitName(m.id_um)}</span>
                            </div>
                            <p className="mt-1 text-sm text-slate-600">
                              <span className="font-medium text-slate-700">Última lectura: </span>
                              {latest
                                ? formatReadingTimestamp(latest.fecha_lectura)
                                : 'Sin lecturas registradas'}
                            </p>
                            <div className="sm-card-actions">
                              {m.estado &&
                                can('readings.create') &&
                                data.units.some(unit => unit.id_um === m.id_um && unit.estado) &&
                                activeAssets.some(asset => asset.id_activo === m.id_activo) &&
                                button('Registrar lectura', () =>
                                  open('readings', { id_medidor: m.id_medidor })
                                )}
                              {can('meters.update') &&
                                button('Editar medidor', () => open('meters', m, m.id_medidor))}
                              {canRead('plans') &&
                                button('Planes asociados', () => setMeterPlansModal(m.id_medidor))}
                              {canRead('readings') && (
                                <a
                                  className="sm-link"
                                  href={maintenanceHref('readings', {
                                    medidor: m.id_medidor,
                                    conexion: user.connectionId ?? '',
                                  })}
                                  onClick={event => {
                                    if (
                                      event.ctrlKey ||
                                      event.metaKey ||
                                      event.shiftKey ||
                                      event.altKey
                                    )
                                      return;
                                    event.preventDefault();
                                    navigate('readings', {
                                      medidor: m.id_medidor,
                                      conexion: user.connectionId ?? '',
                                    });
                                  }}
                                >
                                  Ver lecturas
                                </a>
                              )}
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  )}
                </Paginated>
              ) : (
                <section className="sm-card">
                  <EmptyState
                    title={search.trim() || record ? 'Sin coincidencias' : 'Aún no hay medidores'}
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
                pagination={pagination}
                title="Lecturas registradas"
                filtered={!!(search.trim() || record || meter || filter !== 'all')}
                headers={[
                  'Medidor',
                  'Fecha y hora',
                  'Lectura',
                  'Observación',
                  ...(can('readings.update') ? ['Acciones'] : []),
                ]}
                rows={data.readings
                  .filter(
                    r =>
                      selectRecord(r.id_lectura) &&
                      (!meter || r.id_medidor === meter) &&
                      matches(meterName(r.id_medidor), r.observacion, r.valor, r.fecha_lectura)
                  )
                  .sort((a, b) => b.fecha_lectura.localeCompare(a.fecha_lectura))
                  .map(r => [
                    recordLink('readings', r.id_lectura, meterName(r.id_medidor)),
                    r.fecha_lectura.replace('T', ' '),
                    r.valor + ' ' + readingUnit(data, r.id_medidor),
                    r.observacion,
                    ...(can('readings.update')
                      ? [button('Editar lectura', () => open('readings', r, r.id_lectura))]
                      : []),
                  ])}
              />
            </>
          )}
          {tab === 'plans' &&
            (visiblePlans.length ? (
              <Paginated rows={visiblePlans} pagination={pagination}>
                {rows => (
                  <div className="sm-plan-grid">
                    {rows.map(e => (
                      <article key={e.plan.id_plan} className={styles.card + ' space-y-4 p-5'}>
                        <div className="flex justify-between gap-3">
                          <div>
                            <p className="text-xs font-semibold text-blue-700">
                              {assetName(e.plan.id_activo)}
                            </p>
                            <h2 className="text-lg font-bold">
                              {recordLink('plans', e.plan.id_plan, e.plan.nombre_plan)}
                            </h2>
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
                                Base inicial: {r.valor_base ?? 'Calendario'} · Alerta:{' '}
                                {r.alerta_antes}
                              </p>
                              {r.id_medidor && <p>{meterName(r.id_medidor)}</p>}
                              <p>{e.rules.find(v => v.id === r.id_regla)?.remaining}</p>
                            </div>
                          ))}
                        {(can('plans.state') || can('plans.replace')) && (
                          <div>
                            {can('plans.state') &&
                              button(
                                e.plan.estado === 'ACTIVO' ? 'Desactivar' : 'Activar',
                                () =>
                                  void mutate(
                                    `/plans/${e.plan.id_plan}/state`,
                                    { estado: e.plan.estado === 'ACTIVO' ? 'INACTIVO' : 'ACTIVO' },
                                    'PUT'
                                  )
                              )}
                            {can('plans.replace') &&
                              e.plan.estado === 'ACTIVO' &&
                              button('Sustituir estrategia', () =>
                                open('plans', e.plan, e.plan.id_plan)
                              )}
                          </div>
                        )}
                        <p className="text-xs text-slate-500">
                          La base inicial se conserva. El ciclo siguiente parte de la última
                          ejecución realizada.
                        </p>
                      </article>
                    ))}
                  </div>
                )}
              </Paginated>
            ) : (
              <section className="sm-card">
                <EmptyState
                  title={record || filter !== 'all' ? 'Sin coincidencias' : 'Aún no hay planes'}
                />
              </section>
            ))}
          {tab === 'orders' && (
            <Table
              pagination={pagination}
              title="Órdenes registradas"
              filtered={!!(search.trim() || record || meter || filter !== 'all')}
              headers={[
                'Orden / Plan',
                'Programada',
                'Estado',
                'Ejecución',
                'Repuestos / Total',
                'Acciones',
              ]}
              rows={data.orders
                .filter(
                  o =>
                    selectRecord(o.id_ordm) &&
                    (filter === 'all' || o.estado === filter) &&
                    matches(o.id_ordm, planName(o.id_plan), o.estado, labels[o.estado])
                )
                .map(o => {
                  const details = data.details.filter(d => d.id_ordm === o.id_ordm);
                  const meters = new Set(
                    data.rules
                      .filter(r => r.id_plan === o.id_plan && r.estado && r.id_medidor)
                      .map(r => r.id_medidor)
                  );
                  return [
                    recordLink('orders', o.id_ordm, '#' + o.id_ordm + ' · ' + planName(o.id_plan)),
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
                    can('parts.read') ? (
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
                      </>
                    ) : (
                      '—'
                    ),
                    o.estado === 'PENDIENTE' && (
                      <>
                        {can('orders.complete') &&
                          button(
                            'Completar',
                            () => open('complete', undefined, o.id_ordm),
                            meters.size > 1
                          )}
                        {can('orders.cancel') &&
                          button('Cancelar', () => setConfirmCancel(o.id_ordm))}
                        {can('orders.complete') && meters.size > 1 && (
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
              pagination={pagination}
              title="Operaciones registradas"
              filtered={!!(search.trim() || record || meter || filter !== 'all')}
              headers={['Fecha', 'Operación', 'Registro', 'Usuario']}
              rows={data.audit
                .filter(a => selectRecord(a.id) && matches(operations[a.operation], a.entity_id))
                .map(a => [
                  a.created_at,
                  recordLink('audit', a.id, operations[a.operation] ?? a.operation),
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
