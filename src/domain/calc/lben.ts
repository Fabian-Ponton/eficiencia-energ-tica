import type { Bill, UpmeModelKind, UpmeVariable } from '../types';
import { fitLinearModel, type LinearModel } from './baseline';
import { mean, sum } from './stats';

/**
 * Línea base de consumo energético (LBEn) con el método de la Res. UPME 016 de 2024, §7 y §8 y sus Anexos 1 a 4:
 * modelo de valor absoluto, de cociente de valores medido y estadístico, con el consumo normalizado a 30 días,
 * banda de verificación de ±10 % del promedio del mes (o de dos desviaciones estándar con diez o más datos del mes),
 * depuración de los datos que quedan por fuera, mejor desempeño y ajustes no rutinarios. Todas son funciones puras.
 */

/** Banda de verificación (ecuaciones 3 y 7): ±10 % del promedio de cada mes. */
export const CONFIDENCE_BAND = 0.1;
/**
 * Con diez o más datos de consumo, la resolución sugiere verificar con dos desviaciones estándar en vez de ±10 % (§7.5.1 y §7.5.2,
 * ecuaciones 4 y 5). El texto no dice si el número de datos es el del mes o el de toda la serie; PONTIA lo aplica mes por mes: el
 * promedio de cada mes (LBEn) es el centro de la banda y las desviaciones salen de los datos de ese mismo mes.
 */
export const STD_BAND_MIN_DATA = 10;
/** Desviaciones estándar a cada lado del promedio (ecuación 4). */
export const STD_BAND_FACTOR = 2;
/** Nivel de significancia del modelo estadístico (§7.5.3): una variable con probabilidad mayor a 0,05 se descarta. */
export const SIGNIFICANCE = 0.05;
/** Meses de datos que recomienda la resolución para el periodo base (§7.1 y §7.2: tres años de datos mensuales). */
export const RECOMMENDED_MONTHS = 36;

/** Desviación estándar muestral (n − 1), como la función DESVESTA de Excel que cita la resolución; `null` con menos de dos datos. */
export function standardDeviation(values: readonly number[]): number | null {
  if (values.length < 2) return null;
  const average = mean(values);
  return Math.sqrt(sum(values.map((v) => (v - average) ** 2)) / (values.length - 1));
}

/** Desviación estándar de la población (ecuación 5 de la resolución: la suma de los cuadrados de las diferencias entre N); `null` sin datos. */
export function populationStdDev(values: readonly number[]): number | null {
  if (!values.length) return null;
  const average = mean(values);
  return Math.sqrt(sum(values.map((v) => (v - average) ** 2)) / values.length);
}

// ——— Variables relevantes y serie mensual ———

export type { UpmeModelKind, UpmeVariable };

export interface UpmeVariableDef {
  id: UpmeVariable;
  label: string;
  /** Unidad de la variable; el cociente del modelo se expresa en `ratioUnit`. */
  unit: string;
  ratioUnit: string;
  read: (bill: Bill) => number | undefined;
}

export const UPME_VARIABLES: readonly UpmeVariableDef[] = [
  { id: 'personas', label: 'Personas atendidas por mes', unit: 'personas', ratioUnit: 'kWh/persona', read: (b) => b.populationServed },
  { id: 'horasPractica', label: 'Horas de práctica por mes', unit: 'h', ratioUnit: 'kWh/h de práctica', read: (b) => b.practiceHours },
  { id: 'gde', label: 'Grados-día de enfriamiento', unit: '°C·día', ratioUnit: 'kWh/°C·día', read: (b) => b.coolingDegreeDays },
  { id: 'diasHabiles', label: 'Días hábiles', unit: 'días', ratioUnit: 'kWh/día hábil', read: (b) => b.workingDays },
  { id: 'temperatura', label: 'Temperatura media', unit: '°C', ratioUnit: 'kWh/°C', read: (b) => b.avgTemperatureC },
  { id: 'ocupacion', label: 'Ocupación', unit: '%', ratioUnit: 'kWh/% de ocupación', read: (b) => b.occupancyPct },
];

