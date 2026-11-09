import { lazy } from 'react';
export const modules = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    Page: lazy(() => import('../modules/dashboard/pages/DashboardPage')),
  },
  {
    id: 'assets',
    label: 'Activos',
    Page: lazy(() => import('../modules/assets/pages/AssetsPage')),
  },
  {
    id: 'meters',
    label: 'Medidores y lecturas',
    Page: lazy(() => import('../modules/meters/pages/MetersPage')),
  },
  { id: 'plans', label: 'Planes', Page: lazy(() => import('../modules/plans/pages/PlansPage')) },
  {
    id: 'orders',
    label: 'Órdenes',
    Page: lazy(() => import('../modules/orders/pages/OrdersPage')),
  },
  { id: 'parts', label: 'Repuestos', Page: lazy(() => import('../modules/parts/pages/PartsPage')) },
  {
    id: 'history',
    label: 'Alertas e historial',
    Page: lazy(() => import('../modules/history/pages/HistoryPage')),
  },
  {
    id: 'simulation',
    label: 'Simulación',
    Page: lazy(() => import('../modules/simulation/pages/SimulationPage')),
  },
  {
    id: 'settings',
    label: 'Configuración',
    Page: lazy(() => import('../modules/settings/pages/SettingsPage')),
  },
];
