import { formatNumber } from '@/utils/format';
import { avoidedEmissionsTonnes, irr, npv, projectCashFlows, simplePayback } from './calc/economics';
import { capacitorBankKvar } from './calc/solutions/capacitors';
import { electricPowerKw, hvacReplacementSavingsKwh } from './calc/solutions/hvac';
import { lightingRetrofitSavingsKwh } from './calc/solutions/lighting';
import { pvSizing, type PvSizingResult } from './calc/solutions/pv';
import type { EndUseCategory, Measure, Project } from './types';

/**
 * Medidas de ahorro: evaluación económica con los parámetros del proyecto y calculadoras que arman una
 * medida dimensionada (solar fotovoltaica, banco de condensadores, reemplazo de aires y cambio a LED).
 * Los costos unitarios por defecto son orientativos: el auditor los ajusta con cotizaciones.
 */

export interface MeasureEconomics {
  /** Años para recuperar la inversión con el ahorro neto (Infinity si no hay ahorro). */
  paybackYears: number;
  npvCop: number;
  /** Tasa interna de retorno; `null` sin inversión o si los flujos no cambian de signo. */
  irr: number | null;
  co2TonnesYear: number | null;
  /** Años de la evaluación: la vida útil de la medida, sin pasar del horizonte del proyecto. */
  years: number;
  /** Año 0 (inversión) y ahorro neto de cada año con el incremento de tarifa. */
  cashFlows: number[];
}

type EconomicFields = Pick<Measure, 'investmentCop' | 'savingsCopYear' | 'annualCostCop' | 'lifetimeYears' | 'savingsKwhYear'>;

export function measureEconomics(m: EconomicFields, economics: Project['economics']): MeasureEconomics {
  const horizon = economics.horizonYears > 0 ? economics.horizonYears : m.lifetimeYears;
  const years = Math.max(1, Math.round(m.lifetimeYears > 0 ? Math.min(m.lifetimeYears, horizon) : horizon || 1));
  const cashFlows = projectCashFlows({
    investment: m.investmentCop,
    annualSavings: m.savingsCopYear,
    years,
    escalation: economics.tariffEscalation,
    annualCost: m.annualCostCop,
  });
  return {
    paybackYears: simplePayback(m.investmentCop, m.savingsCopYear - m.annualCostCop),
    npvCop: npv(economics.discountRate, cashFlows),
    irr: m.investmentCop > 0 ? irr(cashFlows) : null,
    co2TonnesYear: economics.emissionFactorKgPerKwh > 0 ? avoidedEmissionsTonnes(m.savingsKwhYear, economics.emissionFactorKgPerKwh) : null,
    years,
    cashFlows,
  };
}

/** Prioridad sugerida: alta si se paga en 2 años o menos (o no cuesta), media hasta 5 años, baja después. */
export function suggestedPriority(e: Pick<MeasureEconomics, 'paybackYears'>, investmentCop: number): NonNullable<Measure['priority']> {
  if (investmentCop <= 0 || e.paybackYears <= 2) return 'alta';
  return e.paybackYears <= 5 ? 'media' : 'baja';
}

/** Textos de los documentos y las tablas. */
export const MEASURE_KIND_LABEL: Record<Measure['kind'], string> = { operativa: 'Operativa', 'baja-inversion': 'Baja inversión', 'alta-inversion': 'Alta inversión' };
export const PRIORITY_LABEL: Record<NonNullable<Measure['priority']>, string> = { alta: 'Alta', media: 'Media', baja: 'Baja' };

/** Lo que devuelve cada calculadora: los campos de la medida y su ficha técnica. */
export interface CalculatorResult {
  title: string;
  category: EndUseCategory;
  kind: Measure['kind'];
  savingsKwhYear: number;
  savingsCopYear: number;
  investmentCop: number;
  annualCostCop: number;
  lifetimeYears: number;
  /** Ficha técnica: aparece en la descripción de la medida, en el PGEE y en el informe. */
  specs: { label: string; value: string }[];
}