export const upmeVariable = (id: UpmeVariable): UpmeVariableDef => UPME_VARIABLES.find((v) => v.id === id) ?? UPME_VARIABLES[0];

/** Ecuación 1: el consumo facturado entre los días del periodo, por 30. */
export const normalizeTo30Days = (kwh: number, days: number): number => (kwh / days) * 30;

export interface BaselinePoint {
  /** AAAA-MM */
  period: string;
  year: number;
  month: number;
  /** Consumo del mes: normalizado a 30 días si la factura trae sus días. */
  kwh: number;
  billedKwh: number;
  days?: number;
  normalized: boolean;
  variables: Partial<Record<UpmeVariable, number>>;
}

/** Serie mensual del periodo base a partir de las facturas de un energético, ordenada por mes. */
export function baselinePoints(bills: readonly Bill[], options: { normalize?: boolean } = {}): BaselinePoint[] {
  const normalize = options.normalize ?? true;
  return [...bills]
    .sort((a, b) => a.period.localeCompare(b.period))
    .map((bill) => {
      const days = bill.days && bill.days > 0 ? bill.days : undefined;
      const variables: BaselinePoint['variables'] = {};
      for (const v of UPME_VARIABLES) {
        const value = v.read(bill);
        if (typeof value === 'number' && Number.isFinite(value)) variables[v.id] = value;
      }
      return {
        period: bill.period,
        year: Number(bill.period.slice(0, 4)),
        month: Number(bill.period.slice(5, 7)),
        kwh: normalize && days ? normalizeTo30Days(bill.kwh, days) : bill.kwh,
        billedKwh: bill.kwh,
        days,
        normalized: normalize && Boolean(days),
        variables,
      };
    });
}

/** Recorta la serie al periodo base elegido (AAAA-MM, ambos extremos incluidos). */
export const withinPeriod = (points: readonly BaselinePoint[], from?: string, to?: string): BaselinePoint[] =>
  points.filter((p) => (!from || p.period >= from) && (!to || p.period <= to));

/** Variables con dato en todos los meses de la serie: las que sirven para el cociente o para la regresión. */
export const completeVariables = (points: readonly BaselinePoint[]): UpmeVariable[] =>
  points.length
    ? UPME_VARIABLES.filter((v) => points.every((p) => typeof p.variables[v.id] === 'number')).map((v) => v.id)
    : [];

// ——— Modelos de valor absoluto y de cociente (promedio del mismo mes) ———

/** Cómo se verificó el mes: ±10 % del promedio o, con diez o más datos, dos desviaciones estándar. */
export type BandKind = 'porcentaje' | 'desviacion';

export interface MonthDatum {
  period: string;
  year: number;
  value: number;
  /** Quedó por fuera de la banda del mes (±10 % o dos desviaciones estándar). */
  outside: boolean;
  /** Se eliminó: no entra a la LBEn. Solo ocurre si se pidió depurar. */
  removed: boolean;
}

export interface BaselineMonth {
  month: number;
  data: MonthDatum[];
  initialCount: number;
  finalCount: number;
  /** Promedio de todos los datos del mes (ecuaciones 2 y 6): es el centro de la banda. */
  initialAverage: number | null;
  upper: number | null;
  lower: number | null;
  /** Qué banda se usó en el mes; `null` si el mes no tiene datos. */
  band: BandKind | null;
  /** LBEn del mes con los datos depurados. */
  baseline: number | null;
  minimum: number | null;
  /** Desviación estándar de los datos que quedaron (la que se reporta a la UPME junto con la LBEn del mes). */
  stdDev: number | null;
  /** Potencial por mejor desempeño: LBEn menos el mínimo del mes, y su fracción de la LBEn. */
  saving: number | null;
  savingPct: number | null;
  /** Todos los datos del mes quedaron por fuera de la banda: la LBEn usa el promedio inicial. */
  allRemoved: boolean;
}

