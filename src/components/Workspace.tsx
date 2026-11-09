import { useRef, useState, type ReactNode } from 'react';
import { Menu, Wrench, X, type LucideIcon } from 'lucide-react';

export function Brand() {
  return (
    <div className="sm-brand">
      <span className="sm-brand-mark">
        <Wrench size={22} aria-hidden />
      </span>
      <div>
        <strong>SisMant</strong>
        <small>Mantenimiento integral</small>
      </div>
    </div>
  );
}

export type WorkspaceLink = { key: string; label: string; icon: LucideIcon };
export function Workspace({
  links,
  current,
  onNavigate,
  context,
  actions,
  children,
  overlay,
}: {
  links: readonly { label: string; links: WorkspaceLink[] }[];
  current: string;
  onNavigate: (key: string) => void;
  context: ReactNode;
  actions: ReactNode;
  children: ReactNode;
  overlay?: ReactNode;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const mainRef = useRef<HTMLElement>(null);
  function navigate(key: string) {
    onNavigate(key);
    setMenuOpen(false);
    if (key !== current) {
      window.scrollTo(0, 0);
      requestAnimationFrame(() => mainRef.current?.focus({ preventScroll: true }));
    }
  }
  return (
    <div className="sm-workspace">
      <a className="sm-skip" href="#workspace-main">
        Saltar al contenido
      </a>
      <header className="sm-topbar">
        <button
          type="button"
          className="sm-menu sm-secondary"
          aria-controls="workspace-nav"
          aria-expanded={menuOpen}
          aria-label={menuOpen ? 'Cerrar menú' : 'Abrir menú'}
          onClick={() => setMenuOpen(open => !open)}
        >
          {menuOpen ? <X size={20} aria-hidden /> : <Menu size={20} aria-hidden />}
        </button>
        <div className="sm-context">{context}</div>
        <div className="sm-top-actions">{actions}</div>
      </header>
      <aside id="workspace-nav" className={`sm-sidebar ${menuOpen ? 'is-open' : ''}`}>
        <Brand />
        <nav aria-label="Módulos">
          {links.map(group => (
            <div className="sm-nav-group" key={group.label}>
              <p>{group.label}</p>
              {group.links.map(({ key, label, icon: Icon }) => (
                <button
                  type="button"
                  key={key}
                  onClick={() => navigate(key)}
                  aria-current={key === current ? 'page' : undefined}
                >
                  <Icon size={17} aria-hidden />
                  {label}
                </button>
              ))}
            </div>
          ))}
        </nav>
      </aside>
      <main id="workspace-main" className="sm-main" tabIndex={-1} ref={mainRef}>
        <div className="sm-page" key={current}>
          {children}
        </div>
      </main>
      {overlay}
    </div>
  );
}
