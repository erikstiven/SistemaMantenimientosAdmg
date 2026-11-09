import { useContext, useState, useMemo } from 'react';
import {
  initialSettings,
  initialTypes,
  seedA,
  seedHistory,
  seedM,
  seedO,
  seedP,
  seedR,
} from '../../../../shared/seed';
import { styles } from '../../../../src/components/styles';
import { TODAY } from '../../../../src/utils/format';
import { useSaved } from '../../../hooks/useSaved';
import { DataContext } from '../../../services/dataContext';
import { createMaintenanceEvaluator } from '../services/evaluation';
import { mutations } from '../services/mutations';
import { prepareMutation } from '../services/prepareMutation';
import type { FormDraft } from '../types';

export function useMaintenanceController() {
  const { canEdit, canConfigure, data } = useContext(DataContext)!;

  const [page, setPage] = useState('Dashboard'),
    [assets, setAssets] = useSaved('assets', seedA),
    [plans, setPlans] = useSaved('plans', seedP),
    [readings, setReadings] = useSaved('readings', seedR),
    [orders, setOrders] = useSaved('orders', seedO),
    [meters, setMeters] = useSaved('meters', seedM),
    [history, setHistory] = useSaved('history', seedHistory),
    [maintTypes, setMaintTypes] = useSaved('maintenance-types', initialTypes),
    [appSettings, setAppSettings] = useSaved('general-settings', initialSettings),
    [configSearch, setConfigSearch] = useState(''),
    [configTab, setConfigTab] = useState('tipos'),
    [items, setItems] = useSaved('items', [
      {
        name: 'Filtro de aceite',
        unit: 'Unidad',
        price: 15,
      },
      {
        name: 'Aceite 15W40',
        unit: 'Litro',
        price: 8.5,
      },
      {
        name: 'Filtro hidráulico',
        unit: 'Unidad',
        price: 30,
      },
    ]),
    [dialog, setDialog] = useState(''),
    [draft, setDraft] = useState<FormDraft>({}),
    [filter, setFilter] = useState(''),
    [detail, setDetail] = useState<number | null>(null),
    [partRows, setPartRows] = useState<
      {
        index: number;
        quantity: number;
      }[]
    >([]),
    [message, setMessage] = useState('');
  const notice = (s: string) => {
    setMessage(s);
  };
  const log = (kind: string, text: string) =>
    setHistory(h => [
      {
        id: Date.now() + Math.random(),
        kind,
        date: TODAY,
        text,
      },
      ...h,
    ]);
  const asset = (id: number) => assets.find(x => x.id === id)?.name || '—';
  const { current, ruleEval, evalPlan } = useMemo(
    () => createMaintenanceEvaluator(readings, meters, appSettings),
    [readings, meters, appSettings]
  );
  const alertCount = plans.filter(p => evalPlan(p).status === 'Vencido').length;
  const close = () => {
    setDialog('');
    setMessage('');
  };
  const begin = (key: string, data: FormDraft = {}) => {
    if ((!canEdit && key !== 'Detalle orden') || (!canConfigure && key === 'Tipo mantenimiento'))
      return;
    if (key === 'Plan' && data.alert == null) {
      setDraft({
        ...data,
        alert: appSettings.hours,
        startDate: TODAY,
      });
    } else setDraft(data);
    setPartRows([]);
    setMessage('');
    setDialog(key);
  };

  const save = () => {
    if (!canEdit || (!canConfigure && dialog === 'Tipo mantenimiento')) return;
    const action = mutations[dialog];
    if (
      action &&
      !prepareMutation(
        action,
        {
          assets,
          plans,
          readings,
          meters,
          orders,
          maintTypes,
          appSettings,
          items,
          setAssets,
          setPlans,
          setReadings,
          setMeters,
          setOrders,
          setMaintTypes,
          setAppSettings,
          setItems,
          draft,
          partRows,
          notice,
          log,
          asset,
          current,
        },
        data
      )
    )
      return;
    close();
  };
  const field = (label: string, key: keyof FormDraft, type = 'text') => (
    <label className="block text-sm font-medium text-slate-600">
      {label}
      <input
        type={type}
        className={styles.input + ' mt-1'}
        value={draft[key] ?? ''}
        onChange={e =>
          setDraft({
            ...draft,
            [key]: e.target.value,
          })
        }
      />
    </label>
  );
  const sel = (
    label: string,
    key: keyof FormDraft,
    options: {
      value: string;
      label: string;
    }[]
  ) => (
    <label className="block text-sm font-medium text-slate-600">
      {label}
      <select
        className={styles.input + ' mt-1'}
        value={draft[key] ?? ''}
        onChange={e =>
          setDraft({
            ...draft,
            [key]: e.target.value,
          })
        }
      >
        <option value="">Seleccionar</option>
        {options.map(o => (
          <option value={o.value} key={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
  const assetOptions = assets.map(a => ({
      value: String(a.id),
      label: a.name,
    })),
    units = ['Horas', 'Kilómetros', 'Días', 'Meses'].map(u => ({
      value: u,
      label: u,
    }));

  return {
    canEdit,
    canConfigure,
    page,
    setPage,
    assets,
    setAssets,
    plans,
    setPlans,
    readings,
    setReadings,
    orders,
    setOrders,
    meters,
    setMeters,
    history,
    setHistory,
    maintTypes,
    setMaintTypes,
    appSettings,
    setAppSettings,
    configSearch,
    setConfigSearch,
    configTab,
    setConfigTab,
    items,
    setItems,
    dialog,
    setDialog,
    draft,
    setDraft,
    filter,
    setFilter,
    detail,
    setDetail,
    partRows,
    setPartRows,
    message,
    setMessage,
    notice,
    log,
    asset,
    current,
    ruleEval,
    evalPlan,
    alertCount,
    close,
    begin,
    save,
    field,
    sel,
    assetOptions,
    units,
  };
}
