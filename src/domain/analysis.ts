import { nextPeriod } from '@/utils/dates';
import { floorAreaOf } from './areas';
import { endUseBalance, type EndUseShare } from './calc/balance';
import { fitLinearModel, type LinearModel } from './calc/baseline';
import { powerFactorFromEnergy, rollingTwelveMonths } from './calc/bills';
import { annualEnergyKwh } from './calc/equipment';
import { baseLoadKw, dayTypeOf, isoDate, peakDemand, typicalDayProfile, weekdayHourMatrix, type IntervalReading } from './calc/interval';
import { mean, sum } from './calc/stats';
import { endUseOf } from './catalogs';
import type { Area, Bill, EndUseCategory, Equipment } from './types';

const byPeriod = (bills: readonly Bill[]) => [...bills].sort((a, b) => a.period.localeCompare(b.period));

// ——— Curva diaria del analizador o del operador ———

export interface DailyAnalysis {
  firstDate: string;
  lastDate: string;
  /** Días con al menos el 90 % de los intervalos: son los que entran en los promedios. */
  completeDays: number;
  peak: IntervalReading | null;
  baseLoadKw: number;
  averageKw: number;
  /** Potencia media dividida por la máxima en todo el periodo registrado. */
  loadFactor: number;
  averageDailyKwh: number;
  weekdayProfile: number[];
  weekendProfile: number[];
  /** 7 × 24, lunes primero: potencia media por día de la semana y hora. */
  matrix: number[][];
  dailyEnergy: { date: string; kwh: number; weekend: boolean; complete: boolean }[];
}

export function analyzeInterval(readings: readonly IntervalReading[], intervalMinutes: number, holidays: ReadonlySet<string> = new Set()): DailyAnalysis | null {
  if (!readings.length) return null;
  const slots = 1440 / intervalMinutes;
  const hours = intervalMinutes / 60;
  const days = new Map<string, { kwh: number; count: number; weekend: boolean }>();
  for (const r of readings) {
    const date = isoDate(r.start);
    const day = days.get(date) ?? { kwh: 0, count: 0, weekend: dayTypeOf(r.start, holidays) === 'finDeSemana' };
    day.kwh += r.kw * hours;
    day.count += 1;
    days.set(date, day);
  }
  const dailyEnergy = [...days]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, d]) => ({ date, kwh: d.kwh, weekend: d.weekend, complete: d.count >= slots * 0.9 }));
  const complete = dailyEnergy.filter((d) => d.complete);
  const peak = peakDemand(readings);
  const averageKw = mean(readings.map((r) => r.kw));
  return {
    firstDate: dailyEnergy[0].date,
    lastDate: dailyEnergy[dailyEnergy.length - 1].date,
    completeDays: complete.length,
    peak,
    baseLoadKw: baseLoadKw(readings),
    averageKw,
    loadFactor: peak && peak.kw > 0 ? averageKw / peak.kw : 0,
    averageDailyKwh: mean((complete.length ? complete : dailyEnergy).map((d) => d.kwh)),
    weekdayProfile: typicalDayProfile(readings, 'laborable', holidays),
    weekendProfile: typicalDayProfile(readings, 'finDeSemana', holidays),
    matrix: weekdayHourMatrix(readings),
    dailyEnergy,
  };
}

// ——— Comportamiento mensual y anual (facturas) ———

export interface MonthRow {
  period: string;
  kwh: number;
  days: number | null;
  kwhPerDay: number | null;
  costCop: number;
  tariff: number | null;
  pf: number | null;
  demandKw: number | null;
  /** Mismo mes del año anterior y variación frente a él. */
  previousKwh: number | null;
  change: number | null;
}

export function monthlyRows(bills: readonly Bill[]): MonthRow[] {
  const sorted = byPeriod(bills);
  const index = new Map(sorted.map((b) => [b.period, b]));
  return sorted.map((b) => {
    const previous = index.get(nextPeriod(b.period, -12));
    return {
      period: b.period,
      kwh: b.kwh,
      days: b.days ?? null,
      kwhPerDay: b.days ? b.kwh / b.days : null,
      costCop: b.costCop,
      tariff: b.tariffCopPerKwh ?? (b.kwh > 0 ? b.costCop / b.kwh : null),
      pf: b.kvarh !== undefined && b.kwh > 0 ? powerFactorFromEnergy(b.kwh, b.kvarh) : null,
      demandKw: b.demandKw ?? null,
      previousKwh: previous?.kwh ?? null,
      change: previous && previous.kwh > 0 ? (b.kwh - previous.kwh) / previous.kwh : null,
    };
  });
}

