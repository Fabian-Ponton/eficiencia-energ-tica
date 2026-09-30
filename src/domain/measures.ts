import { formatNumber } from '@/utils/format';
import { avoidedEmissionsTonnes, irr, npv, projectCashFlows, simplePayback } from './calc/economics';
import { annualEnergyKwh } from './calc/equipment';
import { sum } from './calc/stats';
import { capacitorBankKvar } from './calc/solutions/capacitors';
import { electricPowerKw, hvacReplacementSavingsKwh } from './calc/solutions/hvac';
import { lightingRetrofitSavingsKwh } from './calc/solutions/lighting';
import { pvSizing, type PvSizingResult } from './calc/solutions/pv';
import type { EndUseCategory, Equipment, Measure, Project, SavingsType } from './types';

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

/** Retorno simple para mostrar: «Inmediato» si la medida no cuesta, los años con un decimal, o «—» si el ahorro no alcanza a pagarla. */
export function paybackText(e: Pick<MeasureEconomics, 'paybackYears'>, investmentCop: number): { value: string; unit: string } {
  if (investmentCop <= 0) return { value: 'Inmediato', unit: '' };
  return Number.isFinite(e.paybackYears) ? { value: formatNumber(e.paybackYears, 1), unit: 'años' } : { value: '—', unit: 'sin ahorro neto' };
}

/** Prioridad sugerida: alta si se paga en 2 años o menos (o no cuesta), media hasta 5 años, baja después. */
export function suggestedPriority(e: Pick<MeasureEconomics, 'paybackYears'>, investmentCop: number): NonNullable<Measure['priority']> {
  if (investmentCop <= 0 || e.paybackYears <= 2) return 'alta';
  return e.paybackYears <= 5 ? 'media' : 'baja';
}

/**
 * Clases de potencial de ahorro del art. 4(d) de la Res. MME 40412 de 2024 (buenas prácticas de operación, cambio tecnológico,
 * sustitución de energéticos y FNCER) y las medidas pasivas que la Res. UPME 016 de 2024 (§8.2) separa de la reconversión tecnológica.
 */
export const SAVINGS_TYPES: readonly { id: SavingsType; label: string; short: string; help: string }[] = [
  {
    id: 'bpo',
    label: 'Buenas prácticas de operación',
    short: 'BPO',
    help: 'Cambios en cómo se opera y se mantiene: apagado, horarios, mantenimiento, sensibilización. Se pueden implementar aunque el edificio no sea de la entidad.',
  },
  { id: 'cambio-tecnologico', label: 'Cambio tecnológico', short: 'Tecnología', help: 'Reemplazo o reconversión de equipos: iluminación LED, aires inverter, motores eficientes, condensadores.' },
  {
    id: 'sustitucion-energetico',
    label: 'Sustitución de energético',
    short: 'Sustitución',
    help: 'Pasar un uso final a otro energético más eficiente o menos contaminante (por ejemplo, de GLP a gas natural o a electricidad).',
  },
  { id: 'fncer', label: 'FNCER', short: 'FNCER', help: 'Fuentes no convencionales de energía renovable: solar fotovoltaica o térmica, eólica, biomasa.' },
  { id: 'pasiva', label: 'Medida pasiva', short: 'Pasiva', help: 'Mejoras de la envolvente que bajan la carga sin equipos: películas de control solar, pintura reflectiva, aislamiento, sombreamiento.' },
];

export const savingsTypeInfo = (id: SavingsType) => SAVINGS_TYPES.find((t) => t.id === id) ?? SAVINGS_TYPES[0];

/** Clase de potencial de una medida; si el auditor no la eligió, se infiere de su tipo: operativa = buenas prácticas, el resto = cambio tecnológico. */
export const savingsTypeOf = (m: Pick<Measure, 'kind' | 'savingsType'>): SavingsType => m.savingsType ?? (m.kind === 'operativa' ? 'bpo' : 'cambio-tecnologico');

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
  /** Clase de potencial que le corresponde a la medida (art. 4d). */
  savingsType?: SavingsType;
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
    savingsType: 'fncer',
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
    savingsType: 'cambio-tecnologico',
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

// ——— Apagado y control de horarios (buenas prácticas de operación) ———

/** Por qué un equipo no entra al programa de apagado. */
export type ShutdownExclusion = 'no-interrumpible' | 'continuo' | 'respaldo' | 'sin-horas';

