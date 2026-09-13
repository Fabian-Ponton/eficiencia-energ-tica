import { linesChart } from '@/charts/builders';
import type { ChartOption } from '@/charts/echarts';
import { ganttChart } from '@/charts/ganttChart';
import { chartPalette } from '@/charts/palette';
import { ganttRows, phaseOf, planCashFlow, type CashFlow, type GanttRow, type TaskPhase } from '@/domain/implementation';
import type { Measure, Project, Task } from '@/domain/types';
import { parseLocal, periodLabel } from '@/utils/dates';
import type { ReportFigure } from './figures';

/** Color de cada plazo en el cronograma y en el presupuesto. */
export function phaseColors(dark: boolean): Record<TaskPhase, string> {
  const p = chartPalette(dark);
  return { corto: p.series[0], mediano: p.series[1], largo: p.series[2] };
}

/** Cronograma de las tareas con fechas; `null` si ninguna las tiene. La altura crece con las filas. */
export function ganttOption(tasks: readonly Task[], measures: readonly Measure[], today: string, dark: boolean): { option: ChartOption; height: number; rows: GanttRow[] } | null {
  const rows = ganttRows(tasks, measures, today);
  if (!rows.length) return null;
  const colors = phaseColors(dark);
  return {
    rows,
    height: Math.max(180, rows.length * 30 + 76),
    option: ganttChart({
      dark,
      today: parseLocal(today)?.getTime(),
      bars: rows.map((r) => ({ label: r.label, start: r.start, end: r.end, progress: r.progress, group: phaseOf(r.phase).label, color: colors[r.phase], overdue: r.overdue })),
    }),
  };
}

/** Inversión y ahorro neto acumulados, en millones de pesos. */
export function cashFlowOption(flow: CashFlow, dark: boolean): ChartOption {
  const p = chartPalette(dark);
  const millions = (value: number) => Math.round(value / 10_000) / 100;
  return linesChart({
    dark,
    unit: 'M COP',
    decimals: 1,
    labels: flow.periods.map(periodLabel),
    series: [
      { name: 'Inversión acumulada', values: flow.investment.map(millions), color: p.serious },
      { name: 'Ahorro neto acumulado', values: flow.savings.map(millions), color: p.good, area: true },
    ],
  });
}

/** Figuras del plan de implementación (modo claro, para Word y PNG). */
export function implementationFigures(tasks: readonly Task[], measures: readonly Measure[], economics: Project['economics'], today: string): ReportFigure[] {
  const figures: ReportFigure[] = [];
  const gantt = ganttOption(tasks, measures, today, false);
  if (gantt) {
    figures.push({
      id: 'cronograma',
      title: 'Cronograma del plan de implementación',
      source: 'Cada barra es el plazo de una tarea y la parte llena, su avance; la línea punteada marca la fecha del documento.',
      option: gantt.option,
      width: 960,
      height: gantt.height,
    });
  }
  const flow = planCashFlow(measures, tasks, economics);
  if (flow.periods.length) {
    figures.push({
      id: 'flujo-de-caja',
      title: 'Inversión y ahorro acumulados del plan',
      source: 'Millones de pesos. Cada medida ahorra desde el mes siguiente a terminar sus tareas, con el incremento anual de la tarifa.',
      option: cashFlowOption(flow, false),
      width: 960,
      height: 380,
    });
  }
  return figures;
}
