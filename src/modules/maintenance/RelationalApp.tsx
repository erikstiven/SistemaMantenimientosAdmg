import {
  Activity,
  LayoutGrid,
  ArrowUpRight,
  Bell,
  Boxes,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Ban,
  Eye,
  Gauge,
  History,
  LogOut,
  Pencil,
  Plus,
  Power,
  RefreshCw,
  Search,
  Trash2,
  TriangleAlert,
} from 'lucide-react';
import { Workspace, Brand } from '../../components/Workspace';
import { EmptyState, Loading, Notice } from '../../components/Feedback';
import { Modal } from '../../components/Modal';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { User } from '../../../shared/state';
import { cents, decimal, partInput, type MaintenanceBootstrap } from '../../../shared/relational';
import {
  businessDay,
  businessTimestamp,
  evaluatePlan,
} from '../../../shared/maintenance-evaluation';
import { defaultPermissions, roleLabels, type Permission } from '../../../shared/permissions';
import { maintenanceHref, useMaintenanceLocation } from './hooks/useMaintenanceLocation';
import { Paginated } from './components/Pagination';
import { PlansCalendar } from './components/PlansCalendar';
import { ReadingHistory } from './components/ReadingHistory';
import { AuditHistory } from './components/AuditHistory';
import {
  formatReadingTimestamp,
  formatReadingValue,
  latestValidReadings,
  readingUnit,
} from './reading-format';
import { RolePermissions } from './components/RolePermissions';
import { api, ApiError, request } from '../../services/api';
import { LoginPage } from '../auth/pages/LoginPage';
import { styles } from '../../components/styles';
import { moduleInfo, navigation, labels, type ModuleKey } from './relational-labels';
import { Table, Status } from './components/RelationalTable';
import { RelationalEditor, type Draft, type Editor } from './RelationalEditor';
import { planTextFields, suggestPlanText } from './plan-text';

