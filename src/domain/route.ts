import { formatNumber, formatPercent } from '@/utils/format';
import { sum } from './calc/stats';
import { planSummary } from './measures';
import type { Measure, Pgee, RouteYear, Task } from './types';

/**
 * Meta legal y ruta de cumplimiento anual del PGEE.
 *
 * Ley 1715 de 2014, art. 30, modificado por la Ley 2294 de 2023, art. 237: cada entidad debe implementar, en el año siguiente a la
 * auditoría, estrategias que permitan un ahorro de mínimo el 15 % «respecto del consumo del año anterior» y, desde el segundo año,
 * «metas sostenibles definidas por la auditoría y a ser alcanzadas a más tardar en el año 2026». Res. MME 40412 de 2024, art. 4,
 * par. 3: el PGEE incluye «una ruta de cumplimiento anual de ahorro energético» y un responsable de su seguimiento y evaluación.
 *
 * La ley no dice a qué año se refiere «el año anterior» ni interpreta el plazo «a más tardar en el año 2026»: PONTIA propone el año de
 * la auditoría y los últimos 12 meses facturados, deja cambiarlos, y muestra el plazo de la ley tal cual.
 */
export const LEGAL_GOAL_PCT = 15;

// ——— Tipo de medida por retorno de la inversión (Guía UPME de PGEE, dic. 2020, Tabla 9) ———

export type MeasureClass = 'A' | 'B' | 'C';

export const MEASURE_CLASSES: Record<MeasureClass, { label: string; range: string; examples: string }> = {
  A: { label: 'Tipo A', range: 'retorno menor de 1 año', examples: 'buenas prácticas operativas, administrativas y de gestión' },
  B: { label: 'Tipo B', range: 'retorno de 1 a 3 años', examples: 'medidas pasivas con gran potencial y sustitución de iluminación y aire acondicionado' },
  C: { label: 'Tipo C', range: 'retorno de más de 3 años', examples: 'centrales de agua helada, variadores de velocidad y autogeneración fotovoltaica' },
};

/** La guía clasifica las medidas por lo que tarda en recuperarse la inversión: menos de un año (A), de uno a tres (B) y más de tres (C). */
export function measureClassOf(paybackYears: number): MeasureClass {
  if (Number.isNaN(paybackYears)) return 'C';
  if (paybackYears < 1) return 'A';
  return paybackYears <= 3 ? 'B' : 'C';
}

// ——— Año de referencia y meta legal ———

/** Año de la auditoría: el de su fecha o, sin ella, el de la última factura o el actual. El primer año del plan es el siguiente. */
export function defaultBaseYear(input: { auditDate?: string; lastPeriod?: string; today: Date }): number {
  const fromAudit = /^(\d{4})-/.exec(input.auditDate ?? '')?.[1];
  if (fromAudit) return Number(fromAudit);
  const fromBills = /^(\d{4})-/.exec(input.lastPeriod ?? '')?.[1];
  return fromBills ? Number(fromBills) : input.today.getFullYear();
}

/** Lo que el auditor cambió de la meta legal; lo que falte se calcula. */
export type LegalGoalOverride = Partial<NonNullable<Pgee['legalGoal']>>;

export interface LegalGoal {
  /** Año del consumo de referencia («el año anterior»). */
  baseYear: number;
  /** Primer año de la ruta: el siguiente a la auditoría. */
  firstYear: number;
  /** Porcentaje mínimo de ahorro. */
  pct: number;
  /** Consumo de referencia (kWh/año); `null` si aún no se conoce. */
  referenceKwh: number | null;
  /** El auditor escribió el consumo o el año en vez de tomarlos de las facturas. */
  overridden: boolean;
  /** Ahorro mínimo en kWh/año. */
  targetKwh: number | null;
}

/**
 * Meta legal del primer año: el porcentaje sobre el consumo del año anterior. Lo escrito por el auditor manda sobre lo calculado
 * con las facturas; un porcentaje menor al legal no se admite (se sube a 15 %).
 */
export function legalGoalOf(input: { stored?: LegalGoalOverride; baseYear: number; referenceKwh: number | null }): LegalGoal {
  const baseYear = input.stored?.baseYear ?? input.baseYear;
  const pct = Math.max(LEGAL_GOAL_PCT, input.stored?.pct ?? LEGAL_GOAL_PCT);
  const override = input.stored?.previousYearKwh;
  const written = override !== undefined && override > 0;
  const referenceKwh = written ? override : input.referenceKwh;
  return {
    baseYear,
    firstYear: baseYear + 1,
    pct,
    referenceKwh,
    overridden: written || baseYear !== input.baseYear,
    targetKwh: referenceKwh !== null ? (referenceKwh * pct) / 100 : null,
  };
}

// ——— Ruta anual ———