export interface AnnualSummary {
  months: number;
  last12Kwh: number | null;
  previous12Kwh: number | null;
  change: number | null;
  last12CostCop: number | null;
  /** Consumo anual estimado cuando hay menos de 12 facturas. */
  annualizedKwh: number | null;
  annualizedMethod: 'kwh-dia' | 'promedio-mensual' | null;
  /** Emisiones del consumo anual (facturado o estimado), si hay factor de emisión. */
  co2Tonnes: number | null;
  byYear: { year: number; kwh: number; months: number }[];
  rolling: { period: string; kwh: number }[];
}

export function annualSummary(bills: readonly Bill[], emissionFactorKgPerKwh = 0): AnnualSummary {
  const sorted = byPeriod(bills);
  const last12 = sorted.length >= 12 ? sorted.slice(-12) : null;
  const previous12 = sorted.length >= 24 ? sorted.slice(-24, -12) : null;
  const last12Kwh = last12 ? sum(last12.map((b) => b.kwh)) : null;
  const previous12Kwh = previous12 ? sum(previous12.map((b) => b.kwh)) : null;

  let annualizedKwh: number | null = null;
  let annualizedMethod: AnnualSummary['annualizedMethod'] = null;
  if (!last12 && sorted.length) {
    const withDays = sorted.filter((b) => b.days);
    if (withDays.length) {
      annualizedKwh = (sum(withDays.map((b) => b.kwh)) / sum(withDays.map((b) => b.days ?? 0))) * 365;
      annualizedMethod = 'kwh-dia';
    } else {
      annualizedKwh = mean(sorted.map((b) => b.kwh)) * 12;
      annualizedMethod = 'promedio-mensual';
    }
  }

  const years = new Map<number, { kwh: number; months: number }>();
  for (const b of sorted) {
    const year = Number(b.period.slice(0, 4));
    const total = years.get(year) ?? { kwh: 0, months: 0 };
    total.kwh += b.kwh;
    total.months += 1;
    years.set(year, total);
  }
  const reference = last12Kwh ?? annualizedKwh;
  return {
    months: sorted.length,
    last12Kwh,
    previous12Kwh,
    change: last12Kwh !== null && previous12Kwh ? (last12Kwh - previous12Kwh) / previous12Kwh : null,
    last12CostCop: last12 ? sum(last12.map((b) => b.costCop)) : null,
    annualizedKwh,
    annualizedMethod,
    co2Tonnes: reference !== null && emissionFactorKgPerKwh > 0 ? (reference * emissionFactorKgPerKwh) / 1000 : null,
    byYear: [...years].map(([year, t]) => ({ year, ...t })),
    rolling: rollingTwelveMonths(sorted),
  };
}

// ——— Balance por uso final y flujo de energía ———

/** Consumo anual estimado por uso final, de mayor a menor (base del Pareto y de los usos significativos). */
export const endUseShares = (equipment: readonly Equipment[]): EndUseShare[] =>
  endUseBalance(equipment.map((e) => ({ category: e.category, kwh: annualEnergyKwh(e, e.operatingDaysPerMonth) })));

export interface FlowNode {
  id: string;
  label: string;
  kind: 'total' | 'uso' | 'resto' | 'area';
  category?: EndUseCategory;
}

export interface EnergyFlow {
  nodes: FlowNode[];
  links: { source: string; target: string; kwh: number }[];
  totalKwh: number;
  estimatedKwh: number;
}

/**
 * Flujo anual: consumo total → usos finales → espacios. Si lo facturado supera lo estimado con el censo,
 * la diferencia queda como «Sin identificar»; los espacios se muestran solo si hay al menos dos.
 */
export function energyFlow(equipment: readonly Equipment[], areas: readonly Area[], billedKwh: number | null): EnergyFlow {
  const areaNames = new Map(areas.map((a) => [a.id, a.name]));
  const byUse = new Map<EndUseCategory, number>();
  const byUseArea = new Map<string, number>();
  for (const e of equipment) {
    const kwh = annualEnergyKwh(e, e.operatingDaysPerMonth);
    if (!(kwh > 0)) continue;
    byUse.set(e.category, (byUse.get(e.category) ?? 0) + kwh);
    const area = e.areaId && areaNames.has(e.areaId) ? e.areaId : '';
    const key = `${e.category}|${area}`;
    byUseArea.set(key, (byUseArea.get(key) ?? 0) + kwh);
  }
  const estimatedKwh = sum([...byUse.values()]);
  const totalKwh = billedKwh !== null && billedKwh > estimatedKwh ? billedKwh : estimatedKwh;
  const nodes: FlowNode[] = [{ id: 'total', label: billedKwh !== null ? 'Consumo facturado' : 'Consumo estimado', kind: 'total' }];
  const links: EnergyFlow['links'] = [];
  for (const [use, kwh] of [...byUse].sort((a, b) => b[1] - a[1])) {
    nodes.push({ id: `uso:${use}`, label: endUseOf(use).label, kind: 'uso', category: use });
    links.push({ source: 'total', target: `uso:${use}`, kwh });
  }
  if (totalKwh - estimatedKwh > 1e-6) {
    nodes.push({ id: 'resto', label: 'Sin identificar', kind: 'resto' });
    links.push({ source: 'total', target: 'resto', kwh: totalKwh - estimatedKwh });
  }
  const targets = new Set([...byUseArea.keys()].map((key) => key.split('|')[1]));
  if (targets.size >= 2) {
    for (const area of targets) nodes.push({ id: `area:${area || 'sin'}`, label: area ? (areaNames.get(area) ?? 'Espacio') : 'Sin espacio asignado', kind: 'area' });
    for (const [key, kwh] of byUseArea) {
      const [use, area] = key.split('|');
      links.push({ source: `uso:${use}`, target: `area:${area || 'sin'}`, kwh });
    }
  }
  return { nodes, links, totalKwh, estimatedKwh };
}