const actionIcons = {
  'Editar': Pencil,
  'Editar lectura': Pencil,
  'Editar medidor': Pencil,
  'Registrar lectura': Plus,
  'Planes asociados': ClipboardList,
  'Ver ficha': Eye,
  'Completar': CheckCircle2,
  'Cancelar': Ban,
  'Activar': Power,
  'Desactivar': Power,
  'Eliminar': Trash2,
  'Anular': Ban,
} as const;
type RecordAction = keyof typeof actionIcons;
type Confirmation = { title: string; message: string; run: () => void; danger?: boolean };
const newPartDraft = { codigo: '', nombre: '', unidad_medida: 'Unidad', costo_referencia: '0', estado: true };
type MutationResult = { id: string | null; revision: number };

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
  const [partEditor, setPartEditor] = useState<Editor | null>(null);
  const [quickPartError, setQuickPartError] = useState('');
  const [quickPartRow, setQuickPartRow] = useState<number | null>(null);
  const [success, setSuccess] = useState('');
  const [confirmCancel, setConfirmCancel] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [meterPlansModal, setMeterPlansModal] = useState<string | null>(null);
  const [assetFichaModal, setAssetFichaModal] = useState<string | null>(null);
  const planView = location.view === 'calendar' ? 'calendar' : 'cards';
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
      setPartEditor(null);
      setConfirmCancel(null);
      setConfirmation(null);
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
  async function mutate(
    path: string,
    body: unknown,
    method = 'POST',
    onSaved?: (result: MutationResult) => void
  ) {
    if (!data) return;
    setBusy(true);
    if (onSaved) setQuickPartError('');
    else setFormError('');
    setSuccess('');
    try {
      const result = await request<MutationResult>('/maintenance' + path, {
        method,
        body: JSON.stringify({ revision: data.revision, data: body }),
      });
      if (onSaved) onSaved(result);
      else setEditor(null);
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
      if (onSaved) setQuickPartError(message);
      else if (editor) setFormError(message);
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
      parts: newPartDraft,
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
    const next: Editor = {
      kind,
      id,
      draft,
      rules: rules.length
        ? rules
        : [{ id_um: '', id_medidor: null, frecuencia: '', valor_base: null, alerta_antes: '0' }],
      details: [],
    };
    if (kind === 'plans' && id && data) {
      const suggested = suggestPlanText(data, next);
      next.planTextCustomized = Object.fromEntries(
        planTextFields.map(key => [key, !!draft[key] && draft[key] !== suggested[key]])
      );
    }
    setEditor(next);
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
  const typeName = (id: string) =>
    data?.types.find(t => t.id_tima === id)?.nombre ?? 'Mantenimiento';
  const matches = (...values: unknown[]) =>
    values.join(' ').toLocaleLowerCase().includes(search.trim().toLocaleLowerCase());
  const searchControl = (
    <label className="sm-search">
      <Search size={17} aria-hidden />
      <input
        type="search"
        aria-label={tab === 'plans' ? 'Buscar planes' : 'Buscar registros'}
        placeholder={tab === 'plans' ? 'Buscar planes…' : 'Buscar en este módulo…'}
        className={styles.input}
        value={search}
        onChange={e => location.change({ q: e.target.value, pagina: '' }, true)}
      />
    </label>
  );
  function button(label: RecordAction, action: () => void, disabled = false) {
    const Icon = actionIcons[label];
    const danger = ['Eliminar', 'Anular', 'Cancelar', 'Desactivar'].includes(label);
    return (
      <button
        type="button"
        disabled={busy || !!error || disabled}
        onClick={action}
        className={`sm-record-action${danger ? ' sm-record-action-danger' : ''}`}
        aria-label={label}
        title={label}
      >
        <Icon size={17} aria-hidden />
      </button>
    );
  }
  const deletionMessages = {
    meters: 'Si el medidor tiene lecturas o reglas asociadas, se desactivará y conservará su historial.',
    plans: 'Si el plan tiene órdenes en el historial, se desactivará. Las órdenes pendientes deben resolverse primero.',
    orders: 'La orden se retirará del registro. Las órdenes realizadas se conservan como respaldo.',
    parts: 'Solo se pueden eliminar repuestos que no estén en uso.',
    types: 'Solo se pueden eliminar tipos que no estén en uso.',
    units: 'Solo se pueden eliminar unidades que no estén en uso.',
  };
  function deleteButton(key: keyof typeof deletionMessages, id: string, name: string) {
    return user?.role === 'admin' && can(`${key}.delete`) && button('Eliminar', () =>
      setConfirmation({
        title: `Eliminar ${name}`,
        message: deletionMessages[key],
        run: () => void mutate(`/${key}/${id}`, {}, 'DELETE'),
        danger: true,
      })
    );
  }
  const activeAssets = data?.assets.filter(a => a.act_usa_mant === 'S') ?? [];
  const latestReadings = latestValidReadings(
    tab === 'meters' || assetFichaModal ? (data?.readings ?? []) : []
  );
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
    e => selectRecord(e.plan.id_plan) &&
      (filter === 'all' || e.status === filter) &&
      matches(e.plan.id_plan, e.plan.nombre_plan, assetName(e.plan.id_activo),
        typeName(e.plan.id_tima), e.plan.observacion)
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
    setPartEditor(null);
    setConfirmCancel(null);
    setConfirmation(null);
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
      setPartEditor(null);
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
              onQuickPart={editor.kind === 'complete' && can('parts.create') ? row => {
                setQuickPartError('');
                setQuickPartRow(row);
                setPartEditor({ kind: 'parts', draft: { ...newPartDraft }, details: [], rules: [] });
              } : undefined}
            />
          )}
          {partEditor && editor?.kind === 'complete' && data && allowed && correctConnection &&
            can('parts.create') && (
              <RelationalEditor
                editor={partEditor}
                data={data}
                busy={busy}
                formError={quickPartError}
                setEditor={setPartEditor}
                mutate={async (path, body, method) => {
                  await mutate(path, body, method, ({ id, revision }) => {
                    const parsed = partInput.parse(body);
                    if (id) {
                      const part = { ...parsed, id_repu: id };
                      setData(old => old && { ...old, revision, parts: [...old.parts, part] });
                      setEditor(old => old && ({
                        ...old,
                        details: old.details.map((detail, index) =>
                          index === quickPartRow && !detail.id_repu
                            ? { ...detail, id_repu: id, costo_unitario: part.costo_referencia }
                            : detail
                        ),
                      }));
                    }
                    setPartEditor(null);
                  });
                }}
                assetName={assetName}
                meterName={meterName}
                planName={planName}
                quickPart
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
          {confirmation && allowed && correctConnection && (
            <Modal labelledBy="confirm-record-title" onClose={() => setConfirmation(null)}>
              <div className="sm-modal-content">
                <h2 id="confirm-record-title">{confirmation.title}</h2>
                <p>{confirmation.message}</p>
                <div className="sm-modal-actions">
                  <button type="button" autoFocus className="sm-secondary" onClick={() => setConfirmation(null)}>
                    Volver
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    className={confirmation.danger ? 'sm-danger' : styles.button}
                    onClick={() => {
                      setConfirmation(null);
                      confirmation.run();
                    }}
                  >
                    Confirmar
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
          {assetFichaModal && data && (() => {
            const asset = data.assets.find(a => a.id_activo === assetFichaModal);
            if (!asset) return null;

            const assetMeters = data.meters.filter(m => m.id_activo === asset.id_activo);
            const assetPlans = data.plans.filter(p => p.id_activo === asset.id_activo);
            const formatFreq = (freq: string) => {
              const num = Number(freq);
              return isNaN(num) ? freq : num.toLocaleString('es-EC');
            };

            return (
              <Modal labelledBy="asset-ficha-title" onClose={() => setAssetFichaModal(null)}>
                <div className="sm-modal-content space-y-5">
                  {/* Cabecera limpia */}
                  <div className="flex justify-between items-start border-b pb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 id="asset-ficha-title" className="text-lg font-bold text-slate-900">
                          {asset.nombre}
                        </h2>
                        <Status value={asset.act_usa_mant === 'S' ? 'ACTIVO' : 'INACTIVO'} />
                      </div>
                      <p className="text-xs text-slate-500 mt-1">
                        Código: <strong className="text-slate-700">{asset.act_cod_act}</strong>
                        {asset.clave ? <> · Ref ERP: <strong className="text-slate-700">{asset.clave}</strong></> : ''}
                        {asset.act_fcmp_act ? (
                          <> · Compra: <strong className="text-slate-700">{asset.act_fcmp_act.split('-').reverse().join('/')}</strong></>
                        ) : ''}
                      </p>
                    </div>
                    <button
                      type="button"
                      aria-label="Cerrar ficha"
                      className="sm-secondary sm-icon-button"
                      onClick={() => setAssetFichaModal(null)}
                    >
                      ✕
                    </button>
                  </div>

                  {/* Sección: Medición y desgaste */}
                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-1.5">
                      <Gauge size={16} className="text-slate-500" /> Medidores instalados ({assetMeters.length})
                    </h3>
                    {assetMeters.length ? (
                      <ul className="space-y-2 max-h-40 overflow-y-auto">
                        {assetMeters.map(m => {
                          const latest = latestReadings.get(m.id_medidor);
                          const unit = readingUnit(data, m.id_medidor) || unitName(m.id_um);
                          return (
                            <li
                              key={m.id_medidor}
                              className="p-3 border rounded-lg bg-slate-50 flex items-center justify-between gap-3 text-xs"
                            >
                              <div>
                                <div className="flex items-center gap-2">
                                  <strong className="text-slate-900 text-sm">{m.nombre_medidor}</strong>
                                  <Status value={m.estado ? 'ACTIVO' : 'INACTIVO'} />
                                </div>
                                <p className="text-slate-600 mt-1">
                                  <span className="font-semibold text-slate-900 text-sm">
                                    {latest ? formatReadingValue(latest.valor) : '0'} {unit}
                                  </span>
                                  {latest && (
                                    <span className="text-slate-500 ml-2">
                                      · Última lectura: {formatReadingTimestamp(latest.fecha_lectura)}
                                    </span>
                                  )}
                                </p>
                              </div>
                              <button
                                type="button"
                                className="sm-link font-bold text-sm px-2 py-1 rounded hover:bg-slate-200"
                                title="Ver en módulo de medidores"
                                onClick={() => {
                                  const mId = m.id_medidor;
                                  setAssetFichaModal(null);
                                  navigate('meters', { registro: mId, conexion: user.connectionId ?? '' });
                                }}
                              >
                                →
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    ) : (
                      <p className="text-xs text-slate-500 italic bg-slate-50 p-2.5 rounded-lg border">
                        Este equipo no tiene medidores registrados.
                      </p>
                    )}
                  </div>

                  {/* Sección: Planes de mantenimiento */}
                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-1.5">
                      <CalendarDays size={16} className="text-slate-500" /> Planes de mantenimiento ({assetPlans.length})
                    </h3>
                    {assetPlans.length ? (
                      <ul className="space-y-2 max-h-48 overflow-y-auto">
                        {assetPlans.map(p => {
                          const evalObj = evaluations.find(e => e.plan.id_plan === p.id_plan);
                          const planRules = data.rules.filter(r => r.id_plan === p.id_plan && r.estado);
                          return (
                            <li
                              key={p.id_plan}
                              className="p-3 border rounded-lg bg-slate-50 flex items-center justify-between gap-3 text-xs"
                            >
                              <div>
                                <div className="flex items-center gap-2">
                                  <strong className="text-slate-900 text-sm">{p.nombre_plan}</strong>
                                  <Status value={evalObj ? evalObj.status : p.estado} />
                                </div>
                                <p className="text-slate-600 mt-1">
                                  {typeName(p.id_tima)}
                                  {planRules.length
                                    ? ' · ' +
                                      planRules
                                        .map(r => `Cada ${formatFreq(r.frecuencia)} ${unitName(r.id_um)}`)
                                        .join(' · ')
                                    : ''}
                                </p>
                              </div>
                              <button
                                type="button"
                                className="sm-link font-bold text-sm px-2 py-1 rounded hover:bg-slate-200"
                                title="Ver en módulo de planes"
                                onClick={() => {
                                  const pId = p.id_plan;
                                  setAssetFichaModal(null);
                                  navigate('plans', { registro: pId, conexion: user.connectionId ?? '', fecha: day });
                                }}
                              >
                                →
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    ) : (
                      <p className="text-xs text-slate-500 italic bg-slate-50 p-2.5 rounded-lg border">
                        Este equipo no tiene planes de mantenimiento asignados.
                      </p>
                    )}
                  </div>

                  {/* Acciones de pie */}
                  <div className="sm-modal-actions pt-3 border-t flex justify-end gap-2">
                    <button
                      type="button"
                      className="sm-secondary"
                      onClick={() => setAssetFichaModal(null)}
                    >
                      Cerrar
                    </button>
                    {can('assets.update') && (
                      <button
                        type="button"
                        className={styles.button}
                        onClick={() => {
                          setAssetFichaModal(null);
                          open('assets', asset, asset.id_activo);
                        }}
                      >
                        Editar activo
                      </button>
                    )}
                  </div>
                </div>
              </Modal>
            );
          })()}
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
          {tab !== 'roles' && tab !== 'readings' && (
            <div className="sm-toolbar">
              {(!calendarTab || tab === 'plans') && searchControl}
              {calendarTab && (
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
              {tab === 'plans' && (
                <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1 border ml-auto">
                  <button
                    type="button"
                    className={`px-3 py-1 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                      planView === 'cards'
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                    aria-pressed={planView === 'cards'}
                    onClick={() => location.change({ vista: '', pagina: '' })}
                  >
                    <LayoutGrid size={14} />
                    Tarjetas
                  </button>
                  <button
                    type="button"
                    className={`px-3 py-1 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                      planView === 'calendar'
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                    aria-pressed={planView === 'calendar'}
                    onClick={() => location.change({ vista: 'calendar', pagina: '' })}
                  >
                    <CalendarDays size={14} />
                    Calendario
                  </button>
                </div>
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
              {(can('orders.read') || canEvaluate) && (
                <section aria-labelledby="dashboard-calendar-title" className="space-y-3">
                  <div>
                    <h2 id="dashboard-calendar-title" className="text-lg font-bold">
                      Calendario de mantenimiento
                    </h2>
                    <p className="text-sm text-slate-600">
                      {canEvaluate
                        ? 'Consulta las órdenes programadas y las fechas proyectadas de los planes.'
                        : 'Consulta las órdenes de mantenimiento programadas.'}
                    </p>
                  </div>
                  <PlansCalendar
                    key={day}
                    plans={canEvaluate
                      ? evaluations.filter(e => e.status !== 'INACTIVO' && e.status !== 'FUERA_VIGENCIA')
                      : []}
                    allPlans={data.plans}
                    orders={data.orders}
                    allRules={data.rules}
                    assets={data.assets}
                    types={data.types}
                    today={day}
                    onSelectPlan={id => navigate('plans', {
                      registro: id, fecha: day, conexion: user.connectionId ?? '',
                    })}
                    onSelectOrder={id => navigate('orders', {
                      registro: id, conexion: user.connectionId ?? '',
                    })}
                  />
                </section>
              )}
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
                Activa o desactiva el mantenimiento de los activos de esta conexión.
              </p>
              <Table
                pagination={pagination}
                title="Catálogo de activos"
                layout="assets"
                sort={{
                  'Código interno': {
                    direction: location.assetSortByStatus ? undefined : location.assetOrder,
                    toggle: () => location.change({
                      columna: '',
                      orden: !location.assetSortByStatus && location.assetOrder === 'ascending' ? 'desc' : '',
                      pagina: '',
                    }),
                  },
                  Mantenimiento: {
                    direction: location.assetSortByStatus ? location.assetOrder : undefined,
                    toggle: () => location.change({
                      columna: 'mantenimiento',
                      orden: location.assetSortByStatus && location.assetOrder === 'ascending' ? 'desc' : '',
                      pagina: '',
                    }),
                  },
                }}
                filtered={!!(search.trim() || record || meter || filter !== 'all')}
                headers={[
                  'Código interno',
                  'Referencia ERP',
                  'Activo',
                  'Empresa / Sucursal',
                  'Mantenimiento',
                  'Acciones',
                ]}
                rows={data.assets
                  .filter(
                    a => selectRecord(a.id_activo) && matches(a.act_cod_act, a.clave, a.nombre)
                  )
                  .sort((a, b) => {
                    const code = a.act_cod_act.localeCompare(b.act_cod_act, 'es', { numeric: true });
                    const direction = location.assetOrder === 'ascending' ? 1 : -1;
                    if (!location.assetSortByStatus) return direction * code;
                    // Match the order of the displayed labels: Activo before Inactivo.
                    return direction * b.act_usa_mant.localeCompare(a.act_usa_mant) || code;
                  })
                  .map(a => [
                    a.act_cod_act,
                    a.clave || '—',
                    <button
                      type="button"
                      className="sm-link font-semibold text-left"
                      onClick={() => setAssetFichaModal(a.id_activo)}
                      title="Ver ficha del activo"
                    >
                      {a.nombre}
                    </button>,
                    `${a.empresa_id} / ${a.sucursal_id}`,
                    <Status value={a.act_usa_mant === 'S' ? 'ACTIVO' : 'INACTIVO'} />,
                    <div className="sm-row-actions">
                      {button('Ver ficha', () => setAssetFichaModal(a.id_activo))}
                      {can('assets.update') && button('Editar', () => open('assets', a, a.id_activo))}
                      {user.role === 'admin' && can('assets.update') && (() => {
                        const active = a.act_usa_mant === 'S';
                        return button(active ? 'Desactivar' : 'Activar', () =>
                          setConfirmation({
                            title: `${active ? 'Desactivar' : 'Activar'} mantenimiento`,
                            message: active
                              ? `${a.nombre} quedará inactivo para mantenimiento y conservará su historial.`
                              : `${a.nombre} quedará habilitado para mantenimiento.`,
                            run: () => void mutate(
                              `/assets/${a.id_activo}/state`,
                              { act_usa_mant: active ? 'N' : 'S' },
                              'PUT'
                            ),
                            danger: active,
                          })
                        );
                      })()}
                    </div>,
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
                  <div className="sm-row-actions">
                    {can('units.update') && button('Editar', () => open('units', u, u.id_um))}
                    {deleteButton('units', u.id_um, u.nombre)}
                  </div>,
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
                  <div className="sm-row-actions">
                    {can('types.update') && button('Editar', () => open('types', t, t.id_tima))}
                    {deleteButton('types', t.id_tima, t.nombre)}
                  </div>,
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
                  <div className="sm-row-actions">
                    {can('parts.update') && button('Editar', () => open('parts', p, p.id_repu))}
                    {deleteButton('parts', p.id_repu, p.nombre)}
                  </div>,
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
                              <strong>{formatReadingValue(latest?.valor)}</strong>{' '}
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
                                  className="sm-record-action"
                                  title="Ver lecturas"
                                  aria-label="Ver lecturas"
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
                                  <History size={17} aria-hidden />
                                </a>
                              )}
                              {deleteButton('meters', m.id_medidor, m.nombre_medidor)}
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
            <ReadingHistory
              data={data}
              location={location}
              pagination={pagination}
              searchControl={searchControl}
              assetName={assetName}
              readingLink={(r, label) => recordLink('readings', r.id_lectura, label)}
              matches={matches}
              actions={can('readings.update') || can('readings.void') ? r => (
                <div className="sm-row-actions">
                  {can('readings.update') &&
                    button('Editar lectura', () => open('readings', r, r.id_lectura))}
                  {user.role === 'admin' && can('readings.void') && button('Anular', () =>
                    setConfirmation({
                      title: 'Anular lectura',
                      message: 'La lectura se conservará en el historial y se excluirá de los cálculos.',
                      run: () => void mutate(`/readings/${r.id_lectura}/void`, {}),
                      danger: true,
                    })
                  )}
                </div>
              ) : undefined}
            />
          )}
          {tab === 'plans' &&
            (planView === 'calendar' ? (
              <PlansCalendar
                plans={visiblePlans}
                allPlans={data.plans}
                orders={search.trim() || record || filter !== 'all'
                  ? data.orders.filter(order => visiblePlans.some(e => e.plan.id_plan === order.id_plan))
                  : data.orders}
                allRules={data.rules}
                assets={data.assets}
                types={data.types}
                today={day}
                onSelectPlan={id => {
                  location.change({ vista: '', registro: id, pagina: '' });
                }}
                onSelectOrder={id => {
                  navigate('orders', { registro: id, conexion: user.connectionId ?? '' });
                }}
                onCompleteOrder={id => {
                  open('complete', undefined, id);
                }}
                onCreateOrder={id => {
                  open('orders', { id_plan: id });
                }}
                onScheduleOrderForDate={date => {
                  open('orders', { fecha_programada: date });
                }}
                canCreateOrder={can('orders.create')}
                canCompleteOrder={can('orders.complete')}
              />
            ) : visiblePlans.length ? (
              <Paginated rows={visiblePlans} pagination={pagination}>
                {rows => (
                  <div className="sm-plan-grid">
                    {rows.map(e => {
                      const activeOrder = data.orders.find(
                        o => o.id_plan === e.plan.id_plan && o.estado === 'PENDIENTE'
                      );
                      const cleanRemaining = (text: string) => text.replace(/(\d+)\.00(?=\s|$)/g, (_, num) => Number(num).toLocaleString('es-EC'));
                      const formatNum = (val: string | null) => {
                        if (val == null) return '0';
                        const n = Number(val);
                        return isNaN(n) ? val : n.toLocaleString('es-EC');
                      };

                      return (
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

                          {/* Aviso visual de orden pendiente si existe */}
                          {activeOrder && (
                            <div className="flex items-center justify-between p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs">
                              <div>
                                <span className="font-bold text-amber-900 block">
                                  Orden #{activeOrder.id_ordm} programada
                                </span>
                                <span className="text-amber-800">
                                  Fecha: {activeOrder.fecha_programada ? activeOrder.fecha_programada.split('-').reverse().join('/') : 'Sin fecha'}
                                </span>
                              </div>
                              {can('orders.complete') && (
                                <button
                                  type="button"
                                  className="px-2.5 py-1 text-xs font-bold bg-amber-600 text-white rounded hover:bg-amber-700 transition-colors shadow-xs"
                                  onClick={() => open('complete', undefined, activeOrder.id_ordm)}
                                >
                                  Completar orden
                                </button>
                              )}
                            </div>
                          )}

                          {data.rules
                            .filter(r => r.id_plan === e.plan.id_plan && r.estado)
                            .sort((a, b) => a.orden_eval - b.orden_eval)
                            .map(r => {
                              const evalRule = e.rules.find(v => v.id === r.id_regla);
                              const remainingText = evalRule?.remaining ?? '';
                              const isNegative = remainingText.startsWith('-');
                              const meterObj = data.meters.find(m => m.id_medidor === r.id_medidor);

                              return (
                                <div
                                  key={r.id_regla}
                                  className="rounded-lg bg-slate-50 p-3 text-sm break-words space-y-1"
                                >
                                  <div className="font-bold text-slate-900">
                                    {r.orden_eval}. Cada {formatNum(r.frecuencia)} {unitName(r.id_um)}
                                    {r.orden_eval > 1
                                      ? r.condicion === 'OR'
                                        ? ' · Cualquiera'
                                        : ' · Todas'
                                      : ''}
                                  </div>
                                  <p className="text-xs text-slate-500">
                                    Base inicial: {r.valor_base ? formatNum(r.valor_base) : 'Calendario'} · Aviso previo: {formatNum(r.alerta_antes)} {unitName(r.id_um)}
                                  </p>
                                  {meterObj && (
                                    <p className="text-xs text-slate-600 font-medium">
                                      Medidor: {meterObj.nombre_medidor} ({meterObj.codigo})
                                    </p>
                                  )}
                                  {remainingText && (
                                    <p className="text-xs pt-1">
                                      {e.plan.estado === 'INACTIVO' ? (
                                        <span className="text-slate-500 font-medium">
                                          Plan inactivo · Remanente registrado: {cleanRemaining(remainingText.replace('-', ''))}
                                        </span>
                                      ) : isNegative ? (
                                        <span className="text-rose-600 font-bold">
                                          Excedido por {cleanRemaining(remainingText.replace('-', ''))}
                                        </span>
                                      ) : (
                                        <span className="text-amber-800 font-bold">
                                          Faltan {cleanRemaining(remainingText)}
                                        </span>
                                      )}
                                    </p>
                                  )}
                                </div>
                              );
                            })}
                          {(can('plans.state') || can('plans.replace') || can('plans.delete')) && (
                            <div className="sm-row-actions pt-2 border-t">
                              {can('plans.state') && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    void mutate(
                                      `/plans/${e.plan.id_plan}/state`,
                                      { estado: e.plan.estado === 'ACTIVO' ? 'INACTIVO' : 'ACTIVO' },
                                      'PUT'
                                    )
                                  }
                                  className={`px-2.5 py-1 text-xs font-semibold rounded-md border transition-colors ${e.plan.estado === 'ACTIVO' ? 'text-slate-700 bg-white border-slate-300 hover:bg-slate-50 shadow-xs' : 'text-emerald-700 bg-emerald-50 border-emerald-300 hover:bg-emerald-100 shadow-xs'}`}
                                >
                                  {e.plan.estado === 'ACTIVO' ? 'Desactivar plan' : 'Activar plan'}
                                </button>
                              )}
                              {can('plans.replace') && e.plan.estado === 'ACTIVO' && (
                                <button
                                  type="button"
                                  onClick={() => open('plans', e.plan, e.plan.id_plan)}
                                  className="px-2.5 py-1 text-xs font-semibold rounded-md text-blue-700 bg-blue-50 border border-blue-200 hover:bg-blue-100 transition-colors shadow-xs"
                                >
                                  Sustituir estrategia
                                </button>
                              )}
                              {deleteButton('plans', e.plan.id_plan, e.plan.nombre_plan)}
                            </div>
                          )}

                        </article>
                      );
                    })}
                  </div>
                )}
              </Paginated>
            ) : (
              <section className="sm-card">
                <EmptyState
                  title={search.trim() || record || filter !== 'all' ? 'Sin coincidencias' : 'Aún no hay planes'}
                />
              </section>
            ))}
          {tab === 'orders' && (
            <Table
              pagination={pagination}
              title="Órdenes registradas"
              layout="orders"
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
                    <div>
                      <div className="sm-row-actions">
                        {o.estado === 'PENDIENTE' && (
                          <>
                            {can('orders.complete') &&
                              button(
                                'Completar',
                                () => open('complete', undefined, o.id_ordm),
                                meters.size > 1
                              )}
                            {can('orders.cancel') &&
                              button('Cancelar', () => setConfirmCancel(o.id_ordm))}
                          </>
                        )}
                        {o.estado !== 'REALIZADA' &&
                          deleteButton('orders', o.id_ordm, `orden #${o.id_ordm}`)}
                      </div>
                      {o.estado === 'PENDIENTE' && can('orders.complete') && meters.size > 1 && (
                        <p className="sm-order-action-note text-xs text-red-700">
                          Requiere detalle de ejecución por medidor.
                        </p>
                      )}
                    </div>,
                  ];
                })}
            />
          )}
          {tab === 'audit' && (
            <AuditHistory
              pagination={pagination}
              filtered={!!(search.trim() || record)}
              rows={data.audit}
              selectRecord={selectRecord}
              matches={matches}
              recordLink={(id, label) => recordLink('audit', id, label)}
            />
          )}
        </>
      )}
    </Workspace>
  );
}