export interface MonthlyModel {
  months: BaselineMonth[];
  initialCount: number;
  finalCount: number;
  /** Meses del año con al menos un dato. */
  monthsCovered: number;
  /** Los 12 meses tienen dato: las cifras anuales son completas. */
  complete: boolean;
  /** Promedio mensual de la LBEn, del mínimo y del ahorro, y el ahorro como fracción de la LBEn (última fila de la tabla de los anexos). */
  meanBaseline: number | null;
  meanMinimum: number | null;
  meanSaving: number | null;
  savingPct: number | null;
  /** Ajustes no rutinarios que se aplicaron a la serie antes de calcular (Anexo 4). */
  adjustments: NonRoutineProportion[];
}

export interface MonthlyOptions {
  /** Banda alrededor del promedio; 0,10 por omisión. */
  band?: number;
  /** Con diez o más datos del mes, usar dos desviaciones estándar (ecuaciones 4 y 5); `false` mantiene siempre la banda porcentual. */
  deviationBand?: boolean;
  /** Eliminar los datos por fuera de la banda (lo que pide el §7.5.1); `false` para conservarlos y solo marcarlos. */
  removeOutliers?: boolean;
  /** Grupos de meses anómalos (AAAA-MM) declarados como ajuste no rutinario: cada uno se corrige con el procedimiento del Anexo 4 antes de calcular. */
  anomalies?: readonly (readonly string[])[];
}

const EPS = 1e-9;

/** Tabla mensual de los Anexos 1 y 2: promedio del mismo mes, banda de ±10 %, depuración, mínimo y ahorro por mejor desempeño. */
export function monthlyModel(source: readonly { period: string; value: number }[], options: MonthlyOptions = {}): MonthlyModel {
  const band = options.band ?? CONFIDENCE_BAND;
  const deviationBand = options.deviationBand ?? true;
  const remove = options.removeOutliers ?? true;
  let entries = source;
  const adjustments: NonRoutineProportion[] = [];
  for (const months of options.anomalies ?? []) {
    const proportion = nonRoutineProportion(entries, months);
    if (!proportion) continue;
    adjustments.push(proportion);
    entries = applyNonRoutine(entries, (e) => e.value, (e, value) => ({ ...e, value }), proportion);
  }
  const months: BaselineMonth[] = Array.from({ length: 12 }, (_, i) => {
    const month = i + 1;
    const data = entries.filter((e) => Number(e.period.slice(5, 7)) === month && Number.isFinite(e.value));
    if (!data.length) {
      return { month, data: [], initialCount: 0, finalCount: 0, initialAverage: null, upper: null, lower: null, band: null, baseline: null, minimum: null, stdDev: null, saving: null, savingPct: null, allRemoved: false };
    }
    const initialAverage = mean(data.map((d) => d.value));
    // Con diez o más datos del mes, dos desviaciones estándar (ecuaciones 4 y 5); si no, ±10 % del promedio (ecuaciones 3 y 7)
    const sigma = deviationBand && data.length >= STD_BAND_MIN_DATA ? populationStdDev(data.map((d) => d.value)) : null;
    const bandKind: BandKind = sigma !== null ? 'desviacion' : 'porcentaje';
    const upper = sigma !== null ? initialAverage + STD_BAND_FACTOR * sigma : initialAverage * (1 + band);
    const lower = sigma !== null ? initialAverage - STD_BAND_FACTOR * sigma : initialAverage * (1 - band);
    const tolerance = EPS * Math.max(Math.abs(upper), Math.abs(lower), 1);
    const flagged: MonthDatum[] = data.map((d) => {
      const outside = d.value > upper + tolerance || d.value < lower - tolerance;
      return { period: d.period, year: Number(d.period.slice(0, 4)), value: d.value, outside, removed: remove && outside };
    });
    const kept = flagged.filter((d) => !d.removed);
    const baseline = kept.length ? mean(kept.map((d) => d.value)) : initialAverage;
    const minimum = Math.min(...(kept.length ? kept : flagged).map((d) => d.value));
    const saving = baseline - minimum;
    return {
      month,
      data: flagged.sort((a, b) => a.year - b.year),
      initialCount: flagged.length,
      finalCount: kept.length,
      initialAverage,
      upper,
      lower,
      band: bandKind,
      baseline,
      minimum,
      stdDev: standardDeviation((kept.length ? kept : flagged).map((d) => d.value)),
      saving,
      savingPct: baseline > 0 ? saving / baseline : null,
      allRemoved: kept.length === 0,
    };
  });
  const covered = months.filter((m) => m.baseline !== null);
  const meanBaseline = covered.length ? mean(covered.map((m) => m.baseline as number)) : null;
  const meanSaving = covered.length ? mean(covered.map((m) => m.saving as number)) : null;
  return {
    months,
    initialCount: sum(months.map((m) => m.initialCount)),
    finalCount: sum(months.map((m) => m.finalCount)),
    monthsCovered: covered.length,
    complete: covered.length === 12,
    meanBaseline,
    meanMinimum: covered.length ? mean(covered.map((m) => m.minimum as number)) : null,
    meanSaving,
    savingPct: meanBaseline && meanSaving !== null ? meanSaving / meanBaseline : null,
    adjustments,
  };
}

