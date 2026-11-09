import { Component } from 'react';
import type { ReactNode, ErrorInfo } from 'react';
import { Brand } from './Workspace';
import { Notice } from './Feedback';
import { styles } from './styles';
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('No se pudo cargar la aplicación', error, info);
  }
  render() {
    return this.state.failed ? (
      <main className="sm-standalone">
        <Brand />
        <h1 className="text-xl font-bold">No se pudo cargar la aplicación</h1>
        <Notice kind="error">Vuelve a intentarlo recargando la página.</Notice>
        <button className={styles.button} onClick={() => window.location.reload()}>
          Recargar
        </button>
      </main>
    ) : (
      this.props.children
    );
  }
}
