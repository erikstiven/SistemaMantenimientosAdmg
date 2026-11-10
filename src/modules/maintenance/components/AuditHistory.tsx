import type { ReactNode } from 'react';
import type { AuditRow } from '../../../../shared/relational';
import { labels, operations } from '../relational-labels';
import { Table } from './RelationalTable';
import type { Pagination } from './Pagination';

const dateTime = new Intl.DateTimeFormat('es-EC', {
  dateStyle: 'short',
  timeStyle: 'medium',
  timeZone: 'America/Guayaquil',
});
const modules: Record<string, string> = {
  assets: 'Activos',
  meter: 'Medidores',
  meters: 'Medidores',
  reading: 'Lecturas',
  plan: 'Planes',
  plans: 'Planes',
  order: 'Órdenes',
  orders: 'Órdenes',
  parts: 'Repuestos',
  units: 'Unidades',
  types: 'Tipos de mantenimiento',
  roles: 'Roles y permisos',
};
const actions: Record<string, string> = {
  create: 'Crear',
  update: 'Editar',
  delete: 'Eliminar',
  state: 'Cambiar estado',
  replace: 'Sustituir',
  complete: 'Completar',
  cancel: 'Cancelar',
  void: 'Anular',
};
const fields: Record<string, string> = {
  act_cod_act: 'Código interno',
  act_usa_mant: 'Mantenimiento',
  act_fcmp_act: 'Fecha de compra',
  nombre_medidor: 'Medidor',
  nombre_plan: 'Plan',
  id_activo: 'ID del activo',
  id_plan: 'ID del plan',
  id_repu: 'ID del repuesto',
  id_um: 'ID de la unidad',
  id_medidor: 'ID del medidor',
  id_tima: 'ID del tipo',
  id_ordm: 'ID de la orden',
  id_lectura: 'ID de la lectura',
};

function stateValue(value: unknown, key: string): ReactNode {
  if (value == null || value === '') return '—';
  if (key === 'act_usa_mant') return value === 'S' ? 'Activo' : 'Inactivo';
  if (typeof value === 'boolean') return value ? 'Sí' : 'No';
  if (Array.isArray(value))
    return value.length ? (
      <ol className="sm-audit-list">
        {value.map((entry, index) => (
          <li key={index}>{stateValue(entry, '')}</li>
        ))}
      </ol>
    ) : (
      '—'
    );
  if (typeof value === 'object') return <AuditState state={value as Record<string, unknown>} />;
  return labels[String(value)] ?? String(value);
}

function AuditState({ state }: { state?: Record<string, unknown> | null }) {
  if (!state) return <p>—</p>;
  return (
    <dl className="sm-audit-fields">
      {Object.entries(state).map(([key, value]) => (
        <div key={key}>
          <dt>{fields[key] ?? key.replace(/_/g, ' ')}</dt>
          <dd>{stateValue(value, key)}</dd>
        </div>
      ))}
    </dl>
  );
}

export function AuditHistory({
  rows,
  pagination,
  selectRecord,
  matches,
  recordLink,
  filtered,
}: {
  rows: AuditRow[];
  pagination: Pagination;
  selectRecord: (id: string) => boolean;
  matches: (...values: unknown[]) => boolean;
  recordLink: (id: string, label: string) => ReactNode;
  filtered: boolean;
}) {
  return (
    <Table
      pagination={pagination}
      title="Operaciones registradas"
      filtered={filtered}
      headers={['Fecha y hora', 'Módulo', 'Acción', 'Registro', 'Descripción', 'Usuario']}
      rows={rows.flatMap(row => {
        const [moduleKey, actionKey] = row.operation.split('.');
        const module = modules[moduleKey] ?? moduleKey;
        const action = actions[actionKey] ?? actionKey;
        const description = operations[row.operation] ?? row.operation;
        const state = row.after_state ?? row.before_state;
        const name = state?.nombre_plan ?? state?.nombre_medidor ?? state?.nombre;
        const user = row.user_name || 'Usuario sin nombre';
        const date = dateTime.format(new Date(row.created_at));
        if (
          !selectRecord(row.id) ||
          !matches(date, module, action, description, row.entity_id, name, user)
        )
          return [];
        return [
          [
            <time dateTime={row.created_at}>{date}</time>,
            module,
            action,
            recordLink(
              row.id,
              [row.entity_id ? `#${row.entity_id}` : '', name].filter(Boolean).join(' · ') ||
                'Ver registro'
            ),
            <>
              {description}
              {(row.before_state || row.after_state) && (
                <details className="sm-audit-details">
                  <summary>Ver cambios</summary>
                  <div className="sm-audit-states">
                    {(
                      [
                        ['Antes', row.before_state],
                        ['Después', row.after_state],
                      ] as const
                    ).map(([title, value]) => (
                      <div key={title}>
                        <strong>{title}</strong>
                        <AuditState state={value} />
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </>,
            user,
          ],
        ];
      })}
    />
  );
}