export const SHUTDOWN_EXCLUSION_LABEL: Record<ShutdownExclusion, string> = {
  'no-interrumpible': 'No se puede apagar',
  continuo: 'Funciona las 24 horas',
  respaldo: 'Equipo de respaldo',
  'sin-horas': 'Sin horas de uso',
};

/** ¿Puede un equipo entrar a un programa de apagado? Los que no se pueden apagar, los continuos y los de respaldo quedan fuera. */
export function shutdownExclusion(e: Pick<Equipment, 'nonInterruptible' | 'regime' | 'hoursPerDay'>): ShutdownExclusion | null {
  if (e.nonInterruptible) return 'no-interrumpible';
  if (e.regime === 'continuo') return 'continuo';
  if (e.regime === 'respaldo') return 'respaldo';
  return e.hoursPerDay > 0 ? null : 'sin-horas';
}

export interface ShutdownInput {
  /** Equipos eléctricos del censo. */
  equipment: readonly Equipment[];
  /** Usos finales que entran al programa; vacío o ausente = todos los que se pueden apagar. */
  categories?: readonly EndUseCategory[];
  /** Horas menos de funcionamiento por día de operación. */
  hoursSavedPerDay: number;
  /** Fracción de esas horas que se logra apagar en la práctica (0 a 1). */
  compliance?: number;
  tariff: number;
  /** Inversión del programa: sensores, temporizadores, sensibilización (COP). */
  investmentCop?: number;
}

export interface ShutdownCandidate {
  equipment: Equipment;
  hoursSaved: number;
  kwhYear: number;
}

/**
 * Programa de apagado y control de horarios: cada equipo que se puede apagar deja de funcionar `hoursSavedPerDay` horas (o las que
 * tenga, si son menos). Los equipos que no se pueden apagar, los de régimen continuo y los de respaldo se excluyen y se listan aparte.
 */
export function shutdownMeasure(i: ShutdownInput): CalculatorResult & { candidates: ShutdownCandidate[]; excluded: { equipment: Equipment; reason: ShutdownExclusion }[] } {
  const compliance = i.compliance ?? 1;
  const candidates: ShutdownCandidate[] = [];
  const excluded: { equipment: Equipment; reason: ShutdownExclusion }[] = [];
  for (const equipment of i.equipment) {
    if (i.categories?.length && !i.categories.includes(equipment.category)) continue;
    const reason = shutdownExclusion(equipment);
    if (reason) {
      excluded.push({ equipment, reason });
      continue;
    }
    const hoursSaved = Math.min(i.hoursSavedPerDay, equipment.hoursPerDay);
    candidates.push({ equipment, hoursSaved, kwhYear: annualEnergyKwh({ ...equipment, hoursPerDay: hoursSaved }, equipment.operatingDaysPerMonth) * compliance });
  }
  const savingsKwhYear = sum(candidates.map((c) => c.kwhYear));
  const units = sum(candidates.map((c) => c.equipment.quantity));
  const uses = new Set(candidates.map((c) => c.equipment.category));
  return {
    title: `Programa de apagado y control de horarios (${formatNumber(units)} equipos)`,
    category: uses.size === 1 ? [...uses][0] : 'otros',
    kind: 'operativa',
    savingsType: 'bpo',
    savingsKwhYear,
    savingsCopYear: savingsKwhYear * i.tariff,
    investmentCop: i.investmentCop ?? 0,
    annualCostCop: 0,
    lifetimeYears: 5,
    specs: [
      { label: 'Equipos', value: `${formatNumber(units)} unidades` },
      { label: 'Horas menos por día', value: `${formatNumber(i.hoursSavedPerDay, 1)} h` },
      { label: 'Cumplimiento esperado', value: `${formatNumber(compliance * 100)} %` },
      { label: 'Excluidos', value: `${formatNumber(excluded.length)} (no se pueden apagar, continuos o de respaldo)` },
    ],
    candidates,
    excluded,
  };
}

/**
 * Horas por día que cada equipo funciona por encima de las que se usa su espacio según los horarios registrados (equipos encendidos
 * fuera de clase). Solo cuenta los equipos que se pueden apagar y cuyo espacio tiene horario.
 */
export function excessHoursByEquipment(equipment: readonly Equipment[], dailyUseHoursByArea: ReadonlyMap<string, number>): { equipment: Equipment; excessHours: number }[] {
  return equipment
    .filter((e) => !shutdownExclusion(e) && e.areaId && dailyUseHoursByArea.has(e.areaId))
    .map((e) => ({ equipment: e, excessHours: Math.max(0, e.hoursPerDay - (dailyUseHoursByArea.get(e.areaId as string) ?? 0)) }))
    .filter((r) => r.excessHours > 0);
}

