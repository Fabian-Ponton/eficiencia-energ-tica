import { annualEnergyKwh } from './calc/equipment';
import type { Bill, EnergyCarrier, Equipment } from './types';

/**
 * Varios energéticos. Un registro sin `carrier` es electricidad, así que los proyectos que ya existían no cambian.
 * Toda la auditoría eléctrica trabaja solo con `electricBills` y `electricEquipment`; los demás energéticos se calculan
 * aquí, por separado, y se suman a la electricidad únicamente en kWh equivalentes.
 */

export type BillUnit = NonNullable<Bill['unit']>;

export interface CarrierInfo {
  id: EnergyCarrier;
  label: string;
  /** Unidad en que se factura por omisión. */
  unit: BillUnit;
  /** Qué mirar en la factura. */
  hint: string;
}

export const CARRIERS: readonly CarrierInfo[] = [
  { id: 'electricidad', label: 'Electricidad', unit: 'kWh', hint: 'Factura del operador de red.' },
  {
    id: 'gas-natural',
    label: 'Gas natural',
    unit: 'm3',
    hint: 'La factura del gas trae la cantidad en m³ y el factor que la convierte a kWh (poder calorífico del periodo). Cópialo de ahí.',
  },
  { id: 'glp', label: 'Gas licuado (GLP)', unit: 'kg', hint: 'Cilindros o tanque: la cantidad en kg y el poder calorífico que indica el proveedor.' },
  { id: 'otro', label: 'Otro energético', unit: 'gal', hint: 'Diésel, gasolina, carbón… con su unidad y su factor de conversión a kWh.' },
];

export const NON_ELECTRIC_CARRIERS = CARRIERS.filter((c) => c.id !== 'electricidad');

export const carrierInfo = (id: EnergyCarrier | undefined): CarrierInfo => CARRIERS.find((c) => c.id === (id ?? 'electricidad')) ?? CARRIERS[0];

export const BILL_UNITS: readonly { id: BillUnit; label: string }[] = [
  { id: 'kWh', label: 'kWh' },
  { id: 'm3', label: 'm³' },
  { id: 'kg', label: 'kg' },
  { id: 'gal', label: 'gal' },
];

export const unitLabel = (unit: BillUnit | undefined): string => BILL_UNITS.find((u) => u.id === unit)?.label ?? 'unid.';

export const carrierOf = (record: { carrier?: EnergyCarrier }): EnergyCarrier => record.carrier ?? 'electricidad';
export const isElectric = (record: { carrier?: EnergyCarrier }): boolean => carrierOf(record) === 'electricidad';
export const isNotElectric = (record: { carrier?: EnergyCarrier }): boolean => !isElectric(record);

export const electricBills = <T extends { carrier?: EnergyCarrier }>(bills: readonly T[]): T[] => bills.filter(isElectric);
export const electricEquipment = <T extends { carrier?: EnergyCarrier }>(equipment: readonly T[]): T[] => equipment.filter(isElectric);

/**
 * Energía de una factura en kWh equivalentes. La eléctrica es su energía activa; la de otro energético es la cantidad por el
 * factor de conversión de la factura. `null` si falta la cantidad o el factor: no se inventa un valor.
 */
export function equivalentKwh(bill: Pick<Bill, 'carrier' | 'kwh' | 'quantity' | 'kwhPerUnit'>): number | null {
  if (isElectric(bill)) return Number.isFinite(bill.kwh) ? bill.kwh : null;
  const { quantity, kwhPerUnit } = bill;
  return quantity && quantity > 0 && kwhPerUnit && kwhPerUnit > 0 ? quantity * kwhPerUnit : null;
}

export interface CarrierSummary {
  carrier: EnergyCarrier;
  info: CarrierInfo;
  /** Facturas del resumen y periodos que cubren. */
  count: number;
  firstPeriod: string;
  lastPeriod: string;
  /** Cantidad en la unidad del energético (para la electricidad, los kWh). */
  quantity: number;
  unit: BillUnit;
  /** Energía en kWh equivalentes de las facturas que tienen factor de conversión. */
  kwh: number;
  costCop: number;
  /** Facturas a las que les falta la cantidad o el factor: no suman kWh. */
  missingFactor: number;
  /** Parte de los kWh equivalentes de todos los energéticos (0 a 1). */
  share: number;
  /** Costo por kWh equivalente; `null` si no hay energía o alguna factura no se pudo convertir. */
  copPerKwh: number | null;
}

/** Resumen por energético de sus últimas `months` facturas (12 por omisión). Solo aparecen los energéticos con facturas. */
export function summarizeCarriers(bills: readonly Bill[], months = 12): CarrierSummary[] {
  const rows = CARRIERS.map((info) => {
    const own = bills
      .filter((b) => !b.deletedAt && carrierOf(b) === info.id)
      .sort((a, b) => a.period.localeCompare(b.period))
      .slice(-months);
    if (!own.length) return null;
    const converted = own.map((b) => equivalentKwh(b));
    const kwh = converted.reduce<number>((total, value) => total + (value ?? 0), 0);
    const costCop = own.reduce((total, b) => total + (Number.isFinite(b.costCop) ? b.costCop : 0), 0);
    const missingFactor = converted.filter((value) => value === null).length;
    const unit = info.id === 'electricidad' ? 'kWh' : (own[own.length - 1].unit ?? info.unit);
    return {
      carrier: info.id,
      info,
      count: own.length,
      firstPeriod: own[0].period,
      lastPeriod: own[own.length - 1].period,
      quantity: info.id === 'electricidad' ? kwh : own.reduce((total, b) => total + (b.quantity ?? 0), 0),
      unit,
      kwh,
      costCop,
      missingFactor,
      share: 0,
      copPerKwh: kwh > 0 && missingFactor === 0 ? costCop / kwh : null,
    } satisfies CarrierSummary;
  }).filter((row): row is CarrierSummary => row !== null);
  const total = rows.reduce((sum, row) => sum + row.kwh, 0);
  return rows.map((row) => ({ ...row, share: total > 0 ? row.kwh / total : 0 }));
}

export interface EnergyTotals {
  kwh: number;
  costCop: number;
  /** Facturas que no se pudieron convertir a kWh: el total está incompleto mientras haya alguna. */
  missingFactor: number;
}

export const totalEnergy = (summaries: readonly CarrierSummary[]): EnergyTotals => ({
  kwh: summaries.reduce((total, s) => total + s.kwh, 0),
  costCop: summaries.reduce((total, s) => total + s.costCop, 0),
  missingFactor: summaries.reduce((total, s) => total + s.missingFactor, 0),
});

/** Energía anual estimada con el censo de carga, por energético (kWh/año; para el gas, kWh térmicos). */
export function estimatedByCarrier(equipment: readonly Equipment[]): Map<EnergyCarrier, number> {
  const totals = new Map<EnergyCarrier, number>();
  for (const e of equipment) {
    if (e.deletedAt) continue;
    const carrier = carrierOf(e);
    totals.set(carrier, (totals.get(carrier) ?? 0) + annualEnergyKwh(e, e.operatingDaysPerMonth));
  }
  return totals;
}
