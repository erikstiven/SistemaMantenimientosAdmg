import {
  meterCodeMaxLength,
  meterNameMaxLength,
  type RelationalData,
} from '../../../shared/relational';

export function suggestMeterText(data: RelationalData, assetId: unknown, unitId: unknown) {
  const asset = data.assets.find(item => item.id_activo === assetId);
  const unit = data.units.find(item => item.id_um === unitId);
  if (!asset || !unit) return { nombre_medidor: '', codigo: '' };

  const assetName = asset.nombre.trim().toLocaleUpperCase('es-EC');
  const unitName = unit.nombre.trim().toLocaleUpperCase('es-EC');
  const codePart = (text: string) => text.replace(/[^\p{L}\p{N}]+/gu, '_').replace(/^_+|_+$/g, '');
  const assetCode = codePart(assetName) || asset.act_cod_act;
  const unitCode = codePart(unitName) || unit.codigo;
  const taken = new Set(data.meters.filter(m => m.id_activo === assetId).map(m => m.codigo));
  const code = (suffix = '') => {
    const available = meterCodeMaxLength - 'MEDIDOR__'.length - suffix.length;
    const unitPart = unitCode.slice(0, Math.min(unitCode.length, available - 1)).replace(/_+$/, '');
    const assetPart = assetCode.slice(0, available - unitPart.length).replace(/_+$/, '');
    return `MEDIDOR_${unitPart}_${assetPart}${suffix}`;
  };
  let codigo = code();
  for (let i = 2; taken.has(codigo); i++) codigo = code(`_${i}`);
  return {
    nombre_medidor: `MEDIDOR DE ${unitName} PARA ${assetName}`
      .slice(0, meterNameMaxLength)
      .trimEnd(),
    codigo,
  };
}

export type MeterTextField = keyof ReturnType<typeof suggestMeterText>;
