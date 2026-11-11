import { jsPDF } from 'jspdf';
import {
  cents,
  decimal,
  readingUnitLabel,
  type MaintenanceBootstrap,
  type OrderRow,
} from '../../../shared/relational.ts';
import type { User } from '../../../shared/state.ts';

const number = new Intl.NumberFormat('es-EC', { maximumFractionDigits: 2 });
const states = { PENDIENTE: 'Pendiente', REALIZADA: 'Realizada', CANCELADO: 'Cancelada' };

function formatDate(value: string | null) {
  if (!value) return 'Por definir';
  const [day, time] = value.split(/[T ]/);
  return [day.split('-').reverse().join('/'), time?.slice(0, 8)].filter(Boolean).join(' ');
}

export function renderOrderReport(
  data: MaintenanceBootstrap,
  order: OrderRow,
  actor: User,
  planningObservation: string | undefined
) {
  const doc = new jsPDF({ format: 'a4', unit: 'mm' });
  const margin = 18;
  const right = 192;
  const bottom = 271;
  let y = 0;
  doc.setProperties({ title: `Orden de mantenimiento #${order.id_ordm}`, creator: 'SisMant' });

  function header() {
    doc.setFillColor('#14243a');
    doc.rect(0, 0, 210, 43, 'F');
    doc.setTextColor('#b8d2ff').setFont('helvetica', 'bold').setFontSize(10);
    doc.text('SISMANT  /  MANTENIMIENTO INTEGRAL', margin, 13);
    doc.setTextColor('#ffffff').setFontSize(20);
    doc.text(`Orden de mantenimiento #${order.id_ordm}`, margin, 24);
    doc.setFontSize(11);
    doc.text(states[order.estado], margin, 34);
    y = 53;
  }

  function reserve(height: number) {
    if (y + height <= bottom) return;
    doc.addPage();
    header();
  }

  function paragraph(value: string, bold = false) {
    const font = bold ? 'bold' : 'normal';
    const color = bold ? '#254773' : '#14243a';
    doc.setFont('helvetica', font).setFontSize(11);
    const lines = doc.splitTextToSize(value, right - margin) as string[];
    for (const line of lines) {
      reserve(5.5);
      doc.setFont('helvetica', font).setFontSize(11).setTextColor(color);
      doc.text(line, margin, y);
      y += 5.5;
    }
  }

  function section(title: string) {
    reserve(24);
    doc.setDrawColor('#c6d6ec').line(margin, y - 3, right, y - 3);
    y += 3;
    paragraph(title, true);
    y += 2;
  }

  function field(label: string, value: string) {
    reserve(12);
    paragraph(label, true);
    paragraph(value.trim() || 'Sin información registrada');
    y += 2;
  }

  const plan = data.plans.find(row => row.id_plan === order.id_plan);
  const asset = data.assets.find(row => row.id_activo === plan?.id_activo);
  const rules = data.rules.filter(
    row => row.id_plan === order.id_plan && row.estado && row.id_medidor
  );
  const symbols = new Set(
    rules.map(rule => {
      const code = data.units.find(unit => unit.id_um === rule.id_um)?.codigo;
      return code ? readingUnitLabel(code) : '';
    })
  );
  const [unit] = symbols.size === 1 ? symbols : [];
  const reading = (value: string | null) =>
    value == null
      ? 'Sin lectura registrada'
      : [number.format(Number(value)), unit].filter(Boolean).join(' ');

  header();
  field(
    'Conexión / Empresa / Sucursal',
    [
      actor.connectionLabel || actor.connectionId,
      asset?.empresa_id ?? actor.companyId,
      asset?.sucursal_id ?? actor.branchId,
    ]
      .filter(value => value != null)
      .join(' / ')
  );
  field('Plan de mantenimiento', plan?.nombre_plan ?? `Plan #${order.id_plan}`);
  if (plan) {
    const type = data.types.find(item => item.id_tima === plan.id_tima);
    if (type) field('Tipo de mantenimiento', type.nombre);
  }
  if (asset) field('Activo', [asset.clave || asset.act_cod_act, asset.nombre].join(' - '));
  section('Programación');
  field('Fecha programada', formatDate(order.fecha_programada));
  field('Lectura programada', reading(order.valor_programado));
  field(
    'Descripción de la orden',
    planningObservation ?? 'Sin descripción de programación disponible'
  );

  if (order.estado === 'REALIZADA') {
    section('Ejecución del servicio');
    field('Fecha y hora de ejecución', formatDate(order.fecha_realizada));
    field('Lectura del servicio', reading(order.valor_realizado));
    field('Observación de ejecución', order.observacion);
    if (data.permissions.includes('parts.read')) {
      const parts = new Map(data.parts.map(part => [part.id_repu, part]));
      const details = data.details.filter(item => item.id_ordm === order.id_ordm);
      section('Repuestos y costos');
      for (const detail of details) {
        const part = parts.get(detail.id_repu);
        field(
          part ? `${part.codigo} - ${part.nombre}` : `Repuesto #${detail.id_repu}`,
          `Cantidad ${number.format(Number(detail.cantidad))} · Costo unitario ${detail.costo_unitario} · Subtotal ${detail.subtotal}`
        );
      }
      if (!details.length) paragraph('Sin repuestos registrados.');
      field(
        'Total de repuestos',
        decimal(details.reduce((total, detail) => total + cents(detail.subtotal), 0n))
      );
    }
  }

  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page++) {
    doc.setPage(page);
    doc.setDrawColor('#c6d6ec').line(margin, 280, right, 280);
    doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor('#52677f');
    doc.text(`SisMant  /  Orden #${order.id_ordm}`, margin, 286);
    doc.text(`Página ${page} de ${pageCount}`, right, 286, { align: 'right' });
  }
  return Buffer.from(doc.output('arraybuffer'));
}
