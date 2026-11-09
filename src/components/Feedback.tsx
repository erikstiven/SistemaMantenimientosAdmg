import type { ReactNode } from 'react';
import { AlertCircle, CheckCircle2, Inbox, Info, LoaderCircle, TriangleAlert } from 'lucide-react';

const icons = { error: AlertCircle, warning: TriangleAlert, success: CheckCircle2, info: Info };
export function Notice({
  kind = 'info',
  children,
}: {
  kind?: keyof typeof icons;
  children: ReactNode;
}) {
  const Icon = icons[kind];
  return (
    <div className={`sm-notice sm-notice-${kind}`} role={kind === 'error' ? 'alert' : 'status'}>
      <Icon size={19} aria-hidden />
      <div>{children}</div>
    </div>
  );
}

export function EmptyState({
  title = 'No hay registros',
  children,
}: {
  title?: string;
  children?: ReactNode;
}) {
  return (
    <div className="sm-empty">
      <span>
        <Inbox size={22} aria-hidden />
      </span>
      <strong>{title}</strong>
      {children && <p>{children}</p>}
    </div>
  );
}

export function Loading({ children }: { children: ReactNode }) {
  return (
    <div className="sm-loading" role="status">
      <LoaderCircle size={20} aria-hidden />
      {children}
    </div>
  );
}
