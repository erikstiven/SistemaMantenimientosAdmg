import { useEffect, useState } from 'react';
import { businessDay } from '../../../../shared/maintenance-evaluation';
import { moduleInfo, type ModuleKey } from '../relational-labels';

export function maintenanceHref(tab: ModuleKey, params: Record<string, string> = {}) {
  const query = new URLSearchParams({ modulo: tab, ...params });
  return window.location.pathname + '?' + query;
}

export function useMaintenanceLocation() {
  const [query, setQuery] = useState(() => new URLSearchParams(window.location.search));
  useEffect(() => {
    const sync = () => setQuery(new URLSearchParams(window.location.search));
    window.addEventListener('popstate', sync);
    return () => window.removeEventListener('popstate', sync);
  }, []);
  function visit(href: string, replace = false) {
    if (href === window.location.pathname + window.location.search) return;
    if (replace) window.history.replaceState(null, '', href);
    else window.history.pushState(null, '', href);
    setQuery(new URLSearchParams(window.location.search));
  }
  function change(params: Record<string, string>, replace = false) {
    const next = new URLSearchParams(window.location.search);
    for (const [key, value] of Object.entries(params)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    visit(window.location.pathname + (next.size ? '?' + next : ''), replace);
  }
  const module = query.get('modulo') ?? 'dashboard';
  const date = query.get('fecha') ?? '';
  const page = Number(query.get('pagina'));
  return {
    tab: (Object.prototype.hasOwnProperty.call(moduleInfo, module)
      ? module
      : 'dashboard') as ModuleKey,
    search: query.get('q') ?? '',
    filter: query.get('estado') ?? 'all',
    record: query.get('registro') ?? '',
    meter: query.get('medidor') ?? '',
    readingType: query.get('tipo') ?? '',
    asset: query.get('activo') ?? '',
    readingOrder: query.get('orden') === 'asc' ? ('ascending' as const) : ('descending' as const),
    assetOrder: query.get('orden') === 'desc' ? ('descending' as const) : ('ascending' as const),
    assetSortByStatus: query.get('columna') === 'mantenimiento',
    connection: query.get('conexion') ?? '',
    view: query.get('vista') ?? '',
    day:
      /^\d{4}-\d{2}-\d{2}$/.test(date) &&
      Number.isFinite(Date.parse(date)) &&
      new Date(date).toISOString().slice(0, 10) === date
        ? date
        : businessDay(),
    page: Number.isSafeInteger(page) && page > 0 ? page : 1,
    visit,
    change,
  };
}
