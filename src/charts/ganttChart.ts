import { formatDate, MONTHS_SHORT, toLocalDate } from '@/utils/dates';
import type { ChartOption } from './echarts';
import { chartPalette, MONO, SANS, withAlpha } from './palette';

export interface GanttBar {
  label: string;
  /** Inicio del primer día y fin del último (ms). */
  start: number;
  end: number;
  /** Avance de 0 a 100. */
  progress: number;
  /** Grupo de la leyenda (el plazo) y su color. */
  group: string;
  color: string;
  /** Tarea atrasada: borde de alerta. */
  overdue?: boolean;
}

/** Lo que ECharts entrega a `renderItem` de una serie personalizada (solo lo que se usa aquí). */
interface RenderParams {
  coordSys: { x: number; y: number; width: number; height: number };
}
interface RenderApi {
  value: (dimension: number) => number;
  coord: (point: number[]) => number[];
  size: (point: number[]) => number[];
  getWidth: () => number;
}

const DAY = 86_400_000;
/** Por debajo de este ancho (celular) el nombre de cada tarea va sobre su barra y la gráfica usa todo el ancho. */
const COMPACT_WIDTH = 600;
const monthStart = (ms: number) => {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), 1).getTime();
};
const nextMonthStart = (ms: number) => {
  const d = new Date(ms - 1);
  return new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime();
};
const dayText = (ms: number) => formatDate(toLocalDate(new Date(ms)));

/**
 * Cronograma (diagrama de Gantt): una barra por tarea, clara en todo su plazo y llena hasta su avance,
 * con el color de su grupo en la leyenda, borde de alerta si está atrasada y la línea de hoy.
 * Cada dato lleva al final su posición en `bars`, para saber qué barra se tocó.
 */
export function ganttChart(opts: { bars: GanttBar[]; today?: number; dark: boolean; labelWidth?: number }): ChartOption {
  const p = chartPalette(opts.dark);
  const groups = [...new Map(opts.bars.map((b) => [b.group, b.color])).entries()];
  const min = monthStart(Math.min(...opts.bars.map((b) => b.start)));
  const max = nextMonthStart(Math.max(...opts.bars.map((b) => b.end)));
  const showToday = opts.today !== undefined && opts.today >= min && opts.today <= max;

  const renderItem = (params: RenderParams, api: RenderApi) => {
    const bar = opts.bars[api.value(4)];
    const compact = api.getWidth() < COMPACT_WIDTH;
    const from = api.coord([api.value(1), api.value(0)]);
    const to = api.coord([api.value(2), api.value(0)]);
    const band = api.size([0, 1])[1];
    const width = Math.max(3, to[0] - from[0]);
    const height = compact ? Math.min(10, band * 0.34) : Math.min(16, band * 0.56);
    // En el celular la barra baja un poco para dejar arriba el nombre de la tarea
    const top = from[1] + (compact ? band * 0.16 : 0) - height / 2;
    const done = (width * bar.progress) / 100;
    const progressText = bar.progress > 0 ? `${Math.round(bar.progress)} %` : '';

    let label: Record<string, unknown>[] = [];
    if (compact) {
      const text = progressText ? `${bar.label} · ${progressText}` : bar.label;
      const textWidth = text.length * 6.1;
      const plot = params.coordSys;
      // El nombre empieza en la barra; si no cabe a la derecha, termina en ella; si tampoco, arranca en el borde
      const fitsRight = from[0] + textWidth <= plot.x + plot.width;
      const fitsLeft = from[0] + width - textWidth >= plot.x;
      const x = fitsRight ? from[0] : fitsLeft ? from[0] + width : plot.x;
      label = [{ type: 'text', style: { text, x, y: top - 3, fill: p.text, font: `11px ${SANS}`, align: !fitsRight && fitsLeft ? 'right' : 'left', verticalAlign: 'bottom' } }];
    } else if (progressText) {
      label = [{ type: 'text', style: { text: progressText, x: from[0] + width + 6, y: top + height / 2, fill: p.muted, font: `10px ${MONO}`, align: 'left', verticalAlign: 'middle' } }];
    }

    return {
      type: 'group',
      children: [
        {
          type: 'rect',
          shape: { x: from[0], y: top, width, height, r: compact ? 3 : 4 },
          style: { fill: withAlpha(bar.color, opts.dark ? 0.3 : 0.2), stroke: bar.overdue ? p.serious : bar.color, lineWidth: bar.overdue ? 1.6 : 1 },
        },
        ...(done > 0 ? [{ type: 'rect', shape: { x: from[0], y: top, width: done, height, r: compact ? 3 : 4 }, style: { fill: bar.color } }] : []),
        ...label,
      ],
    };
  };

  return {
    animationDuration: 500,
    grid: { left: 8, right: 48, top: 34, bottom: 6, containLabel: true },
    legend: {
      top: 0,
      left: 0,
      icon: 'roundRect',
      itemWidth: 14,
      itemHeight: 6,
      itemGap: 14,
      textStyle: { color: p.muted, fontFamily: SANS, fontSize: 12 },
      data: groups.map(([name]) => name),
    },
    // En el celular los nombres van sobre las barras: el eje de las tareas se oculta y la gráfica usa todo el ancho
    media: [{ query: { maxWidth: COMPACT_WIDTH - 1 }, option: { grid: { left: 4, right: 14 }, yAxis: { axisLabel: { show: false } } } }],
    tooltip: {
      trigger: 'item',
      backgroundColor: p.surface,
      borderColor: p.border,
      textStyle: { color: p.text, fontFamily: SANS, fontSize: 13 },
      formatter: (params: { value: number[] }) => {
        const bar = opts.bars[params.value[4]];
        return `<b>${bar.label}</b><br/>${dayText(bar.start)} – ${dayText(bar.end - DAY)}<br/>Avance: ${Math.round(bar.progress)} %${bar.overdue ? ' · <b>atrasada</b>' : ''}`;
      },
    },
    xAxis: {
      type: 'time',
      min,
      max,
      splitNumber: 6,
      axisLine: { lineStyle: { color: p.line } },
      axisTick: { show: false },
      splitLine: { show: true, lineStyle: { color: p.grid } },
      axisLabel: {
        fontFamily: MONO,
        fontSize: 10,
        color: p.axis,
        formatter: (value: number) => {
          const d = new Date(value);
          return `${MONTHS_SHORT[d.getMonth()]}\n${d.getFullYear()}`;
        },
      },
    },
    yAxis: {
      type: 'category',
      data: opts.bars.map((b) => b.label),
      inverse: true,
      axisTick: { show: false },
      axisLine: { lineStyle: { color: p.line } },
      axisLabel: { color: p.text, fontFamily: SANS, fontSize: 12, width: opts.labelWidth ?? 200, overflow: 'truncate' },
    },
    series: groups.map(([name, color], g) => ({
      type: 'custom',
      name,
      itemStyle: { color },
      renderItem,
      encode: { x: [1, 2], y: 0 },
      data: opts.bars.flatMap((b, i) => (b.group === name ? [[i, b.start, b.end, b.progress, i]] : [])),
      markLine:
        g === 0 && showToday
          ? {
              silent: true,
              symbol: 'none',
              lineStyle: { color: p.serious, type: 'dashed', width: 1.2 },
              // El eje de las tareas va invertido: el inicio de la línea queda arriba, lejos de las fechas
              label: { formatter: 'Hoy', position: 'start', color: p.serious, fontFamily: MONO, fontSize: 10 },
              data: [{ xAxis: opts.today }],
            }
          : undefined,
    })),
  };
}
