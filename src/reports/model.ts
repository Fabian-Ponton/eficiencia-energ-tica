import {
  analyzeInterval,
  annualSummary,
  availableVariables,
  endUseShares,
  energyFlow,
  energyIndicators,
  fitBaseline,
  monthlyRows,
  type AnnualSummary,
  type BaselineResult,
  type BaselineVariable,
  type DailyAnalysis,
  type EnergyFlow,
  type MonthRow,
} from '@/domain/analysis';
import { reconciliationDeviation, significantEnergyUses, type EndUseShare } from '@/domain/calc/balance';
import type { IntervalReading } from '@/domain/calc/interval';
import { mean, sum } from '@/domain/calc/stats';
import { endUseOf } from '@/domain/catalogs';
import { estimatedProfiles } from '@/domain/estimate';
import { areaCooling, areaLighting, capacityAnalysis, resolveSizing, type AreaCooling, type AreaLighting, type CapacityResult, type SizingParameters } from '@/domain/sizing';
import type { Area, Bill, ElectricalNode, EndUseCategory, Equipment, Finding, IntervalSeries, Measure, Measurement, MeterReadingRecord, Photo, Project, Task } from '@/domain/types';
import { formatMillionsCop, formatNumber, formatPercent } from '@/utils/format';

/**
 * Contenido del informe de auditoría, del PGEE y del plan de implementación, sin formato: todos los
 * cálculos y los textos que los documentos Word presentan. Es puro para poder probarlo sin navegador.
 */

export interface ReportData {
  project: Project;
  areas: Area[];
  equipment: Equipment[];
  electrical: ElectricalNode[];
  measurements: Measurement[];
  readings: MeterReadingRecord[];
  bills: Bill[];
  series: IntervalSeries[];
  /** Serie principal para la curva diaria: la de toda la instalación o, si no hay, la más reciente. */
  mainSeries?: { series: IntervalSeries; readings: IntervalReading[] };
  photos: Photo[];
  /** Hallazgos que registró el auditor (manuales y sugerencias adoptadas), del más grave al más leve. */
  findings: Finding[];
  /** Medidas de ahorro evaluadas; las del plan tienen `selected`. */
  measures: Measure[];
  /** Tareas del plan de implementación, por fecha de inicio. */
  tasks: Task[];
  generatedAt: Date;
}

export type FindingTone = 'critical' | 'serious' | 'warning' | 'good' | 'info';

/** Hallazgo que sale de los datos, no escrito por el auditor: el diagnóstico lo ofrece como sugerencia. */
export interface AutoFinding {
  tone: FindingTone;
  topic: 'consumo' | 'climatizacion' | 'iluminacion' | 'electrico' | 'datos';
  title: string;
  detail: string;
}

export interface Kpi {
  label: string;
  value: string;
  unit?: string;
  note?: string;
}

export interface AuditModel {
  data: ReportData;
  params: SizingParameters;
  months: MonthRow[];
  annual: AnnualSummary;
  /** Consumo anual de referencia: 12 meses facturados, anualizado o, sin facturas, el del censo. */
  referenceKwh: number | null;
  billedAnnualKwh: number | null;
  shares: EndUseShare[];
  estimatedAnnualKwh: number;
  significant: EndUseShare[];
  deviation: number | null;
  flow: EnergyFlow;
  indicators: ReturnType<typeof energyIndicators>;
  baseline: BaselineResult | null;
  daily: DailyAnalysis | null;
  estimated: ReturnType<typeof estimatedProfiles>;
  cooling: AreaCooling[];
  lighting: AreaLighting[];
  capacity: CapacityResult;
  findings: AutoFinding[];
  kpis: Kpi[];
}

const TONE_ORDER: Record<FindingTone, number> = { critical: 0, serious: 1, warning: 2, info: 3, good: 4 };
const useLabel = (category: string) => endUseOf(category as EndUseCategory).label;
const list = (names: readonly string[]) => (names.length > 1 ? `${names.slice(0, -1).join(', ')} y ${names[names.length - 1]}` : (names[0] ?? ''));

