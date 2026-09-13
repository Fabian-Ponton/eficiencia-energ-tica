import { addDays, addMonths, nextPeriod, parseLocal, toLocalDate, toPeriod } from '@/utils/dates';
import { formatCop, formatNumber } from '@/utils/format';
import type { Measure, Project, Task, TaskStatus } from './types';

/**
 * Plan de implementación: las tareas de las medidas del plan, el cronograma (Gantt), el avance
 * ponderado por la duración, el presupuesto por plazo, por fuente y por mes, y el flujo de caja de la
 * inversión frente al ahorro acumulado.
 */

export type TaskPhase = Task['phase'];

export const TASK_PHASES: readonly { id: TaskPhase; label: string; range: string; startMonth: number }[] = [
  { id: 'corto', label: 'Corto plazo', range: '0 a 6 meses', startMonth: 0 },
  { id: 'mediano', label: 'Mediano plazo', range: '6 a 18 meses', startMonth: 6 },
  { id: 'largo', label: 'Largo plazo', range: 'más de 18 meses', startMonth: 18 },
];
export const phaseOf = (id: TaskPhase) => TASK_PHASES.find((p) => p.id === id) ?? TASK_PHASES[0];
export const PHASE_ORDER: Record<TaskPhase, number> = { corto: 0, mediano: 1, largo: 2 };

/** La prioridad de la medida define el plazo en que se ejecuta (el mismo criterio del PGEE). */
export const PHASE_OF_PRIORITY: Record<NonNullable<Measure['priority']>, TaskPhase> = { alta: 'corto', media: 'mediano', baja: 'largo' };

export const TASK_STATUS_LABEL: Record<TaskStatus, string> = { pendiente: 'Pendiente', 'en-ejecucion': 'En ejecución', implementada: 'Implementada' };

/** Fuentes de financiación frecuentes; el auditor puede escribir otra. */
export const FUNDING_SOURCES = ['Recursos propios', 'Crédito bancario', 'Cofinanciación', 'Incentivos de la Ley 1715 de 2014', 'Contrato con una ESCO (pago con los ahorros)'] as const;

/** Tareas tipo de cada clase de medida: preparación y ejecución, con su duración en días. */
const STEPS: Record<Measure['kind'], readonly (readonly [name: string, days: number])[]> = {
  operativa: [
    ['Preparación de la campaña', 14],
    ['Ejecución y seguimiento', 60],
  ],
  'baja-inversion': [
    ['Cotizaciones y compra', 30],
    ['Instalación', 60],
  ],
  'alta-inversion': [
    ['Diseño y contratación', 60],
    ['Instalación y puesta en marcha', 90],
  ],
};

/** Cómo se verifica el ahorro de la medida (protocolo IPMVP). */
export function verificationFor(m: Pick<Measure, 'kind' | 'category'>): string {
  if (m.kind === 'operativa') return 'IPMVP opción C: consumo facturado frente a la línea base';
  return m.category === 'otros' ? 'IPMVP opción B: energía medida en el sistema instalado' : 'IPMVP opción B: medición de los equipos intervenidos';
}

/** Indicador de la tarea de ejecución: el ahorro que se debe verificar. */
export const kpiFor = (m: Pick<Measure, 'savingsKwhYear' | 'savingsCopYear'>): string =>
  m.savingsKwhYear > 0 ? `${formatNumber(m.savingsKwhYear)} kWh/año ahorrados` : `${formatCop(m.savingsCopYear)} de ahorro al año`;

export type TaskDraft = Omit<Task, 'createdAt' | 'updatedAt' | 'deletedAt'>;

const planOrder = (a: Measure, b: Measure) =>
  PHASE_ORDER[PHASE_OF_PRIORITY[a.priority ?? 'baja']] - PHASE_ORDER[PHASE_OF_PRIORITY[b.priority ?? 'baja']] || a.code.localeCompare(b.code, 'es', { numeric: true });

/**
 * Cronograma propuesto para las medidas del plan: una tarea de preparación y otra de ejecución por
 * medida, en el plazo que le da su prioridad; dentro de un mismo plazo cada medida arranca un mes
 * después de la anterior. La inversión de la medida queda como presupuesto de la ejecución.
 */
export function planTasks(measures: readonly Measure[], projectId: string, start: string): TaskDraft[] {
  const stagger: Record<TaskPhase, number> = { corto: 0, mediano: 0, largo: 0 };
  const tasks: TaskDraft[] = [];
  for (const m of measures.filter((x) => x.selected).sort(planOrder)) {
    const phase = PHASE_OF_PRIORITY[m.priority ?? 'baja'];
    let from = addMonths(start, phaseOf(phase).startMonth + stagger[phase]);
    stagger[phase] += 1;
    const steps = STEPS[m.kind];
    steps.forEach(([name, days], i) => {
      const end = addDays(from, days - 1);
      const last = i === steps.length - 1;
      tasks.push({
        id: crypto.randomUUID(),
        projectId,
        measureId: m.id,
        name,
        phase,
        start: from,
        end,
        budgetCop: last ? m.investmentCop : undefined,
        status: 'pendiente',
        progress: 0,
        kpi: last ? kpiFor(m) : undefined,
        verification: last ? verificationFor(m) : undefined,
      });
      from = addDays(end, 1);
    });
  }
  return tasks;
}