/** Modelo de valor absoluto (§7.5.1): el promedio del consumo normalizado de cada mes. */
export const absoluteModel = (points: readonly BaselinePoint[], options?: MonthlyOptions): MonthlyModel =>
  monthlyModel(
    points.map((p) => ({ period: p.period, value: p.kwh })),
    options,
  );

export interface RatioModel extends MonthlyModel {
  variable: UpmeVariable;
  ratioUnit: string;
  /** Meses sin dato de la variable, que no entran al cociente. */
  skipped: number;
  /** Promedio mensual de la variable por mes del año (el nivel de actividad con que se pasa el cociente a kWh). */
  activity: (number | null)[];
  /** LBEn y ahorro de cada mes del año en kWh: cociente × actividad promedio del mes. */
  baselineKwh: (number | null)[];
  savingKwh: (number | null)[];
  annualBaselineKwh: number | null;
  annualSavingKwh: number | null;
}

/** Modelo de cociente de valores medido (§7.5.2): kWh por unidad de la variable relevante, promediado por mes. */
export function ratioModel(points: readonly BaselinePoint[], variable: UpmeVariable, options?: MonthlyOptions): RatioModel {
  const usable = points.filter((p) => (p.variables[variable] ?? 0) > 0);
  const model = monthlyModel(
    usable.map((p) => ({ period: p.period, value: p.kwh / (p.variables[variable] as number) })),
    options,
  );
  const activity = Array.from({ length: 12 }, (_, i) => {
    const values = usable.filter((p) => p.month === i + 1).map((p) => p.variables[variable] as number);
    return values.length ? mean(values) : null;
  });
  const baselineKwh = model.months.map((m, i) => (m.baseline !== null && activity[i] !== null ? m.baseline * (activity[i] as number) : null));
  const savingKwh = model.months.map((m, i) => (m.saving !== null && activity[i] !== null ? m.saving * (activity[i] as number) : null));
  const total = (values: (number | null)[]) => (values.some((v) => v !== null) ? sum(values.filter((v): v is number => v !== null)) : null);
  return {
    ...model,
    variable,
    ratioUnit: upmeVariable(variable).ratioUnit,
    skipped: points.length - usable.length,
    activity,
    baselineKwh,
    savingKwh,
    annualBaselineKwh: total(baselineKwh),
    annualSavingKwh: total(savingKwh),
  };
}

