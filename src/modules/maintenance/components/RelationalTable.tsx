import type { ReactNode } from 'react';
import { EmptyState } from '../../../components/Feedback';
import { labels } from '../relational-labels';

export function Status({ value }: { value: string }) {
  const tone = ['VENCIDO', 'CONFIGURACION_INVALIDA'].includes(value)
    ? 'error'
    : ['PROXIMO', 'PENDIENTE', 'SIN_LECTURA'].includes(value)
      ? 'warning'
      : ['AL_DIA', 'REALIZADA', 'ACTIVO'].includes(value)
        ? 'success'
        : 'neutral';
  return <span className={`sm-status sm-status-${tone}`}>{labels[value] ?? value}</span>;
}

export function Table({
  headers,
  rows,
  title = 'Registros',
  filtered,
}: {
  headers: string[];
  rows: ReactNode[][];
  title?: string;
  filtered?: boolean;
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
        <div className="sm-table-scroll" role="region" aria-label={title} tabIndex={0}>
          <table className="sm-table" aria-label={title}>
            <thead>
              <tr>
                {headers.map(h => (
                  <th scope="col" key={h}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i}>
                  {row.map((cell, j) => (
                    <td key={j}>{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