const DAY = 86_400_000;
const clampProgress = (value: number) => Math.min(100, Math.max(0, Number.isFinite(value) ? value : 0));

/** Días de la tarea, contando el primero y el último; `null` si le faltan fechas o están al revés. */
export function taskDays(t: Pick<Task, 'start' | 'end'>): number | null {
  const a = parseLocal(t.start);
  const b = parseLocal(t.end);
  if (!a || !b || b < a) return null;
  return Math.round((b.getTime() - a.getTime()) / DAY) + 1;
}

/** Tarea que ya debía terminar y no está implementada. */
export const isOverdue = (t: Pick<Task, 'end' | 'status'>, today: string): boolean => Boolean(t.end && t.end < today && t.status !== 'implementada');

export interface ScheduleSummary {
  count: number;
  done: number;
  running: number;
  pending: number;
  overdue: number;
  /** Avance del plan de 0 a 1, ponderado por la duración de cada tarea. */
  progress: number;
  budgetCop: number;
  start: string | null;
  end: string | null;
  /** Duración del cronograma en meses. */
  months: number | null;
}

export function scheduleSummary(tasks: readonly Task[], today = toLocalDate()): ScheduleSummary {
  const weight = (t: Task) => taskDays(t) ?? 1;
  const totalWeight = tasks.reduce((total, t) => total + weight(t), 0);
  const doneWeight = tasks.reduce((total, t) => total + (weight(t) * clampProgress(t.progress)) / 100, 0);
  const dated = tasks.filter((t) => taskDays(t) !== null);
  const starts = dated.map((t) => t.start as string).sort();
  const ends = dated.map((t) => t.end as string).sort();
  const start = starts[0] ?? null;
  const end = ends[ends.length - 1] ?? null;
  const span = start && end ? taskDays({ start, end }) : null;
  return {
    count: tasks.length,
    done: tasks.filter((t) => t.status === 'implementada').length,
    running: tasks.filter((t) => t.status === 'en-ejecucion').length,
    pending: tasks.filter((t) => t.status === 'pendiente').length,
    overdue: tasks.filter((t) => isOverdue(t, today)).length,
    progress: totalWeight ? doneWeight / totalWeight : 0,
    budgetCop: tasks.reduce((total, t) => total + (t.budgetCop ?? 0), 0),
    start,
    end,
    months: span ? Math.max(1, Math.round(span / 30.44)) : null,
  };
}

/** Presupuesto, cantidad de tareas y participación de cada plazo. */
export function budgetByPhase(tasks: readonly Task[]) {
  const total = tasks.reduce((sum, t) => sum + (t.budgetCop ?? 0), 0);
  return TASK_PHASES.map((p) => {
    const list = tasks.filter((t) => t.phase === p.id);
    const budget = list.reduce((sum, t) => sum + (t.budgetCop ?? 0), 0);
    return { ...p, count: list.length, budget, share: total ? budget / total : 0 };
  });
}

/** Presupuesto por fuente de financiación, de la mayor a la menor. */
export function budgetBySource(tasks: readonly Task[]): { source: string; budget: number; count: number }[] {
  const groups = new Map<string, { budget: number; count: number }>();
  for (const t of tasks) {
    const budget = t.budgetCop ?? 0;
    if (!budget) continue;
    const source = t.fundingSource?.trim() || 'Sin definir';
    const group = groups.get(source) ?? { budget: 0, count: 0 };
    group.budget += budget;
    group.count += 1;
    groups.set(source, group);
  }
  return [...groups].map(([source, g]) => ({ source, ...g })).sort((a, b) => b.budget - a.budget);
}

/** Presupuesto de cada mes (AAAA-MM): el de cada tarea se reparte por igual entre sus días. */
export function monthlyBudget(tasks: readonly Task[]): Map<string, number> {
  const months = new Map<string, number>();
  for (const t of tasks) {
    const days = taskDays(t);
    const first = parseLocal(t.start);
    const budget = t.budgetCop ?? 0;
    if (!days || !first || !budget) continue;
    for (let i = 0; i < days; i++) {
      const period = toPeriod(new Date(first.getFullYear(), first.getMonth(), first.getDate() + i));
      months.set(period, (months.get(period) ?? 0) + budget / days);
    }
  }
  return months;
}

const monthsBetween = (from: string, to: string) => {
  const [y1, m1] = from.split('-').map(Number);
  const [y2, m2] = to.split('-').map(Number);
  return (y2 - y1) * 12 + (m2 - m1);
};

export interface CashFlow {
  periods: string[];
  /** Inversión acumulada al cierre de cada mes (COP). */
  investment: number[];
  /** Ahorro neto acumulado (ahorro menos costos de operación), con el incremento anual de la tarifa. */
  savings: number[];
  /** Mes desde el cual el ahorro acumulado cubre la inversión y ya no vuelve a quedar por debajo. */
  breakEven: string | null;
  /** Medidas del plan con tareas fechadas y sin ellas (estas no entran al flujo). */
  scheduled: number;
  unscheduled: number;
}