/** La línea base usa los días hábiles si están en las facturas; si no, los días facturados. */
function defaultBaseline(bills: readonly Bill[]): BaselineResult | null {
  const available = availableVariables(bills);
  const variables: BaselineVariable[] = available.includes('workingDays') ? ['workingDays'] : available.includes('days') ? ['days'] : [];
  if (bills.length < 4) return null;
  try {
    return fitBaseline(bills, variables);
  } catch {
    return null;
  }
}

export function buildAuditModel(data: ReportData): AuditModel {
  const { project, areas, equipment, bills } = data;
  const params = resolveSizing(project.sizing);
  const months = monthlyRows(bills);
  const annual = annualSummary(bills, project.economics.emissionFactorKgPerKwh);
  const billedAnnualKwh = annual.last12Kwh ?? annual.annualizedKwh;
  const shares = endUseShares(equipment);
  const estimatedAnnualKwh = sum(shares.map((s) => s.kwh));
  const referenceKwh = billedAnnualKwh ?? (estimatedAnnualKwh || null);
  const significant = significantEnergyUses(shares);
  const deviation = billedAnnualKwh && estimatedAnnualKwh ? reconciliationDeviation(estimatedAnnualKwh, billedAnnualKwh) : null;
  const holidays = new Set(project.calendar.holidays);
  const daily = data.mainSeries ? analyzeInterval(data.mainSeries.readings, data.mainSeries.series.intervalMinutes, holidays) : null;
  const capacity = capacityAnalysis({
    nodes: data.electrical,
    equipment,
    measurements: data.measurements,
    bills,
    series: data.series,
    areas,
    params,
  });

  const model: AuditModel = {
    data,
    params,
    months,
    annual,
    referenceKwh,
    billedAnnualKwh,
    shares,
    estimatedAnnualKwh,
    significant,
    deviation,
    flow: energyFlow(equipment, areas, billedAnnualKwh),
    indicators: energyIndicators(referenceKwh, annual.last12CostCop, project.areaM2, project.users),
    baseline: defaultBaseline(bills),
    daily,
    estimated: estimatedProfiles(equipment),
    cooling: areas.map((a) => areaCooling(a, equipment, params)).filter((r) => r !== null),
    lighting: areas.map((a) => areaLighting(a, equipment, params)).filter((r) => r !== null),
    capacity,
    findings: [],
    kpis: [],
  };
  model.findings = autoFindings(model);
  model.kpis = keyIndicators(model);
  return model;
}

function keyIndicators(m: AuditModel): Kpi[] {
  const significantShare = m.significant[m.significant.length - 1]?.cumulativeShare;
  const kpis: Kpi[] = [
    {
      label: m.billedAnnualKwh !== null ? (m.annual.last12Kwh !== null ? 'Consumo anual' : 'Consumo anual estimado') : 'Consumo del censo',
      value: m.referenceKwh !== null ? formatNumber(m.referenceKwh) : '—',
      unit: 'kWh/año',
      note: m.annual.change !== null ? `${m.annual.change < 0 ? '−' : '+'}${formatPercent(Math.abs(m.annual.change), 1)} frente al año anterior` : undefined,
    },
    { label: 'Costo anual', value: m.annual.last12CostCop !== null ? formatMillionsCop(m.annual.last12CostCop) : '—', unit: 'COP', note: m.annual.last12CostCop === null ? 'faltan 12 facturas' : undefined },
    { label: 'Intensidad energética', value: m.indicators.kwhPerM2Year !== null ? formatNumber(m.indicators.kwhPerM2Year, 1) : '—', unit: 'kWh/m²·año' },
    { label: 'Demanda máxima', value: m.capacity.facility ? formatNumber(m.capacity.facility.kw, 1) : '—', unit: 'kW' },
    {
      label: 'Usos significativos',
      value: String(m.significant.length),
      note: significantShare !== undefined ? `${formatPercent(significantShare, 0)} del consumo` : undefined,
    },
    { label: 'Emisiones', value: m.annual.co2Tonnes !== null ? formatNumber(m.annual.co2Tonnes, 1) : '—', unit: 't CO₂e/año', note: m.annual.co2Tonnes === null ? 'sin factor de emisión' : undefined },
  ];
  return kpis;
}