// ——— Resumen del plan ———

export interface TypeTotals {
  type: SavingsType;
  count: number;
  kwh: number;
  cop: number;
  investment: number;
}

export interface PlanSummary {
  count: number;
  kwh: number;
  cop: number;
  investment: number;
  /** Ahorro neto (ahorro menos costo anual de operación) y retorno simple del conjunto. */
  netCop: number;
  paybackYears: number;
  byType: TypeTotals[];
  /**
   * Las medidas del plan se suman, como en el Anexo 5 de la Res. UPME 016; pero dos medidas sobre el mismo uso final (o LED con aires)
   * se solapan: la suma simple sobrestima. `combinedKwh` es una referencia que aplica cada ahorro sobre el consumo que queda.
   */
  interaction: { categories: EndUseCategory[]; combinedKwh: number | null } | null;
}

export interface TypePotential {
  type: SavingsType;
  /** Medidas evaluadas de esta clase y su ahorro potencial. */
  count: number;
  kwh: number;
  /** Las que están incluidas en el plan. */
  planCount: number;
  planKwh: number;
  investment: number;
}

/** Potencial de ahorro por clase (art. 4d): todas las medidas evaluadas y, aparte, las que están en el plan. */
export function potentialByType(measures: readonly Measure[]): TypePotential[] {
  const rows = new Map<SavingsType, TypePotential>();
  for (const m of measures) {
    const type = savingsTypeOf(m);
    const row = rows.get(type) ?? { type, count: 0, kwh: 0, planCount: 0, planKwh: 0, investment: 0 };
    row.count += 1;
    row.kwh += m.savingsKwhYear;
    row.investment += m.investmentCop;
    if (m.selected) {
      row.planCount += 1;
      row.planKwh += m.savingsKwhYear;
    }
    rows.set(type, row);
  }
  return SAVINGS_TYPES.map((t) => rows.get(t.id)).filter((row): row is TypePotential => Boolean(row));
}

/** Totales de las medidas incluidas en el plan, por clase de potencial y con el aviso de solapamiento. */
export function planSummary(measures: readonly Measure[], annualKwh?: number | null): PlanSummary {
  const list = measures.filter((m) => m.selected);
  const kwh = sum(list.map((m) => m.savingsKwhYear));
  const cop = sum(list.map((m) => m.savingsCopYear));
  const investment = sum(list.map((m) => m.investmentCop));
  const netCop = cop - sum(list.map((m) => m.annualCostCop));
  const types = new Map<SavingsType, TypeTotals>();
  for (const m of list) {
    const type = savingsTypeOf(m);
    const row = types.get(type) ?? { type, count: 0, kwh: 0, cop: 0, investment: 0 };
    row.count += 1;
    row.kwh += m.savingsKwhYear;
    row.cop += m.savingsCopYear;
    row.investment += m.investmentCop;
    types.set(type, row);
  }
  const counts = new Map<EndUseCategory, number>();
  for (const m of list) counts.set(m.category, (counts.get(m.category) ?? 0) + 1);
  const categories = new Set<EndUseCategory>([...counts].filter(([, n]) => n > 1).map(([category]) => category));
  if (counts.has('iluminacion') && counts.has('climatizacion')) {
    categories.add('iluminacion');
    categories.add('climatizacion');
  }
  const combinedKwh = annualKwh && annualKwh > 0 ? annualKwh * (1 - list.reduce((left, m) => left * (1 - Math.min(1, m.savingsKwhYear / annualKwh)), 1)) : null;
  return {
    count: list.length,
    kwh,
    cop,
    investment,
    netCop,
    paybackYears: netCop > 0 ? investment / netCop : Number.POSITIVE_INFINITY,
    byType: SAVINGS_TYPES.map((t) => types.get(t.id)).filter((row): row is TypeTotals => Boolean(row)),
    interaction: list.length > 1 && categories.size ? { categories: [...categories], combinedKwh } : null,
  };
}

/** Código siguiente de la lista de medidas: M1, M2… */
export function nextMeasureCode(existing: readonly { code: string }[]): string {
  const numbers = existing.map((m) => Number(/^M(\d+)$/i.exec(m.code.trim())?.[1] ?? 0));
  return `M${Math.max(0, ...numbers) + 1}`;
}
