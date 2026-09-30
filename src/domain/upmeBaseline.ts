import { formatNumber } from '@/utils/format';
import {
  absoluteModel,
  baselinePoints,
  completeVariables,
  MODEL_LABEL,
  RECOMMENDED_MONTHS,
  ratioModel,
  recommendModel,
  statisticalModel,
  upmeAttributes,
  upmeVariable,
  withinPeriod,
  type BaselinePoint,
  type MonthlyModel,
  type RatioModel,
  type StatisticalModel,
  type UpmeAttributes,
} from './calc/lben';
import { mean, sum } from './calc/stats';
import type { BaselineAdjustment, BaselineConfig, Bill, Project, UpmeModelKind, UpmeVariable } from './types';
import { MONTHS_LONG, periodLabel } from '@/utils/dates';

/**
 * Línea base de consumo energético de un proyecto con el método de la Res. UPME 016 de 2024: elige el modelo, arma el
 * periodo base, aplica los ajustes que el auditor declaró y devuelve la tabla, las cifras del informe y los avisos.
 */

export interface BaselineWarning {
  tone: 'info' | 'warning' | 'serious';
  text: string;
}

export interface UpmeBaselineInput {
  /** Facturas del energético de la línea base (electricidad). */
  bills: readonly Bill[];
  config?: BaselineConfig;
  adjustments?: readonly BaselineAdjustment[];
  project?: Pick<Project, 'areaM2' | 'sector' | 'building'>;
}

export interface UpmeBaseline {
  kind: UpmeModelKind;
  recommended: UpmeModelKind;
  /** Modelos que se pueden calcular con los datos del periodo base. */
  available: UpmeModelKind[];
  /** Variables con dato en todos los meses del periodo base. */
  variablesAvailable: UpmeVariable[];
  points: BaselinePoint[];
  months: number;
  from: string;
  to: string;
  ratioVariable?: UpmeVariable;
  /** Variables candidatas del modelo estadístico. */
  candidates: UpmeVariable[];
  monthly?: MonthlyModel;
  ratio?: RatioModel;
  statistical?: StatisticalModel;
  /** Cifras del periodo base: lo que va al informe y a la medida de mejor desempeño. */
  headline: { baselineKwhYear: number | null; savingKwhYear: number | null; savingPct: number | null };
  warnings: BaselineWarning[];
  attributes: UpmeAttributes[];
  appliedAdjustments: BaselineAdjustment[];
}

const list = (items: readonly string[]) => (items.length <= 1 ? (items[0] ?? '') : `${items.slice(0, -1).join(', ')} y ${items[items.length - 1]}`);