// ——— Modelo estadístico (§7.5.3) ———

export interface RegressionStep {
  variables: UpmeVariable[];
  model: LinearModel;
  /** Variable que se descartó después de este ajuste por tener probabilidad mayor a 0,05. */
  dropped?: { variable: UpmeVariable; pValue: number };
}

export interface FitRow {
  period: string;
  actual: number;
  predicted: number;
  /** |real − estimado| ÷ real. */
  errorPct: number;
}

export interface TargetLine {
  model: LinearModel;
  /** Meses con consumo por debajo de la LBEn: son los que construyen la línea meta. */
  bestPeriods: string[];
  rows: { period: string; baseline: number; target: number; saving: number; savingPct: number }[];
}

export interface StatisticalModel {
  candidates: UpmeVariable[];
  steps: RegressionStep[];
  /** Variables que quedaron (todas con probabilidad ≤ 0,05). Vacío: la línea base es el promedio. */
  variables: UpmeVariable[];
  model: LinearModel;
  rows: FitRow[];
  meanErrorPct: number;
  /** Observaciones con error mayor al 5 %. */
  errorsOver5Pct: number;
  /** Máximo, mínimo, promedio y desviación estándar del consumo del periodo base, que también se reportan a la UPME. */
  consumption: { maximum: number; minimum: number; average: number; stdDev: number | null };
  target: TargetLine | null;
  /** Potencial por mejor desempeño (ecuación 12): el ahorro de los meses entre la LBEn y la línea meta, como fracción de la LBEn. */
  potentialPct: number | null;
}

function fitRows(points: readonly BaselinePoint[], variables: readonly UpmeVariable[], model: LinearModel): FitRow[] {
  return points.map((p) => {
    const predicted = model.predict(variables.map((v) => p.variables[v] as number));
    return { period: p.period, actual: p.kwh, predicted, errorPct: p.kwh !== 0 ? Math.abs(p.kwh - predicted) / Math.abs(p.kwh) : 0 };
  });
}

/**
 * Línea meta del mejor desempeño (§8.1): con los meses que consumieron menos que la LBEn se ajusta una segunda regresión;
 * el potencial de cada mes es la diferencia entre ambas líneas evaluadas con la variable del mes.
 */
export function targetLine(points: readonly BaselinePoint[], variables: readonly UpmeVariable[], model: LinearModel): TargetLine | null {
  const rows = fitRows(points, variables, model);
  const best = points.filter((_, i) => rows[i].actual < rows[i].predicted);
  if (best.length < variables.length + 2) return null;
  let meta: LinearModel;
  try {
    meta = fitLinearModel(
      best.map((p) => p.kwh),
      best.map((p) => variables.map((v) => p.variables[v] as number)),
    );
  } catch {
    return null;
  }
  return {
    model: meta,
    bestPeriods: best.map((p) => p.period),
    rows: points.map((p, i) => {
      const target = meta.predict(variables.map((v) => p.variables[v] as number));
      const baseline = rows[i].predicted;
      return { period: p.period, baseline, target, saving: baseline - target, savingPct: baseline !== 0 ? (baseline - target) / baseline : 0 };
    }),
  };
}

/**
 * Modelo estadístico: regresión lineal de todas las variables candidatas; mientras alguna tenga probabilidad mayor a 0,05
 * se descarta la menos significativa y se vuelve a correr (§7.5.3). Con las que quedan se construye la LBEn y la línea meta.
 */