/** Consumo anual estimado de cada espacio y su intensidad (kWh/m²·año). */
export function areaIntensity(equipment: readonly Equipment[], areas: readonly Area[]): { area: Area; kwh: number; m2: number | null; intensity: number | null }[] {
  const totals = new Map<string, number>();
  for (const e of equipment) if (e.areaId) totals.set(e.areaId, (totals.get(e.areaId) ?? 0) + annualEnergyKwh(e, e.operatingDaysPerMonth));
  return areas
    .filter((a) => totals.has(a.id))
    .map((area) => {
      const kwh = totals.get(area.id) ?? 0;
      const m2 = floorAreaOf(area);
      return { area, kwh, m2, intensity: m2 ? kwh / m2 : null };
    })
    .sort((a, b) => (b.intensity ?? 0) - (a.intensity ?? 0));
}

/** Indicadores de desempeño energético (IDEn) del consumo anual. */
export function energyIndicators(annualKwh: number | null, annualCostCop: number | null, areaM2?: number, users?: number) {
  return {
    kwhPerM2Year: annualKwh !== null && areaM2 ? annualKwh / areaM2 : null,
    kwhPerUserYear: annualKwh !== null && users ? annualKwh / users : null,
    copPerM2Year: annualCostCop !== null && areaM2 ? annualCostCop / areaM2 : null,
    kwhPerDay: annualKwh !== null ? annualKwh / 365 : null,
  };
}

// ——— Línea base energética (ISO 50006) ———

export type BaselineVariable = 'days' | 'workingDays' | 'avgTemperatureC' | 'occupancyPct';

export const BASELINE_VARIABLES: readonly { id: BaselineVariable; label: string; unit: string; read: (b: Bill) => number | undefined }[] = [
  { id: 'days', label: 'Días facturados', unit: 'días', read: (b) => b.days },
  { id: 'workingDays', label: 'Días hábiles', unit: 'días', read: (b) => b.workingDays },
  { id: 'avgTemperatureC', label: 'Temperatura media', unit: '°C', read: (b) => b.avgTemperatureC },
  { id: 'occupancyPct', label: 'Ocupación', unit: '%', read: (b) => b.occupancyPct },
];

/** Variables con dato en al menos 4 facturas: las que se pueden ofrecer para el modelo. */
export const availableVariables = (bills: readonly Bill[]): BaselineVariable[] =>
  BASELINE_VARIABLES.filter((v) => bills.filter((b) => typeof v.read(b) === 'number').length >= 4).map((v) => v.id);

export interface BaselineResult {
  model: LinearModel;
  variables: BaselineVariable[];
  rows: { period: string; actual: number; predicted: number }[];
  /** Criterios de ASHRAE Guideline 14 para datos mensuales y R² recomendado. */
  quality: { r2: boolean; cvRmse: boolean; nmbe: boolean };
}

/** Periodo base: las últimas 12 facturas (o todas si hay menos) que tengan todas las variables elegidas. */
export function fitBaseline(bills: readonly Bill[], variables: readonly BaselineVariable[]): BaselineResult {
  const defs = variables.map((id) => BASELINE_VARIABLES.find((v) => v.id === id)).filter((v): v is (typeof BASELINE_VARIABLES)[number] => Boolean(v));
  const usable = byPeriod(bills)
    .filter((b) => defs.every((d) => typeof d.read(b) === 'number'))
    .slice(-12);
  const x = usable.map((b) => defs.map((d) => d.read(b) as number));
  const model = fitLinearModel(
    usable.map((b) => b.kwh),
    x,
  );
  return {
    model,
    variables: defs.map((d) => d.id),
    rows: usable.map((b, i) => ({ period: b.period, actual: b.kwh, predicted: model.predict(x[i]) })),
    quality: { r2: model.r2 >= 0.75, cvRmse: model.cvRmse <= 0.15, nmbe: Math.abs(model.nmbe) <= 0.05 },
  };
}
