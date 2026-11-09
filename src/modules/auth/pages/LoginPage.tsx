import type { FormEvent } from 'react';
import { useEffect, useState } from 'react';
import {
  ArrowRight,
  Database,
  Eye,
  EyeOff,
  Gauge,
  LoaderCircle,
  LockKeyhole,
  RotateCw,
  UserRound,
} from 'lucide-react';
import { styles } from '../../../components/styles';
import { Brand } from '../../../components/Workspace';
import { Notice } from '../../../components/Feedback';
import { api } from '../../../services/api';
export function LoginPage({
  onLogin,
  preferredConnection,
}: {
  onLogin: () => void;
  preferredConnection?: string;
}) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [connections, setConnections] = useState<{ id: string; label: string }[]>([]);
  const [connectionId, setConnectionId] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [loading, setLoading] = useState(true);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    let active = true;
    setError('');
    setLoading(true);
    api
      .connections()
      .then(items => {
        if (active) {
          setConnections(items);
          setConnectionId(
            items.find(item => item.id === preferredConnection)?.id ?? items[0]?.id ?? ''
          );
        }
      })
      .catch(error => {
        if (active)
          setError(error instanceof Error ? error.message : 'No se pudieron cargar las conexiones');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [attempt, preferredConnection]);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api.login(connectionId, username, password);
      onLogin();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Error de acceso');
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="sm-login">
      <section className="sm-login-aside">
        <Brand />
        <div className="sm-login-story">
          <p>CONTROL OPERATIVO</p>
          <h2>Mantenimiento de equipos, en un solo lugar.</h2>
          <p>
            Consulta tus activos, planifica servicios y conserva el historial de cada intervención.
          </p>
        </div>
        <Gauge className="sm-login-gauge" aria-hidden />
        <div className="sm-login-caption">
          <span /> GESTIÓN DE ACTIVOS Y SERVICIOS
        </div>
      </section>
      <section className="sm-login-content">
        <form onSubmit={submit} className="sm-login-form">
          <div className="sm-login-mobile-brand">
            <Brand />
          </div>
          <span className="sm-module-icon">
            <LockKeyhole size={22} aria-hidden />
          </span>
          <div>
            <h1>Inicia sesión</h1>
            <p>Selecciona tu conexión e ingresa con tus credenciales del ERP.</p>
          </div>
          <label>
            Conexión ERP
            <span className="sm-input-icon">
              <Database size={17} aria-hidden />
              <select
                required
                disabled={busy || !connections.length}
                className={styles.input}
                value={connectionId}
                onChange={event => {
                  setConnectionId(event.target.value);
                  setPassword('');
                  setError('');
                }}
              >
                {!connections.length && (
                  <option value="">
                    {loading ? 'Cargando conexiones…' : 'No hay conexiones disponibles'}
                  </option>
                )}
                {connections.map(connection => (
                  <option key={connection.id} value={connection.id}>
                    {connection.label}
                  </option>
                ))}
              </select>
            </span>
          </label>
          <label>
            Usuario
            <span className="sm-input-icon">
              <UserRound size={17} aria-hidden />
              <input
                required
                disabled={busy}
                autoComplete="username"
                className={styles.input}
                value={username}
                onChange={e => setUsername(e.target.value)}
              />
            </span>
          </label>
          <div className="sm-password-field">
            <label htmlFor="login-password">Contraseña</label>
            <div className="sm-input-icon sm-password">
              <LockKeyhole size={17} aria-hidden />
              <input
                id="login-password"
                required
                disabled={busy}
                type={visible ? 'text' : 'password'}
                autoComplete="current-password"
                className={styles.input}
                value={password}
                onChange={e => setPassword(e.target.value)}
              />
              <button
                type="button"
                className="sm-password-toggle"
                aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                onClick={() => setVisible(value => !value)}
              >
                {visible ? <EyeOff size={18} aria-hidden /> : <Eye size={18} aria-hidden />}
              </button>
            </div>
          </div>
          {error && <Notice kind="error">{error}</Notice>}
          {!connections.length && !loading && (
            <>
              {!error && <Notice kind="warning">No hay conexiones ERP disponibles.</Notice>}
              <button
                className="sm-secondary"
                type="button"
                onClick={() => setAttempt(value => value + 1)}
              >
                <RotateCw size={16} aria-hidden /> Reintentar conexiones
              </button>
            </>
          )}
          <button disabled={busy || !connectionId} className={styles.button}>
            {busy ? (
              <>
                Accediendo… <LoaderCircle className="sm-spinner" size={17} aria-hidden />
              </>
            ) : (
              <>
                Ingresar <ArrowRight size={17} aria-hidden />
              </>
            )}
          </button>
        </form>
      </section>
    </main>
  );
}
