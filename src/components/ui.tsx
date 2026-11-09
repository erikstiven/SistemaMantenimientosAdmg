import { styles } from './styles';
export function Tag({ status }: { status: string }) {
  return (
    <span
      className={`rounded-full px-3 py-1 text-xs font-semibold ${status === 'Vencido' ? 'bg-red-100 text-red-700' : status === 'Próximo' || status === 'Pendiente' ? 'bg-amber-100 text-amber-700' : status === 'Realizada' || status === 'Al día' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}
    >
      {status}
    </span>
  );
}
export const PageTitle = (heading: string, desc: string, button?: string, action?: () => void) => (
  <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
    <div>
      <h1 className="text-2xl font-bold text-slate-900">{heading}</h1>
      <p className="mt-1 text-sm text-slate-500">{desc}</p>
    </div>
    {button && (
      <button className={styles.button} onClick={action}>
        + {button}
      </button>
    )}
  </div>
);
export const TableHeader = (cols: string[]) => (
  <thead className="bg-slate-50">
    <tr>
      {cols.map(c => (
        <th
          key={c}
          className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"
        >
          {c}
        </th>
      ))}
    </tr>
  </thead>
);