/** Años de demora por prioridad cuando la medida no tiene tareas con fecha: alta el primer año, media el segundo y baja el tercero. */
const YEARS_LATER: Record<NonNullable<Measure['priority']>, number> = { alta: 0, media: 1, baja: 2 };

export type RouteBasis = 'tareas' | 'prioridad';

/**
 * Año en que la medida entra en operación: el de la última de sus tareas con fecha de fin (nunca antes del primer año de la ruta) o,
 * si no tiene tareas con fecha, el que le da su prioridad.
 */
export function implementationYear(m: Pick<Measure, 'id' | 'priority'>, tasks: readonly Pick<Task, 'measureId' | 'end'>[], firstYear: number): { year: number; basis: RouteBasis } {
  const ends = tasks
    .filter((t) => t.measureId === m.id && t.end)
    .map((t) => Number(/^(\d{4})-/.exec(t.end ?? '')?.[1]))
    .filter((year) => Number.isFinite(year));
  if (ends.length) return { year: Math.max(firstYear, ...ends), basis: 'tareas' };
  return { year: firstYear + YEARS_LATER[m.priority ?? 'baja'], basis: 'prioridad' };
}

/** Ahorro anual de un conjunto de medidas, descontando el solapamiento cuando el análisis del plan lo detecta. */
export function combinedSavingsKwh(measures: readonly Measure[], referenceKwh: number | null): number {
  const summary = planSummary(
    measures.map((m) => ({ ...m, selected: true })),
    referenceKwh,
  );
  return summary.interaction?.combinedKwh ?? summary.kwh;
}

export interface RouteInput {
  /** Medidas del proyecto: solo entran las incluidas en el plan. */
  measures: readonly Measure[];
  tasks: readonly Task[];
  firstYear: number;
  referenceKwh: number | null;
}

const floor1 = (value: number) => Math.floor(value * 10 + 1e-9) / 10;
const byMeasureCode = (a: string, b: string) => a.localeCompare(b, 'es', { numeric: true });

/**
 * Ruta que propone PONTIA: cada medida del plan en el año en que entra en operación y, como meta de cada año, lo que el plan ahorra
 * hasta entonces (sin bajar del mínimo legal en el primer año y sin que baje de un año a otro). El presupuesto de cada año sigue a las
 * inversiones de sus medidas mientras el auditor no escriba otro.
 */
export function proposeRoute(input: RouteInput): RouteYear[] {
  const plan = input.measures.filter((m) => m.selected);
  const placed = plan.map((m) => ({ m, ...implementationYear(m, input.tasks, input.firstYear) }));
  const lastYear = Math.max(input.firstYear, ...placed.map((p) => p.year));
  const rows: RouteYear[] = [];
  let previousTarget = 0;
  for (let year = input.firstYear; year <= lastYear; year++) {
    const entering = placed.filter((p) => p.year === year).map((p) => p.m);
    const operating = placed.filter((p) => p.year <= year).map((p) => p.m);
    const plannedKwh = combinedSavingsKwh(operating, input.referenceKwh);
    const plannedPct = input.referenceKwh ? (plannedKwh / input.referenceKwh) * 100 : null;
    let targetPct: number | undefined;
    if (plannedPct !== null || year === input.firstYear) {
      targetPct = Math.max(previousTarget, plannedPct !== null ? floor1(plannedPct) : 0, year === input.firstYear ? LEGAL_GOAL_PCT : 0);
      previousTarget = targetPct;
    }
    rows.push({
      year,
      targetPct,
      measureCodes: entering.map((m) => m.code).sort(byMeasureCode),
    });
  }
  return rows;
}

export type RouteStatus = 'cumple' | 'no-cumple' | 'sin-meta';

export interface RouteRow {
  year: number;
  measureCodes: string[];
  /** Ahorro anual que aportan las medidas que entran en operación ese año (kWh/año), sin descontar el solapamiento. */
  addedKwh: number;
  /** Ahorro anual previsto al cierre del año con todas las medidas que ya operan (kWh/año), con el solapamiento descontado. */
  plannedKwh: number;
  plannedPct: number | null;
  targetPct: number | null;
  targetKwh: number | null;
  budgetCop: number;
  /** Primer año de la ruta: la meta no puede bajar del mínimo legal. */
  legalMinimum: boolean;
  status: RouteStatus;
  /** Lo que falta para la meta (kWh/año); 0 si se cumple. */
  gapKwh: number;
  note?: string;
}