/** Descripción de la medida a partir de su ficha técnica. */
export const specsText = (specs: CalculatorResult['specs']): string => specs.map((s) => `${s.label}: ${s.value}`).join(' · ');

// ——— Solar fotovoltaica ———

export interface PvInput {
  /** Energía diaria que se quiere cubrir (kWh/día). */
  dailyEnergyKwh: number;
  peakSunHours: number;
  performanceRatio: number;
  moduleWp: number;
  moduleAreaM2: number;
  /** Costo instalado por kWp (COP). */
  costPerKwp: number;
  tariff: number;
  /** Área de techo disponible (m²), para saber si el arreglo cabe. */
  availableRoofM2?: number;
}

export function pvMeasure(i: PvInput): CalculatorResult & { sizing: PvSizingResult; fitsRoof: boolean | null } {
  const sizing = pvSizing(i);
  const investmentCop = sizing.installedKwp * i.costPerKwp;
  const fitsRoof = i.availableRoofM2 ? sizing.arrayAreaM2 <= i.availableRoofM2 : null;
  return {
    title: `Sistema solar fotovoltaico de ${formatNumber(sizing.installedKwp, 1)} kWp`,
    category: 'otros',
    kind: 'alta-inversion',
    savingsKwhYear: sizing.annualGenerationKwh,
    savingsCopYear: sizing.annualGenerationKwh * i.tariff,
    investmentCop,
    // Mantenimiento: limpieza e inspección, del orden del 1 % anual de la inversión
    annualCostCop: investmentCop * 0.01,
    lifetimeYears: 25,
    specs: [
      { label: 'Potencia', value: `${formatNumber(sizing.installedKwp, 2)} kWp` },
      { label: 'Módulos', value: `${sizing.modules} × ${formatNumber(i.moduleWp)} Wp` },
      { label: 'Área', value: `${formatNumber(sizing.arrayAreaM2, 1)} m²` },
      { label: 'Generación', value: `${formatNumber(sizing.annualGenerationKwh)} kWh/año` },
      { label: 'Recurso', value: `${formatNumber(i.peakSunHours, 1)} HSP · PR ${formatNumber(i.performanceRatio, 2)}` },
    ],
    sizing,
    fitsRoof,
  };
}

// ——— Banco de condensadores ———

export interface CapacitorInput {
  /** Demanda activa en la hora de mayor carga (kW). */
  demandKw: number;
  currentPf: number;
  targetPf: number;
  /** Costo instalado por kvar (COP). */
  costPerKvar: number;
  /** Cobro anual por energía reactiva que se elimina (COP). */
  annualReactiveChargeCop: number;
}

/** Los bancos se venden en pasos: se redondea hacia arriba al múltiplo de 5 kvar. */
export const commercialKvar = (kvar: number, step = 5): number => (kvar > 0 ? Math.ceil(kvar / step - 1e-9) * step : 0);

export function capacitorMeasure(i: CapacitorInput): CalculatorResult & { requiredKvar: number; bankKvar: number } {
  const requiredKvar = capacitorBankKvar(i.demandKw, i.currentPf, i.targetPf);
  const bankKvar = commercialKvar(requiredKvar);
  return {
    title: `Banco de condensadores de ${formatNumber(bankKvar)} kvar`,
    category: 'otros',
    kind: 'baja-inversion',
    // El ahorro es el cobro de reactiva; la reducción de pérdidas no se cuenta
    savingsKwhYear: 0,
    savingsCopYear: i.annualReactiveChargeCop,
    investmentCop: bankKvar * i.costPerKvar,
    annualCostCop: 0,
    lifetimeYears: 10,
    specs: [
      { label: 'Potencia reactiva', value: `${formatNumber(requiredKvar, 1)} kvar calculados · banco de ${formatNumber(bankKvar)} kvar` },
      { label: 'Factor de potencia', value: `${formatNumber(i.currentPf, 2)} → ${formatNumber(i.targetPf, 2)}` },
      { label: 'Demanda', value: `${formatNumber(i.demandKw, 1)} kW` },
    ],
    requiredKvar,
    bankKvar,
  };
}

