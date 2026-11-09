import { modules } from '../../app/moduleRegistry';
export const nav = modules.map(module => module.label);
export const guideSteps = [
  {
    id: 'configuracion',
    title: 'Configuración',
    text: 'Define los tipos de mantenimiento y confirma las unidades de control.',
  },
  {
    id: 'activo',
    title: 'Activo',
    text: 'Registra el equipo o vehículo que requiere seguimiento.',
  },
  {
    id: 'medidor',
    title: 'Medidor',
    text: 'Asocia uno o varios medidores de horas o kilómetros al activo.',
  },
  {
    id: 'lectura-inicial',
    title: 'Lectura inicial',
    text: 'Carga el valor base para calcular vencimientos reales.',
  },
  {
    id: 'plan',
    title: 'Plan',
    text: 'Crea el mantenimiento con frecuencia, unidad, medidor y alerta anticipada.',
  },
  {
    id: 'nueva-lectura',
    title: 'Nueva lectura',
    text: 'Actualiza el contador cuando el equipo avance en uso.',
  },
  {
    id: 'alerta',
    title: 'Alerta',
    text: 'Revisa próximos y vencidos desde el dashboard o alertas.',
  },
  {
    id: 'orden',
    title: 'Orden',
    text: 'Programa la intervención desde el plan correspondiente.',
  },
  {
    id: 'ejecucion',
    title: 'Ejecución',
    text: 'Registra fecha, lectura real y repuestos utilizados.',
  },
  {
    id: 'historial',
    title: 'Historial',
    text: 'Consulta órdenes realizadas y cambios conservados.',
  },
];
