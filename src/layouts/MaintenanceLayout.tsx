import type { ReactNode } from 'react';
import {
  initialSettings,
  initialTypes,
  seedA,
  seedHistory,
  seedM,
  seedO,
  seedP,
  seedR,
} from '../../shared/seed';
import { nav } from '../../src/modules/maintenance/config';
import { MaintenanceDialog } from '../modules/maintenance/components/MaintenanceDialog';
import { useMaintenance } from '../modules/maintenance/context';
import {
  Activity,
  Bell,
  Boxes,
  CalendarDays,
  ClipboardList,
  FlaskConical,
  Gauge,
  LayoutDashboard,
  Package,
  RotateCcw,
  Settings,
} from 'lucide-react';
import { Workspace } from '../components/Workspace';
import { businessDay } from '../../shared/maintenance-evaluation';
const icons = [
  LayoutDashboard,
  Boxes,
  Gauge,
  CalendarDays,
  ClipboardList,
  Package,
  Bell,
  FlaskConical,
  Settings,
];
const links = [
  {
    label: 'Demostración',
    links: nav.map((label, index) => ({ key: label, label, icon: icons[index] ?? Activity })),
  },
];
export function MaintenanceLayout({ children }: { children: ReactNode }) {
  const {
    page,
    setPage,
    setAssets,
    setPlans,
    setReadings,
    setOrders,
    setMeters,
    setHistory,
    setMaintTypes,
    setAppSettings,
    setItems,
    setFilter,
  } = useMaintenance();
  function resetDemo() {
    setAssets(seedA);
    setReadings(seedR);
    setPlans(seedP);
    setOrders(seedO);
    setMeters(seedM);
    setHistory(seedHistory);
    setMaintTypes(initialTypes);
    setAppSettings(initialSettings);
    setItems([
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
    ]);
    setFilter('');
  }
  return (
    <Workspace
      links={links}
      current={page}
      onNavigate={key => {
        const module = nav.find(label => label === key);
        if (module) {
          setPage(module);
          setFilter('');
        }
      }}
      context={
        <>
          <strong className="sm-demo-badge">Modo demostración</strong>
          <small>Datos locales simulados</small>
        </>
      }
      actions={
        <>
          <span className="hidden text-xs text-slate-600 md:block">
            {businessDay().split('-').reverse().join('/')}
          </span>
          <button className="sm-secondary" onClick={resetDemo}>
            <RotateCcw size={15} aria-hidden />
            Restablecer demo
          </button>
        </>
      }
      overlay={<MaintenanceDialog />}
    >
      {children}
    </Workspace>
  );
}