export function computeUpmeBaseline(input: UpmeBaselineInput): UpmeBaseline | null {
  const config = input.config ?? {};
  const all = baselinePoints(input.bills);
  const points = withinPeriod(all, config.from, config.to);
  if (points.length < 2) return null;

  const variablesAvailable = completeVariables(points);
  const recommendation = recommendModel(points);
  const available: UpmeModelKind[] = ['valor-absoluto'];
  if (variablesAvailable.length) available.push('cociente');
  if (variablesAvailable.length && points.length > 3) available.push('estadistico');
  let kind: UpmeModelKind = config.model && available.includes(config.model) ? config.model : recommendation.model;
  if (!available.includes(kind)) kind = 'valor-absoluto';

  const applied = (input.adjustments ?? []).filter((a) => a.kind === 'no-rutinario' && a.applied && (a.carrier ?? 'electricidad') === 'electricidad' && a.months?.length && !a.deletedAt);
  const options = { removeOutliers: !config.keepOutliers, anomalies: applied.map((a) => a.months as string[]) };
  const warnings: BaselineWarning[] = [];

  const result: Pick<UpmeBaseline, 'monthly' | 'ratio' | 'statistical' | 'ratioVariable' | 'candidates'> = { candidates: [] };
  if (kind === 'valor-absoluto') {
    result.monthly = absoluteModel(points, options);
  } else if (kind === 'cociente') {
    const variable = config.ratioVariable && variablesAvailable.includes(config.ratioVariable) ? config.ratioVariable : (recommendation.variables[0] ?? variablesAvailable[0]);
    result.ratioVariable = variable;
    result.ratio = ratioModel(points, variable, options);
    result.monthly = result.ratio;
  } else {
    const chosen = (config.variables ?? []).filter((v) => variablesAvailable.includes(v));
    result.candidates = chosen.length ? chosen : variablesAvailable;
    try {
      result.statistical = statisticalModel(points, result.candidates);
    } catch (error) {
      warnings.push({ tone: 'serious', text: `${error instanceof Error ? error.message : String(error)} Se muestra el modelo de valor absoluto.` });
      kind = 'valor-absoluto';
      result.monthly = absoluteModel(points, options);
    }
  }

  const monthly = result.monthly;
  const statistical = result.statistical;
  const from = points[0].period;
  const to = points[points.length - 1].period;

  // ——— Cifras del periodo base ———
  let baselineKwhYear: number | null = null;
  let savingKwhYear: number | null = null;
  let savingPct: number | null = null;
  if (statistical) {
    baselineKwhYear = mean(statistical.rows.map((r) => r.predicted)) * 12;
    savingPct = statistical.potentialPct;
    savingKwhYear = savingPct !== null ? baselineKwhYear * savingPct : null;
  } else if (result.ratio) {
    baselineKwhYear = result.ratio.annualBaselineKwh;
    savingKwhYear = result.ratio.annualSavingKwh;
    savingPct = baselineKwhYear && savingKwhYear !== null ? savingKwhYear / baselineKwhYear : null;
  } else if (monthly) {
    baselineKwhYear = monthly.meanBaseline !== null ? monthly.meanBaseline * 12 : null;
    savingKwhYear = monthly.meanSaving !== null ? monthly.meanSaving * 12 : null;
    savingPct = monthly.savingPct;
  }

  // ——— Avisos ———
  const note = config.note?.trim();
  if (points.length < RECOMMENDED_MONTHS) {
    warnings.push(
      note
        ? { tone: 'info', text: `Periodo base de ${points.length} meses (la resolución recomienda 36). Justificación: ${note}` }
        : { tone: 'warning', text: `Periodo base de ${points.length} meses: la resolución recomienda mínimo 36 meses de facturas (§7.1 y §7.2). Escribe la justificación en el panel.` },
    );
  }
  const notNormalized = points.filter((p) => !p.normalized).length;
  if (notNormalized) warnings.push({ tone: 'info', text: `${notNormalized} ${notNormalized === 1 ? 'factura no trae' : 'facturas no traen'} los días facturados y no se ${notNormalized === 1 ? 'normalizó' : 'normalizaron'} a 30 días.` });
  if (monthly) {
    if (!monthly.complete) {
      const missing = monthly.months.filter((m) => m.baseline === null).map((m) => MONTHS_LONG[m.month - 1]);
      warnings.push({ tone: 'warning', text: `Faltan datos de ${list(missing)}: la LBEn de esos meses no se puede calcular y las cifras anuales son un aproximado (promedio de los meses con dato × 12).` });
    }
    const thin = monthly.months.filter((m) => m.initialCount > 0 && m.initialCount < 3).length;
    if (thin) warnings.push({ tone: 'info', text: `${thin} ${thin === 1 ? 'mes tiene' : 'meses tienen'} menos de 3 datos; el §7.5.1 sugiere al menos tres valores del mismo mes.` });
    const deviationMonths = monthly.months.filter((m) => m.band === 'desviacion').length;
    const bandText = deviationMonths ? 'la banda de verificación (±10 %, o dos desviaciones estándar en los meses con 10 o más datos)' : 'la banda de ±10 %';
    if (deviationMonths) {
      warnings.push({ tone: 'info', text: `${deviationMonths} ${deviationMonths === 1 ? 'mes tiene' : 'meses tienen'} 10 o más datos: se verificaron con dos desviaciones estándar en vez de ±10 % (ecuaciones 4 y 5).` });
    }
    const outside = monthly.months.flatMap((m) => m.data).filter((d) => d.outside);
    if (outside.length) {
      const which = `${list(outside.slice(0, 6).map((d) => periodLabel(d.period)))}${outside.length > 6 ? '…' : ''}`;
      const verb = config.keepOutliers ? (outside.length === 1 ? 'se conservó' : 'se conservaron') : outside.length === 1 ? 'se eliminó' : 'se eliminaron';
      warnings.push({
        tone: 'warning',
        text: `${outside.length} ${outside.length === 1 ? 'dato quedó' : 'datos quedaron'} fuera de ${bandText} y ${verb} (${which}). Si hubo una causa conocida (remodelación, paro, aires fuera de servicio), registra un ajuste no rutinario en vez de eliminar el dato.`,
      });
    }
    const empty = monthly.months.filter((m) => m.allRemoved).length;
    if (empty) warnings.push({ tone: 'serious', text: `En ${empty} ${empty === 1 ? 'mes' : 'meses'} todos los datos quedaron fuera de la banda: se usó el promedio inicial. Revisa esas facturas.` });
    for (const adjustment of monthly.adjustments) {
      warnings.push({ tone: 'info', text: `Ajuste no rutinario de ${adjustment.anomalousMonths.length} meses de ${adjustment.year}: consumieron ${formatNumber(Math.abs(adjustment.proportion) * 100, 1)} % ${adjustment.proportion >= 0 ? 'menos' : 'más'} que los meses normales; se ajustaron los mismos meses de los demás años.` });
    }
    if (applied.length > monthly.adjustments.length && (kind === 'valor-absoluto' || kind === 'cociente')) {
      warnings.push({ tone: 'warning', text: 'Algún ajuste no rutinario no se pudo calcular: los meses deben ser del mismo año y ese año necesita meses normales para compararlos.' });
    }
  }
  if (result.ratio && result.ratio.skipped) warnings.push({ tone: 'info', text: `${result.ratio.skipped} ${result.ratio.skipped === 1 ? 'mes no tiene' : 'meses no tienen'} el dato de «${upmeVariable(result.ratio.variable).label.toLowerCase()}» y no entran al cociente.` });
  if (statistical) {
    for (const step of statistical.steps) {
      if (step.dropped) warnings.push({ tone: 'info', text: `«${upmeVariable(step.dropped.variable).label}» no es significativa (probabilidad ${formatNumber(step.dropped.pValue, 3)} > 0,05) y se descartó (§7.5.3).` });
    }
    if (!statistical.variables.length) warnings.push({ tone: 'warning', text: 'Ninguna variable es significativa: la línea base es el consumo promedio. Prueba con otras variables o con el modelo de valor absoluto.' });
    else if (statistical.model.r2 < 0.5) warnings.push({ tone: 'info', text: `R² de ${formatNumber(statistical.model.r2, 2)}: un valor bajo no invalida el modelo (lo dice la probabilidad); indica que la operación y el mantenimiento explican buena parte del consumo, es decir, potencial de ahorro operacional.` });
    if (applied.length) warnings.push({ tone: 'info', text: 'En el modelo estadístico los ajustes no rutinarios se aplican en el periodo de reporte (Anexo 4, A4.3), no sobre el periodo base.' });
  }

  const attributes = upmeAttributes({
    usage: input.project?.building?.activity ?? input.project?.sector,
    areaM2: input.project?.areaM2,
    floors: input.project?.building?.floors,
    carriers: ['Energía eléctrica'],
    kind,
    variables: statistical ? statistical.variables : result.ratioVariable ? [result.ratioVariable] : [],
    months: points.length,
    initialCount: statistical ? statistical.rows.length : (monthly?.initialCount ?? points.length),
    finalCount: statistical ? statistical.rows.length : (monthly?.finalCount ?? points.length),
    savingPct,
    savingKwhMonth: savingKwhYear !== null ? savingKwhYear / 12 : null,
  });

  return {
    kind,
    recommended: recommendation.model,
    available,
    variablesAvailable,
    points,
    months: points.length,
    from,
    to,
    ratioVariable: result.ratioVariable,
    candidates: result.candidates,
    monthly,
    ratio: result.ratio,
    statistical,
    headline: { baselineKwhYear, savingKwhYear, savingPct },
    warnings,
    attributes,
    appliedAdjustments: applied,
  };
}

/** Texto corto del modelo y su periodo, para tarjetas y para el informe. */
export const baselineSummary = (baseline: UpmeBaseline): string => `${MODEL_LABEL[baseline.kind]} · ${baseline.months} meses (${periodLabel(baseline.from)} a ${periodLabel(baseline.to)})`;

/** Suma anual de la LBEn de los meses que tienen dato, para mostrarla en tarjetas. */
export const baselineTotal = (baseline: UpmeBaseline): number | null => baseline.headline.baselineKwhYear ?? (baseline.monthly ? sum(baseline.monthly.months.map((m) => m.baseline ?? 0)) : null);