export function statisticalModel(points: readonly BaselinePoint[], candidates: readonly UpmeVariable[]): StatisticalModel {
  const usable = points.filter((p) => candidates.every((v) => typeof p.variables[v] === 'number'));
  let variables = [...candidates];
  const steps: RegressionStep[] = [];
  let model: LinearModel;
  for (;;) {
    model = fitLinearModel(
      usable.map((p) => p.kwh),
      usable.map((p) => variables.map((v) => p.variables[v] as number)),
    );
    const step: RegressionStep = { variables: [...variables], model };
    steps.push(step);
    // pValues[0] es el intercepto: solo se juzgan las variables
    const worst = variables.map((variable, i) => ({ variable, pValue: model.pValues[i + 1] })).sort((a, b) => b.pValue - a.pValue)[0];
    if (!worst || !(worst.pValue > SIGNIFICANCE)) break;
    step.dropped = worst;
    variables = variables.filter((v) => v !== worst.variable);
  }
  const rows = fitRows(usable, variables, model);
  const target = variables.length ? targetLine(usable, variables, model) : null;
  return {
    candidates: [...candidates],
    steps,
    variables,
    model,
    rows,
    meanErrorPct: mean(rows.map((r) => r.errorPct)),
    errorsOver5Pct: rows.filter((r) => r.errorPct > 0.05).length,
    consumption: {
      maximum: Math.max(...rows.map((r) => r.actual)),
      minimum: Math.min(...rows.map((r) => r.actual)),
      average: mean(rows.map((r) => r.actual)),
      stdDev: standardDeviation(rows.map((r) => r.actual)),
    },
    target,
    potentialPct: target && sum(target.rows.map((r) => r.baseline)) > 0 ? sum(target.rows.map((r) => r.saving)) / sum(target.rows.map((r) => r.baseline)) : null,
  };
}

// ——— Elección del modelo ———

export const MODEL_LABEL: Record<UpmeModelKind, string> = {
  'valor-absoluto': 'Valor absoluto de energía',
  cociente: 'Cociente de valores medido (relación simple)',
  estadistico: 'Modelo estadístico (regresión lineal)',
};

/**
 * Recomendación del §7.5: solo consumo → valor absoluto; una variable relevante → cociente; dos o más → estadístico.
 * Las variables cuentan si tienen dato en todos los meses del periodo base.
 */
export function recommendModel(points: readonly BaselinePoint[]): { model: UpmeModelKind; variables: UpmeVariable[] } {
  const variables = completeVariables(points);
  if (variables.length >= 2 && points.length > variables.length + 2) return { model: 'estadistico', variables };
  if (variables.length >= 1) return { model: 'cociente', variables: [variables[0]] };
  return { model: 'valor-absoluto', variables: [] };
}

// ——— Ajustes de la línea base (Anexo 4) ———

export interface NonRoutineProportion {
  year: number;
  normalMonths: number[];
  anomalousMonths: number[];
  normalAverage: number;
  anomalousAverage: number;
  difference: number;
  /** Diferencia entre el promedio normal y el anómalo, como fracción del promedio normal. */
  proportion: number;
}

/**
 * Ajuste no rutinario en el periodo base (Anexo 4, A4.1 y A4.2): en el año del suceso se compara el promedio de los meses
 * anómalos con el de los meses normales; la proporción de la diferencia se aplica a los mismos meses de los otros años.
 */
export function nonRoutineProportion(entries: readonly { period: string; value: number }[], anomalousPeriods: readonly string[]): NonRoutineProportion | null {
  const anomalous = entries.filter((e) => anomalousPeriods.includes(e.period));
  if (!anomalous.length) return null;
  const year = Number(anomalous[0].period.slice(0, 4));
  if (anomalous.some((e) => Number(e.period.slice(0, 4)) !== year)) return null;
  const normal = entries.filter((e) => Number(e.period.slice(0, 4)) === year && !anomalousPeriods.includes(e.period));
  if (!normal.length) return null;
  const normalAverage = mean(normal.map((e) => e.value));
  const anomalousAverage = mean(anomalous.map((e) => e.value));
  return {
    year,
    normalMonths: normal.map((e) => Number(e.period.slice(5, 7))),
    anomalousMonths: anomalous.map((e) => Number(e.period.slice(5, 7))),
    normalAverage,
    anomalousAverage,
    difference: normalAverage - anomalousAverage,
    proportion: normalAverage > 0 ? (normalAverage - anomalousAverage) / normalAverage : 0,
  };
}

