import {
  Bell,
  Boxes,
  CalendarDays,
  ClipboardList,
  Gauge,
  History,
  LayoutDashboard,
  Package,
  Ruler,
  SlidersHorizontal,
  Timer,
  ShieldCheck,
} from 'lucide-react';

const modules = {
  dashboard: [
    'Panel de mantenimiento',
    'Consulta el estado de los activos, planes y servicios.',
    LayoutDashboard,
  ],
  assets: ['Activos ERP', 'Consulta los equipos incluidos en mantenimiento desde el ERP.', Boxes],
  meters: ['Medidores', 'Controla las últimas lecturas de los equipos.', Gauge, 'Nuevo medidor'],
  readings: [
    'Historial de lecturas',
    'Consulta los valores registrados y conserva la trazabilidad de cada medidor.',
    Timer,
    'Registrar lectura',
  ],
  plans: [
    'Planes de mantenimiento',
    'Configura frecuencias, reglas combinadas y vigencias por activo.',
    CalendarDays,
    'Nuevo plan',
  ],
  orders: [
    'Órdenes de mantenimiento',
    'Programa servicios, registra su ejecución y consulta los repuestos utilizados.',
    ClipboardList,
    'Nueva orden',
  ],
  parts: [
    'Repuestos',
    'Administra el catálogo y sus costos de referencia.',
    Package,
    'Nuevo repuesto',
  ],
  alerts: [
    'Alertas de mantenimiento',
    'Identifica los planes próximos, vencidos o que requieren revisión.',
    Bell,
  ],
  audit: [
    'Historial de actividad',
    'Consulta las operaciones registradas en esta conexión.',
    History,
  ],
  types: [
    'Tipos de mantenimiento',
    'Define el catálogo de servicios para los planes.',
    SlidersHorizontal,
    'Nuevo tipo',
  ],
  units: [
    'Unidades de control',
    'Configura las unidades de medidor y de calendario.',
    Ruler,
    'Nueva unidad',
  ],
  roles: ['Roles y permisos', 'Configura el acceso a SisMant por rol y empresa.', ShieldCheck],
} as const;
export type ModuleKey = keyof typeof modules;
export const moduleInfo: Record<ModuleKey, readonly [string, string, typeof Gauge, string?]> =
  modules;
export const titles = Object.fromEntries(
  Object.entries(modules).map(([key, [title]]) => [key, title])
);
export const navigation = [
  {
    label: 'Operación',
    links: [
      { key: 'dashboard', label: 'Resumen' },
      { key: 'assets', label: 'Activos ERP' },
      { key: 'meters', label: 'Medidores' },
      { key: 'readings', label: 'Lecturas' },
      { key: 'plans', label: 'Planes' },
      { key: 'orders', label: 'Órdenes' },
      { key: 'parts', label: 'Repuestos' },
    ],
  },
  {
    label: 'Seguimiento',
    links: [
      { key: 'alerts', label: 'Alertas' },
      { key: 'audit', label: 'Historial' },
    ],
  },
  {
    label: 'Configuración',
    links: [
      { key: 'types', label: 'Tipos de mantenimiento' },
      { key: 'units', label: 'Unidades' },
      { key: 'roles', label: 'Roles y permisos' },
    ],
  },
].map(group => ({
  ...group,
  links: group.links.map(link => ({ ...link, icon: modules[link.key as ModuleKey][2] })),
}));
export const labels: Record<string, string> = {
  ACTIVO: 'Activo',
  AL_DIA: 'Al día',
  PROXIMO: 'Próximo',
  VENCIDO: 'Vencido',
  SIN_LECTURA: 'Sin lectura',
  CONFIGURACION_INVALIDA: 'Revisar reglas o detalle por medidor',
  INACTIVO: 'Inactivo',
  FUERA_VIGENCIA: 'Fuera de vigencia',
  PENDIENTE: 'Pendiente',
  REALIZADA: 'Realizada',
  CANCELADO: 'Cancelado',
};
export const operations: Record<string, string> = {
  'reading.update': 'Lectura corregida',
  'roles.update.technician': 'Permisos de Operador actualizados',
  'roles.update.viewer': 'Permisos de Consulta actualizados',
  'units.create': 'Unidad creada',
  'units.update': 'Unidad actualizada',
  'types.create': 'Tipo creado',
  'types.update': 'Tipo actualizado',
  'parts.create': 'Repuesto creado',
  'parts.update': 'Repuesto actualizado',
  'meter.create': 'Medidor creado',
  'meter.update': 'Medidor actualizado',
  'reading.create': 'Lectura registrada',
  'plan.create': 'Plan creado',
  'plan.replace': 'Estrategia sustituida',
  'plan.state': 'Estado del plan actualizado',
  'order.create': 'Orden creada',
  'order.complete': 'Servicio realizado',
  'order.cancel': 'Orden cancelada',
};