/**
 * Flujo de caja del plan, mes a mes: la inversión sigue el presupuesto de las tareas y cada medida
 * ahorra desde el mes siguiente a terminar su última tarea. Cubre al menos dos años y un año después
 * de la última tarea, y sigue hasta que el ahorro alcance la inversión (máximo `maxMonths`).
 */
export function planCashFlow(measures: readonly Measure[], tasks: readonly Task[], economics: Pick<Project['economics'], 'tariffEscalation'>, maxMonths = 120): CashFlow {
  const dated = tasks.filter((t) => taskDays(t) !== null);
  const plan = measures.filter((m) => m.selected);
  const finish = new Map<string, string>();
  for (const t of dated) {
    if (!t.measureId) continue;
    const previous = finish.get(t.measureId);
    if (!previous || (t.end as string) > previous) finish.set(t.measureId, t.end as string);
  }
  const scheduled = plan.filter((m) => finish.has(m.id)).map((m) => ({ m, from: nextPeriod((finish.get(m.id) as string).slice(0, 7)) }));
  if (!dated.length) return { periods: [], investment: [], savings: [], breakEven: null, scheduled: 0, unscheduled: plan.length };

  const first = dated.map((t) => t.start as string).sort()[0].slice(0, 7);
  const last = dated.map((t) => t.end as string).sort()[dated.length - 1].slice(0, 7);
  const minMonths = Math.max(24, monthsBetween(first, last) + 13);
  const budget = monthlyBudget(dated);
  // Medio peso de tolerancia: las sumas de fracciones no deben correr la recuperación un mes
  const covered = (saved: number, invested: number) => saved + 0.5 >= invested;
  const periods: string[] = [];
  const investment: number[] = [];
  const savings: number[] = [];
  let invested = 0;
  let saved = 0;
  let period = first;
  for (let i = 0; i < maxMonths; i++) {
    invested += budget.get(period) ?? 0;
    for (const { m, from } of scheduled) {
      if (period < from) continue;
      const year = Math.floor(monthsBetween(from, period) / 12);
      saved += (m.savingsCopYear * (1 + economics.tariffEscalation) ** year - m.annualCostCop) / 12;
    }
    periods.push(period);
    investment.push(invested);
    savings.push(saved);
    if (i + 1 >= minMonths && covered(saved, invested)) break;
    period = nextPeriod(period);
  }
  let lastBelow = -1;
  periods.forEach((_, i) => {
    if (!covered(savings[i], investment[i])) lastBelow = i;
  });
  const breakEven = invested > 0 && lastBelow < periods.length - 1 ? periods[lastBelow + 1] : null;
  return { periods, investment, savings, breakEven, scheduled: scheduled.length, unscheduled: plan.length - scheduled.length };
}

export interface GanttRow {
  /** Posición de la tarea en la lista recibida. */
  index: number;
  label: string;
  /** Inicio del primer día y fin del último (ms). */
  start: number;
  end: number;
  progress: number;
  phase: TaskPhase;
  status: TaskStatus;
  overdue: boolean;
}

/** Filas del Gantt: las tareas con fechas, por plazo y fecha de inicio. */
export function ganttRows(tasks: readonly Task[], measures: readonly Pick<Measure, 'id' | 'code'>[], today = toLocalDate()): GanttRow[] {
  const codes = new Map(measures.map((m) => [m.id, m.code]));
  return tasks
    .map((t, index) => ({ t, index }))
    .filter(({ t }) => taskDays(t) !== null)
    .sort((a, b) => PHASE_ORDER[a.t.phase] - PHASE_ORDER[b.t.phase] || (a.t.start as string).localeCompare(b.t.start as string) || a.t.name.localeCompare(b.t.name, 'es'))
    .map(({ t, index }) => {
      const code = t.measureId ? codes.get(t.measureId) : undefined;
      return {
        index,
        label: code ? `${code} · ${t.name}` : t.name,
        start: (parseLocal(t.start) as Date).getTime(),
        end: (parseLocal(addDays(t.end as string, 1)) as Date).getTime(),
        progress: clampProgress(t.progress),
        phase: t.phase,
        status: t.status,
        overdue: isOverdue(t, today),
      };
    });
}

/** Lo que sigue: tareas atrasadas, en ejecución y las que empiezan en los próximos `days` días. */
export function upcomingTasks(tasks: readonly Task[], today = toLocalDate(), days = 45): Task[] {
  const limit = addDays(today, days);
  const rank = (t: Task) => (isOverdue(t, today) ? 0 : t.status === 'en-ejecucion' ? 1 : 2);
  return tasks
    .filter((t) => t.status !== 'implementada' && (rank(t) < 2 || (t.start !== undefined && t.start <= limit)))
    .sort((a, b) => rank(a) - rank(b) || (a.start ?? '9999').localeCompare(b.start ?? '9999'));
}