/** Aplica la proporción a los mismos meses de los demás años: cada valor se multiplica por (1 − proporción). */
export function applyNonRoutine<T extends { period: string }>(items: readonly T[], value: (item: T) => number, set: (item: T, value: number) => T, adjustment: NonRoutineProportion): T[] {
  return items.map((item) => {
    const year = Number(item.period.slice(0, 4));
    const month = Number(item.period.slice(5, 7));
    return year !== adjustment.year && adjustment.anomalousMonths.includes(month) ? set(item, value(item) * (1 - adjustment.proportion)) : item;
  });
}

/** Ahorros con ajustes: (consumo de la LBEn ± ajustes rutinarios ± ajustes no rutinarios) − consumo del periodo de reporte. */
export const savingsWithAdjustments = (baselineKwh: number, reportKwh: number, routineKwh = 0, nonRoutineKwh = 0): number => baselineKwh + routineKwh + nonRoutineKwh - reportKwh;

// ——— Información que se reporta a la UPME (Paso 7 de los anexos) ———

export interface UpmeAttributes {
  attribute: string;
  description: string;
  note?: string;
}

export interface UpmeAttributesInput {
  usage?: string;
  areaM2?: number;
  floors?: number;
  carriers: string[];
  kind: UpmeModelKind;
  variables: UpmeVariable[];
  months: number;
  initialCount: number;
  finalCount: number;
  savingPct?: number | null;
  savingKwhMonth?: number | null;
}

/** Las filas de la tabla «Información a reportar a la UPME» (Anexos 1 a 3, Paso 7). */
export function upmeAttributes(input: UpmeAttributesInput): UpmeAttributes[] {
  const years = input.months / 12;
  const rows: UpmeAttributes[] = [
    { attribute: 'Uso/destino del edificio', description: input.usage ?? 'Sin registrar' },
    { attribute: 'Área útil', description: input.areaM2 ? `${Math.round(input.areaM2).toLocaleString('es-CO')} m²` : 'Sin registrar', note: input.floors ? `${input.floors} pisos` : undefined },
    { attribute: 'Energéticos utilizados', description: input.carriers.join(', ') || 'Energía eléctrica' },
  ];
  if (input.kind !== 'valor-absoluto') rows.push({ attribute: 'Variable relevante', description: input.variables.map((v) => upmeVariable(v).label).join(', ') || 'Ninguna significativa' });
  rows.push(
    { attribute: 'Modelo de LBEn seleccionado', description: MODEL_LABEL[input.kind] },
    { attribute: 'Periodo base', description: `${years >= 1 ? `${Number.isInteger(years) ? years : years.toFixed(1)} años` : `${input.months} meses`}`, note: 'Datos mensuales' },
    { attribute: 'Cantidad de datos iniciales', description: String(input.initialCount) },
    { attribute: 'Cantidad de datos finales', description: String(input.finalCount) },
    { attribute: 'LBEn', description: input.kind === 'valor-absoluto' ? 'Valor promedio del mes' : input.kind === 'cociente' ? 'Valor del cociente de consumo promedio del mes' : 'Ecuación de regresión de la(s) variable(s) significativa(s)', note: 'Datos mensuales' },
  );
  if (input.savingPct !== null && input.savingPct !== undefined) {
    rows.push({
      attribute: 'Ahorro estimado',
      description: `${(input.savingPct * 100).toLocaleString('es-CO', { maximumFractionDigits: 1 })} %${input.savingKwhMonth ? ` · ${Math.round(input.savingKwhMonth).toLocaleString('es-CO')} kWh/mes` : ''}`,
      note: 'Valor mensual en kWh y porcentaje',
    });
  }
  return rows;
}