// ——— Reemplazo de aires acondicionados ———

export interface HvacInput {
  units: number;
  capacityBtuH: number;
  currentEer: number;
  newEer: number;
  /** Horas equivalentes a plena carga por año de cada unidad. */
  fullLoadHoursPerYear: number;
  /** Costo instalado por unidad nueva (COP). */
  costPerUnit: number;
  tariff: number;
}

export function hvacMeasure(i: HvacInput): CalculatorResult {
  const perUnit = hvacReplacementSavingsKwh(i);
  const savingsKwhYear = perUnit * i.units;
  return {
    title: `Reemplazo de ${i.units} ${i.units === 1 ? 'aire' : 'aires'} de ${formatNumber(i.capacityBtuH)} BTU/h por equipos eficientes`,
    category: 'climatizacion',
    kind: 'alta-inversion',
    savingsKwhYear,
    savingsCopYear: savingsKwhYear * i.tariff,
    investmentCop: i.units * i.costPerUnit,
    annualCostCop: 0,
    lifetimeYears: 12,
    specs: [
      { label: 'Equipos', value: `${i.units} × ${formatNumber(i.capacityBtuH)} BTU/h` },
      { label: 'Eficiencia', value: `EER ${formatNumber(i.currentEer, 1)} → ${formatNumber(i.newEer, 1)}` },
      { label: 'Potencia por unidad', value: `${formatNumber(electricPowerKw(i.capacityBtuH, i.currentEer), 2)} → ${formatNumber(electricPowerKw(i.capacityBtuH, i.newEer), 2)} kW` },
      { label: 'Uso', value: `${formatNumber(i.fullLoadHoursPerYear)} h/año a plena carga` },
    ],
  };
}

// ——— Cambio a iluminación LED ———

export interface LedInput {
  currentCount: number;
  /** Potencia actual por luminaria, con balasto (W). */
  currentW: number;
  proposedCount: number;
  proposedW: number;
  hoursPerYear: number;
  /** Costo instalado por luminaria nueva (COP). */
  costPerLuminaire: number;
  tariff: number;
}

export function ledMeasure(i: LedInput): CalculatorResult {
  const savingsKwhYear = lightingRetrofitSavingsKwh({ currentW: i.currentCount * i.currentW, proposedW: i.proposedCount * i.proposedW, hoursPerYear: i.hoursPerYear });
  return {
    title: `Cambio a iluminación LED (${formatNumber(i.proposedCount)} luminarias)`,
    category: 'iluminacion',
    kind: 'baja-inversion',
    savingsKwhYear,
    savingsCopYear: savingsKwhYear * i.tariff,
    investmentCop: i.proposedCount * i.costPerLuminaire,
    annualCostCop: 0,
    lifetimeYears: 12,
    specs: [
      { label: 'Actual', value: `${formatNumber(i.currentCount)} × ${formatNumber(i.currentW)} W = ${formatNumber((i.currentCount * i.currentW) / 1000, 2)} kW` },
      { label: 'Propuesto', value: `${formatNumber(i.proposedCount)} × ${formatNumber(i.proposedW)} W = ${formatNumber((i.proposedCount * i.proposedW) / 1000, 2)} kW` },
      { label: 'Uso', value: `${formatNumber(i.hoursPerYear)} h/año` },
    ],
  };
}

/** Código siguiente de la lista de medidas: M1, M2… */
export function nextMeasureCode(existing: readonly { code: string }[]): string {
  const numbers = existing.map((m) => Number(/^M(\d+)$/i.exec(m.code.trim())?.[1] ?? 0));
  return `M${Math.max(0, ...numbers) + 1}`;
}