/** Hallazgos automáticos, del más grave al más leve. */
export function autoFindings(m: AuditModel): AutoFinding[] {
  const out: AutoFinding[] = [];
  const facility = m.capacity.facility;

  if (!m.data.bills.length) out.push({ tone: 'info', topic: 'datos', title: 'Sin facturas registradas', detail: 'El comportamiento mensual, la línea base y el costo anual necesitan las facturas de al menos 12 meses.' });
  if (m.annual.change !== null && Math.abs(m.annual.change) > 0.05) {
    const up = m.annual.change > 0;
    out.push({
      tone: up ? 'warning' : 'good',
      topic: 'consumo',
      title: up ? 'El consumo anual aumentó' : 'El consumo anual bajó',
      detail: `Los últimos 12 meses suman ${formatNumber(m.annual.last12Kwh ?? 0)} kWh, ${formatPercent(Math.abs(m.annual.change), 1)} ${up ? 'más' : 'menos'} que los 12 anteriores.`,
    });
  }
  if (m.deviation !== null && Number.isFinite(m.deviation) && Math.abs(m.deviation) > 0.1) {
    out.push({
      tone: Math.abs(m.deviation) > 0.2 ? 'serious' : 'warning',
      topic: 'datos',
      title: m.deviation < 0 ? 'Parte del consumo no está en el censo' : 'El censo supera lo facturado',
      detail: `El censo de carga estima ${formatNumber(m.estimatedAnnualKwh)} kWh/año frente a ${formatNumber(m.billedAnnualKwh ?? 0)} kWh facturados (${m.deviation < 0 ? '−' : '+'}${formatPercent(Math.abs(m.deviation), 1)}). Conviene revisar horas de uso, factores de uso y equipos sin registrar.`,
    });
  }
  if (m.significant.length) {
    const last = m.significant[m.significant.length - 1];
    out.push({
      tone: 'info',
      topic: 'consumo',
      title: 'Usos significativos de energía',
      detail: `${list(m.significant.map((s) => useLabel(s.category)))} ${m.significant.length === 1 ? 'concentra' : 'concentran'} el ${formatPercent(last.cumulativeShare, 0)} del consumo estimado: ${m.significant.length === 1 ? 'es' : 'son'} la prioridad del plan de gestión (ISO 50001).`,
    });
  }
  if (m.daily?.peak && m.daily.peak.kw > 0) {
    const share = m.daily.baseLoadKw / m.daily.peak.kw;
    if (share > 0.25) {
      out.push({
        tone: 'warning',
        topic: 'consumo',
        title: 'Carga base alta fuera del horario',
        detail: `La carga base (${formatNumber(m.daily.baseLoadKw, 1)} kW) es el ${formatPercent(share, 0)} de la demanda máxima: hay equipos que siguen encendidos de noche o los fines de semana.`,
      });
    }
  }

  if (facility && facility.pf < 0.9) {
    out.push({
      tone: 'serious',
      topic: 'electrico',
      title: 'Factor de potencia bajo',
      detail: `El factor de potencia es ${formatNumber(facility.pf, 2)} (menor de 0,90): el operador cobra la energía reactiva. Conviene dimensionar un banco de condensadores.`,
    });
  }
  for (const check of m.capacity.checks) {
    if (check.level === 'normal') continue;
    const critical = check.level === 'critica';
    const what = check.node.kind === 'transformador' ? 'El transformador' : check.node.kind === 'acometida' ? 'La acometida' : `«${check.node.name}»`;
    out.push({
      tone: critical ? 'critical' : 'warning',
      topic: 'electrico',
      title: `${check.node.name}: carga ${critical ? 'crítica' : 'alta'}`,
      detail: `${what} trabaja al ${formatPercent(check.ratio, 0)} de su capacidad (${formatNumber(check.load, 1)} de ${formatNumber(check.capacity, 1)} ${check.unit}). ${critical ? 'No admite cargas nuevas sin ampliar la capacidad o reducir la demanda.' : 'Queda poco margen para cargas nuevas.'}`,
    });
  }
  for (const row of m.capacity.imbalance) {
    if (row.level === 'normal') continue;
    out.push({
      tone: row.level === 'critico' ? 'serious' : 'warning',
      topic: 'electrico',
      title: `Desbalance de fases en ${row.point}`,
      detail: `Las corrientes por fase se apartan hasta un ${formatPercent(row.imbalance, 1)} del promedio (${row.currents.map((c) => formatNumber(c, 0)).join(' / ')} A): conviene redistribuir cargas monofásicas.`,
    });
  }

  const under = m.cooling.filter((c) => c.status === 'subdimensionado');
  const over = m.cooling.filter((c) => c.status === 'sobredimensionado');
  if (under.length) {
    out.push({
      tone: 'serious',
      topic: 'climatizacion',
      title: 'Aires acondicionados con capacidad insuficiente',
      detail: `${list(under.map((c) => c.area.name))}: la capacidad instalada no cubre la carga térmica estimada y los equipos trabajan sin descanso en las horas pico.`,
    });
  }
  if (over.length) {
    out.push({
      tone: 'warning',
      topic: 'climatizacion',
      title: 'Aires acondicionados sobredimensionados',
      detail: `${list(over.map((c) => c.area.name))}: la capacidad supera la carga en más de un ${formatPercent(m.params.coolingOver - 1, 0)}; al reponer los equipos se puede bajar la capacidad.`,
    });
  }
  const dark = m.lighting.filter((l) => l.status === 'insuficiente');
  if (dark.length) {
    out.push({
      tone: 'serious',
      topic: 'iluminacion',
      title: 'Iluminancia por debajo de la requerida',
      detail: `${list(dark.map((l) => `${l.area.name} (${formatNumber(l.lux ?? 0)} de ${formatNumber(l.requiredLux)} lx)`))}.`,
    });
  }
  const inefficient = m.lighting.filter((l) => l.veeiOk === false);
  if (inefficient.length) {
    out.push({
      tone: 'warning',
      topic: 'iluminacion',
      title: 'Iluminación con baja eficiencia (VEEI)',
      detail: `${list(inefficient.map((l) => l.area.name))} ${inefficient.length === 1 ? 'supera' : 'superan'} el valor límite de eficiencia energética: conviene cambiar su iluminación a LED.`,
    });
  }
  if (m.baseline && !(m.baseline.quality.cvRmse && m.baseline.quality.nmbe)) {
    out.push({
      tone: 'info',
      topic: 'datos',
      title: 'Línea base por mejorar',
      detail: `El modelo no cumple los criterios de ASHRAE Guideline 14 (CV(RMSE) ${formatPercent(m.baseline.model.cvRmse, 1)}, NMBE ${formatPercent(m.baseline.model.nmbe, 1)}): agrega variables como ocupación o temperatura en las facturas.`,
    });
  }
  if (!m.daily) out.push({ tone: 'info', topic: 'datos', title: 'Sin curva de carga medida', detail: 'La curva diaria del informe se estima con el inventario; un registro del analizador de redes en el tablero general la confirmaría.' });

  return out.sort((a, b) => TONE_ORDER[a.tone] - TONE_ORDER[b.tone]);
}

/** Consumo diario promedio de las facturas de los últimos 12 meses (kWh/día). */
export function billedDailyKwh(bills: readonly Bill[]): number | null {
  const recent = [...bills].sort((a, b) => a.period.localeCompare(b.period)).slice(-12).filter((b) => b.days);
  const days = sum(recent.map((b) => b.days ?? 0));
  return days ? sum(recent.map((b) => b.kwh)) / days : null;
}

/** Promedio de kWh de los días laborables completos medidos. */
export const measuredWeekdayKwh = (daily: DailyAnalysis): number | null => {
  const days = daily.dailyEnergy.filter((d) => d.complete && !d.weekend);
  return days.length ? mean(days.map((d) => d.kwh)) : null;
};