/** Cada fila de la ruta con su ahorro previsto acumulado frente a la meta del año. */
export function routeRows(route: readonly RouteYear[], input: RouteInput & { legal: LegalGoal }): RouteRow[] {
  const byCode = new Map(input.measures.filter((m) => m.selected).map((m) => [m.code, m]));
  const operating = new Map<string, Measure>();
  return [...route]
    .sort((a, b) => a.year - b.year)
    .map((row) => {
      const entering = row.measureCodes.map((code) => byCode.get(code)).filter((m): m is Measure => Boolean(m));
      for (const m of entering) operating.set(m.code, m);
      const plannedKwh = combinedSavingsKwh([...operating.values()], input.referenceKwh);
      const plannedPct = input.referenceKwh ? (plannedKwh / input.referenceKwh) * 100 : null;
      const legalMinimum = row.year === input.legal.firstYear;
      // El mínimo legal manda en el primer año aunque la meta escrita sea menor
      const targetPct = row.targetPct !== undefined || legalMinimum ? Math.max(row.targetPct ?? 0, legalMinimum ? input.legal.pct : 0) : null;
      const targetKwh = targetPct !== null && input.referenceKwh ? (input.referenceKwh * targetPct) / 100 : null;
      const status: RouteStatus = targetKwh === null ? 'sin-meta' : plannedKwh + 1e-6 >= targetKwh ? 'cumple' : 'no-cumple';
      return {
        year: row.year,
        measureCodes: [...row.measureCodes],
        addedKwh: sum(entering.map((m) => m.savingsKwhYear)),
        plannedKwh,
        plannedPct,
        targetPct,
        targetKwh,
        budgetCop: row.budgetCop ?? sum(entering.map((m) => m.investmentCop)),
        legalMinimum,
        status,
        gapKwh: targetKwh !== null ? Math.max(0, targetKwh - plannedKwh) : 0,
        note: row.note,
      };
    });
}

export interface EffectiveRoute {
  rows: RouteYear[];
  /** Ruta propuesta por PONTIA que el auditor aún no confirmó. */
  proposed: boolean;
}

/** La ruta guardada por el auditor o, si no hay, la propuesta. */
export function effectiveRoute(stored: readonly RouteYear[] | undefined, input: RouteInput): EffectiveRoute {
  return stored?.length ? { rows: [...stored], proposed: false } : { rows: proposeRoute(input), proposed: true };
}

/** Ruta con la meta, el presupuesto o la nota de un año cambiados; los años quedan en orden. */
export function patchRouteYear(route: readonly RouteYear[], year: number, changes: Partial<Omit<RouteYear, 'year' | 'measureCodes'>>): RouteYear[] {
  return route.map((r) => (r.year === year ? { ...r, ...changes } : { ...r })).sort((a, b) => a.year - b.year);
}

/** Pasa una medida al año indicado (la quita del año donde estaba); si el año no está en la ruta, lo crea. */
export function moveMeasure(route: readonly RouteYear[], code: string, year: number): RouteYear[] {
  const rows = route.map((r) => ({ ...r, measureCodes: r.measureCodes.filter((c) => c !== code) }));
  const target = rows.find((r) => r.year === year);
  if (target) target.measureCodes = [...target.measureCodes, code].sort(byMeasureCode);
  else rows.push({ year, measureCodes: [code] });
  return rows.sort((a, b) => a.year - b.year);
}

/** Agrega el año siguiente al último de la ruta (o el primero, si la ruta está vacía). */
export function addRouteYear(route: readonly RouteYear[], firstYear: number): RouteYear[] {
  const next = route.length ? Math.max(...route.map((r) => r.year)) + 1 : firstYear;
  return [...route.map((r) => ({ ...r })), { year: next, measureCodes: [] }];
}

/** Quita un año de la ruta solo si no tiene medidas; con medidas devuelve la ruta igual (primero hay que pasarlas a otro año). */
export function removeRouteYear(route: readonly RouteYear[], year: number): RouteYear[] {
  return route.filter((r) => r.year !== year || r.measureCodes.length > 0).map((r) => ({ ...r }));
}

/** Medidas del plan que ninguna fila de la ruta menciona. */
export function unassignedMeasures(route: readonly RouteYear[], measures: readonly Measure[]): Measure[] {
  const assigned = new Set(route.flatMap((r) => r.measureCodes));
  return measures.filter((m) => m.selected && !assigned.has(m.code)).sort((a, b) => byMeasureCode(a.code, b.code));
}

export interface RouteNotice {
  tone: 'critical' | 'warning' | 'info';
  text: string;
}

const pct = (value: number | null, decimals = 1) => (value === null ? '—' : formatPercent(value / 100, decimals));

