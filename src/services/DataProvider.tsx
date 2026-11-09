import type { ReactNode } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { MaintenanceState, StateKey, User } from '../../shared/state';
import { initialState } from '../../shared/state';
import { LoginPage } from '../modules/auth/pages/LoginPage';
import { api, ApiError, apiMode } from './api';
import { DataContext } from './dataContext';
import { readLocal, writeLocal } from './localStorage';
import { downloadJson } from '../utils/download';

function loadLocal() {
  try {
    return readLocal(localStorage);
  } catch {
    return { data: initialState(true), issues: ['almacenamiento no disponible'], backup: {} };
  }
}
export function DataProvider({ children }: { children: ReactNode }) {
  const [local] = useState(() =>
    apiMode ? { data: initialState(), issues: [], backup: {} } : loadLocal()
  );
  const [data, setData] = useState<MaintenanceState>(local.data);
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(!apiMode);
  const [needsLogin, setNeedsLogin] = useState(false);
  const [error, setError] = useState(
    local.issues.length
      ? 'Se detectaron datos locales dañados: ' +
          local.issues.join(', ') +
          '. Descarga un respaldo antes de continuar con los datos recuperados.'
      : ''
  );
  const [saving, setSaving] = useState(false);
  const revision = useRef(0);
  const confirmed = useRef(data);
  const latest = useRef(data);
  const flight = useRef(false);
  const blocked = useRef(local.issues.length > 0);
  latest.current = data;
  const load = useCallback(async () => {
    setReady(false);
    setError('');
    blocked.current = false;
    try {
      const identity = await api.me();
      const snapshot = await api.load();
      revision.current = snapshot.revision;
      confirmed.current = snapshot.data;
      latest.current = snapshot.data;
      setData(snapshot.data);
      setUser(identity);
      setNeedsLogin(false);
      setReady(true);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) setNeedsLogin(true);
      else setError(error instanceof Error ? error.message : 'No se pudieron cargar los datos');
    }
  }, []);
  useEffect(() => {
    if (apiMode) void load();
  }, [load]);
  const update = useCallback(
    <K extends StateKey>(
      key: K,
      action: (previous: MaintenanceState[K]) => MaintenanceState[K]
    ) => {
      if (
        blocked.current ||
        (apiMode &&
          (user?.role === 'viewer' ||
            (user?.role !== 'admin' && ['general-settings', 'maintenance-types'].includes(key))))
      )
        return;
      setData(previous => ({ ...previous, [key]: action(previous[key]) }));
    },
    [user]
  );
  useEffect(() => {
    if (!ready || blocked.current || data === confirmed.current) return;
    if (!apiMode) {
      try {
        writeLocal(localStorage, data);
        confirmed.current = data;
      } catch {
        blocked.current = true;
        setError(
          'No se pudieron guardar los datos locales. Revisa los datos y el espacio disponible antes de continuar.'
        );
      }
      return;
    }
    if (flight.current || blocked.current) return;
    // Serialize writes, coalescing edits made while a request is in flight.
    const timer = setTimeout(async () => {
      flight.current = true;
      setSaving(true);
      try {
        while (latest.current !== confirmed.current) {
          const pending = latest.current;
          const snapshot = await api.save({ data: pending, revision: revision.current });
          revision.current = snapshot.revision;
          if (latest.current === pending) {
            confirmed.current = snapshot.data;
            latest.current = snapshot.data;
            setData(snapshot.data);
          } else confirmed.current = pending;
        }
        setError('');
      } catch (error) {
        blocked.current = true;
        setError(
          (error instanceof Error ? error.message : 'Error al guardar') +
            '. Los cambios pendientes siguen en pantalla. Recarga los datos para continuar.'
        );
      } finally {
        flight.current = false;
        setSaving(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [data, ready]);
  useEffect(() => {
    const guard = (event: BeforeUnloadEvent) => {
      if (apiMode && latest.current !== confirmed.current) event.preventDefault();
    };
    window.addEventListener('beforeunload', guard);
    return () => window.removeEventListener('beforeunload', guard);
  }, []);
  if (needsLogin) return <LoginPage onLogin={() => void load()} />;
  if (!ready)
    return (
      <main className="p-8">
        <p role={error ? 'alert' : 'status'}>{error || 'Cargando datos…'}</p>
        {error && <button onClick={() => void load()}>Reintentar</button>}
      </main>
    );
  return (
    <DataContext.Provider
      value={{
        data,
        update,
        canEdit: !apiMode || user?.role !== 'viewer',
        canConfigure: !apiMode || user?.role === 'admin',
      }}
    >
      {apiMode && (
        <div className="flex justify-between bg-slate-900 px-5 py-2 text-sm text-white">
          <span>
            {user?.connectionLabel} · {user?.username} ·{' '}
            {user?.role === 'viewer' ? 'Solo lectura' : user?.role} ·{' '}
            {saving ? 'Guardando…' : error ? 'Cambios pendientes' : 'Sincronizado'}
          </span>
          <button
            disabled={saving || data !== confirmed.current}
            onClick={async () => {
              try {
                await api.logout();
                setUser(null);
                const empty = initialState();
                setData(empty);
                latest.current = empty;
                confirmed.current = empty;
                revision.current = 0;
                blocked.current = false;
                setError('');
                setNeedsLogin(true);
                setReady(false);
              } catch (error) {
                setError(error instanceof Error ? error.message : 'No se pudo cerrar la sesión');
              }
            }}
          >
            Cerrar sesión
          </button>
        </div>
      )}
      {error && (
        <div role="alert" className="bg-red-50 p-4 text-red-800">
          {error}{' '}
          {apiMode && (
            <>
              <button
                className="underline"
                onClick={() => downloadJson(data, 'sismant-cambios-pendientes.json')}
              >
                Descargar cambios pendientes
              </button>{' '}
              ·{' '}
              <button className="underline" onClick={() => void load()}>
                Descartar pendientes y recargar servidor
              </button>
            </>
          )}
        </div>
      )}
      {error && !apiMode && (
        <div className="bg-amber-50 p-4">
          <button
            className="underline"
            onClick={() =>
              downloadJson({ backup: local.backup, recovered: data }, 'sismant-respaldo-local.json')
            }
          >
            Descargar respaldo local
          </button>{' '}
          ·{' '}
          <button
            className="underline"
            onClick={() => {
              blocked.current = false;
              setError('');
              setData({ ...data });
            }}
          >
            Continuar con los datos recuperados y reintentar guardado
          </button>
        </div>
      )}
      <fieldset disabled={Boolean(error)} className="contents">
        {children}
      </fieldset>
    </DataContext.Provider>
  );
}
