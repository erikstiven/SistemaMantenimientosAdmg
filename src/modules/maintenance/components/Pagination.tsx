import type { ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export type Pagination = { page: number; onPage: (page: number) => void };
const pageSize = 12;
export function Paginated<T>({
  rows,
  pagination,
  children,
}: {
  rows: T[];
  pagination?: Pagination;
  children: (rows: T[]) => ReactNode;
}) {
  const total = Math.max(1, Math.ceil(rows.length / pageSize));
  const page = Math.min(pagination?.page ?? 1, total);
  return (
    <>
      {children(pagination ? rows.slice((page - 1) * pageSize, page * pageSize) : rows)}
      {pagination && total > 1 && (
        <nav aria-label="Paginación" className="flex flex-wrap items-center justify-end gap-2 p-3">
          <button
            type="button"
            className="sm-secondary"
            disabled={page === 1}
            onClick={() => pagination.onPage(page - 1)}
            aria-label="Página anterior"
          >
            <ChevronLeft size={16} aria-hidden />
          </button>
          <span className="px-2 text-sm" aria-live="polite">
            Página {page} de {total}
          </span>
          <button
            type="button"
            className="sm-secondary"
            disabled={page === total}
            onClick={() => pagination.onPage(page + 1)}
            aria-label="Página siguiente"
          >
            <ChevronRight size={16} aria-hidden />
          </button>
        </nav>
      )}
    </>
  );
}