/** Avisos de la ruta: lo que impide cumplir la meta legal y lo que falta para verla. */
export function routeNotices(rows: readonly RouteRow[], legal: LegalGoal, plan: { count: number; unassigned: readonly string[] }): RouteNotice[] {
  const notices: RouteNotice[] = [];
  if (legal.referenceKwh === null) {
    notices.push({ tone: 'warning', text: 'Falta el consumo del año anterior: registra 12 facturas o escríbelo para calcular la meta en kWh.' });
  }
  if (!plan.count) notices.push({ tone: 'warning', text: 'No hay medidas incluidas en el plan: sin ellas la ruta no prevé ahorros.' });
  else if (plan.unassigned.length) {
    notices.push({ tone: 'warning', text: `Medidas del plan que ninguna fila de la ruta menciona: ${plan.unassigned.join(', ')}. Asígnales el año en que entran en operación.` });
  }
  if (!rows.some((r) => r.legalMinimum)) {
    notices.push({ tone: 'critical', text: `La ruta no incluye el año ${legal.firstYear}, el primero después de la auditoría, en el que la ley exige al menos ${pct(legal.pct, 0)} de ahorro.` });
  }
  for (const row of rows) {
    if (row.status !== 'no-cumple') continue;
    const forecast = row.plannedPct !== null ? pct(row.plannedPct) : `${formatNumber(row.plannedKwh)} kWh/año`;
    notices.push(
      row.legalMinimum
        ? {
            tone: 'critical',
            text: `Con las medidas del plan, el año ${row.year} prevé ${forecast} y la ley pide al menos ${pct(legal.pct, 0)} (${formatNumber(row.targetKwh ?? 0)} kWh/año): faltan ${formatNumber(row.gapKwh)} kWh/año. Adelanta medidas al primer año o suma otras.`,
          }
        : { tone: 'warning', text: `El año ${row.year} prevé ${forecast} y la meta es ${pct(row.targetPct)}: faltan ${formatNumber(row.gapKwh)} kWh/año.` },
    );
  }
  const targets = rows.map((r) => r.targetPct);
  if (targets.some((t, i) => t !== null && i > 0 && targets[i - 1] !== null && t < (targets[i - 1] as number))) {
    notices.push({ tone: 'info', text: 'Una meta anual es menor que la del año anterior: la ruta acumula ahorros, por eso las metas no suelen bajar.' });
  }
  return notices;
}

export interface FirstYearCheck {
  year: number;
  plannedPct: number | null;
  meets: boolean;
}

/** Ahorro previsto del primer año frente a la meta legal, para la lista de verificación y el resumen del plan. */
export function firstYearCheck(rows: readonly RouteRow[]): FirstYearCheck | null {
  const first = rows.find((r) => r.legalMinimum);
  return first ? { year: first.year, plannedPct: first.plannedPct, meets: first.status === 'cumple' } : null;
}

export interface RoutePlan {
  legal: LegalGoal;
  route: EffectiveRoute;
  rows: RouteRow[];
  /** Año que sugieren las tareas o la prioridad de cada medida del plan (por código). */
  suggested: Record<string, { year: number; basis: RouteBasis }>;
  /** Medidas del plan que la ruta no menciona. */
  unassigned: Measure[];
  notices: RouteNotice[];
  firstYear: FirstYearCheck | null;
  /** Medidas incluidas en el plan. */
  planCount: number;
}

/**
 * Todo lo de la ruta en un solo cálculo, el mismo para la pantalla del PGEE, el inicio del proyecto y el documento: la meta legal, la
 * ruta (la guardada o la propuesta), sus filas con el ahorro previsto y los avisos.
 */
export function planRoute(input: {
  stored?: { annualRoute?: readonly RouteYear[]; legalGoal?: LegalGoalOverride };
  auditDate?: string;
  /** Periodo de la última factura (AAAA-MM). */
  lastPeriod?: string;
  today: Date;
  measures: readonly Measure[];
  tasks: readonly Task[];
  /** Consumo de los últimos 12 meses facturados (o el estimado del censo). */
  referenceKwh: number | null;
}): RoutePlan {
  const legal = legalGoalOf({ stored: input.stored?.legalGoal, baseYear: defaultBaseYear({ auditDate: input.auditDate, lastPeriod: input.lastPeriod, today: input.today }), referenceKwh: input.referenceKwh });
  const base: RouteInput = { measures: input.measures, tasks: input.tasks, firstYear: legal.firstYear, referenceKwh: legal.referenceKwh };
  const route = effectiveRoute(input.stored?.annualRoute, base);
  const rows = routeRows(route.rows, { ...base, legal });
  const unassigned = unassignedMeasures(route.rows, input.measures);
  const planCount = input.measures.filter((m) => m.selected).length;
  return {
    legal,
    route,
    rows,
    suggested: Object.fromEntries(input.measures.filter((m) => m.selected).map((m) => [m.code, implementationYear(m, input.tasks, legal.firstYear)])),
    unassigned,
    notices: routeNotices(rows, legal, { count: planCount, unassigned: unassigned.map((m) => m.code) }),
    firstYear: firstYearCheck(rows),
    planCount,
  };
}
