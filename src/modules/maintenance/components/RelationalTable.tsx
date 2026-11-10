import type { ReactNode } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { EmptyState } from '../../../components/Feedback';
import { labels } from '../relational-labels';
import { Paginated, type Pagination } from './Pagination';

export function Status({ value }: { value: string }) {
  const tone = ['VENCIDO', 'CONFIGURACION_INVALIDA', 'ANULADA'].includes(value)
    ? 'error'
    : ['PROXIMO', 'PENDIENTE', 'SIN_LECTURA'].includes(value)
      ? 'warning'
      : ['AL_DIA', 'REALIZADA', 'ACTIVO', 'VALIDA'].includes(value)
        ? 'success'
        : 'neutral';
  return <span className={`sm-status sm-status-${tone}`}>{labels[value] ?? value}</span>;
}

export function Table({
  headers,
  rows,
  title = 'Registros',
  filtered,
  pagination,
  sort,
  layout,
}: {
  headers: string[];
  rows: ReactNode[][];
  title?: string;
  filtered?: boolean;
  pagination?: Pagination;
  layout?: 'readings' | 'orders' | 'assets';
  sort?: Record<string, { direction?: 'ascending' | 'descending'; toggle: () => void }>;
}) {
  return (
    <section className="sm-card">
      <div className="sm-section-heading">
        <h2>{title}</h2>
        <span>
          {rows.length} {rows.length === 1 ? 'registro' : 'registros'}
        </span>
      </div>
      {rows.length ? (
        <Paginated rows={rows} pagination={pagination}>
          {visibleRows => (
            <div className="sm-table-scroll" role="region" aria-label={title} tabIndex={0}>
              <table
                className={layout ? `sm-table sm-table-${layout}` : 'sm-table'}
                aria-label={title}
              >
                <thead>
                  <tr>
                    {headers.map(h => {
                      const column = sort?.[h];
                      const Icon =
                        column?.direction === 'ascending'
                          ? ArrowUp
                          : column?.direction === 'descending'
                            ? ArrowDown
                            : ArrowUpDown;
                      return (
                        <th scope="col" key={h} aria-sort={column?.direction}>
                          {column ? (
                            <button
                              type="button"
                              className="sm-sort-header"
                              onClick={column.toggle}
                            >
                              {h}
                              <Icon size={14} aria-hidden />
                            </button>
                          ) : (
                            h
                          )}
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {visibleRows.map((row, i) => (
                    <tr key={i}>
                      {row.map((cell, j) => (
                        <td key={j}>{cell}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Paginated>
      ) : (
        <EmptyState title={filtered ? 'Sin coincidencias' : 'Aún no hay registros'}>
          {filtered
            ? 'Prueba con otro término de búsqueda.'
            : 'Los registros de esta sección aparecerán aquí.'}
        </EmptyState>
      )}
    </section>
  );
}
