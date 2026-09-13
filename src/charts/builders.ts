import { formatNumber, formatPercent } from '@/utils/format';
import type { ChartOption } from './echarts';
import { chartPalette, MONO, SANS, withAlpha, type ChartPalette } from './palette';

/**
 * Opciones de ECharts con el estilo de PONTIA: barras delgadas con esquinas redondeadas, rejilla fina,
 * etiquetas en mono solo donde aportan, sin doble eje y leyenda arriba cuando hay más de una serie.
 * Todas reciben `dark`: en pantalla siguen el tema; para PNG e informes se piden en claro.
 */

export interface SeriesSpec {
  name: string;
  values: (number | null)[];
  color?: string;
  dashed?: boolean;
  area?: boolean;
}

const HOURS = Array.from({ length: 24 }, (_, h) => `${String(h).padStart(2, '0')}:00`);
export const WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

const monoLabel = (p: ChartPalette) => ({ fontFamily: MONO, fontSize: 10, color: p.axis });

function tooltip(p: ChartPalette, unit?: string, decimals = 0) {
  return {
    backgroundColor: p.surface,
    borderColor: p.border,
    textStyle: { color: p.text, fontFamily: SANS, fontSize: 13 },
    valueFormatter: (value: unknown) => (typeof value === 'number' ? `${formatNumber(value, decimals)}${unit ? ` ${unit}` : ''}` : '—'),
  };
}

function legend(p: ChartPalette, show: boolean) {
  return show
    ? { top: 0, left: 0, right: 0, icon: 'roundRect', itemWidth: 14, itemHeight: 4, itemGap: 12, textStyle: { color: p.muted, fontFamily: SANS, fontSize: 12 } }
    : { show: false };
}

/**
 * Si los nombres de las series no caben en una línea de celular (≈ 300 px), la leyenda ocupa dos:
 * en pantallas angostas la gráfica empieza más abajo para no montarse sobre el eje.
 */
function narrowLegend(names: readonly string[]) {
  const width = names.reduce((total, name) => total + name.length * 6.6 + 31, 0);
  return width > 300 ? { media: [{ query: { maxWidth: 560 }, option: { grid: { top: 76 } } }] } : {};
}

function categoryAxis(p: ChartPalette, data: string[], extra: Record<string, unknown> = {}) {
  return { type: 'category', data, axisTick: { show: false }, axisLine: { lineStyle: { color: p.line } }, axisLabel: monoLabel(p), ...extra };
}

function valueAxis(p: ChartPalette, unit?: string, decimals = 0, extra: Record<string, unknown> = {}) {
  return {
    type: 'value',
    name: unit,
    nameGap: 10,
    nameTextStyle: { ...monoLabel(p), align: 'left' },
    splitNumber: 3,
    axisLabel: { ...monoLabel(p), formatter: (v: number) => formatNumber(v, decimals) },
    splitLine: { lineStyle: { color: p.grid } },
    ...extra,
  };
}

/** Curva de carga de 24 horas: una línea por tipo de día y, si se pide, la estimada del inventario. */
export function dayProfileChart(opts: { series: SeriesSpec[]; unit?: string; dark: boolean }): ChartOption {
  const p = chartPalette(opts.dark);
  const multi = opts.series.length > 1;
  return {
    animationDuration: 500,
    grid: { left: 8, right: 14, top: multi ? 48 : 28, bottom: 4, containLabel: true },
    legend: legend(p, multi),
    ...(multi ? narrowLegend(opts.series.map((s) => s.name)) : {}),
    tooltip: { ...tooltip(p, opts.unit ?? 'kW', 1), trigger: 'axis' },
    xAxis: categoryAxis(p, HOURS, { boundaryGap: false, axisLabel: { ...monoLabel(p), interval: 5 } }),
    yAxis: valueAxis(p, opts.unit ?? 'kW'),
    series: opts.series.map((s, i) => {
      const color = s.color ?? p.series[i % p.series.length];
      return {
        type: 'line',
        name: s.name,
        data: s.values,
        smooth: 0.3,
        symbol: 'none',
        lineStyle: { width: s.dashed ? 1.6 : 2.4, type: s.dashed ? 'dashed' : 'solid', color },
        itemStyle: { color },
        areaStyle: s.area ? { color: withAlpha(color, 0.12) } : undefined,
      };
    }),
  };
}

/** Mapa de calor semana × hora con escala secuencial de un solo tono. */
export function weekHeatmapChart(opts: { matrix: number[][]; unit?: string; dark: boolean }): ChartOption {
  const p = chartPalette(opts.dark);
  const unit = opts.unit ?? 'kW';
  const data = opts.matrix.flatMap((row, day) => row.map((value, hour) => [hour, day, Math.round(value * 10) / 10]));
  const max = Math.max(1, ...opts.matrix.flat());
  return {
    animationDuration: 400,
    grid: { left: 8, right: 8, top: 6, bottom: 48, containLabel: true },
    tooltip: {
      ...tooltip(p, unit, 1),
      formatter: (params: { value: [number, number, number] }) =>
        `${WEEKDAYS[params.value[1]]} · ${HOURS[params.value[0]]}<br/><b>${formatNumber(params.value[2], 1)} ${unit}</b>`,
    },
    xAxis: categoryAxis(p, HOURS, { axisLine: { show: false }, axisLabel: { ...monoLabel(p), interval: 5 } }),
    yAxis: { type: 'category', data: WEEKDAYS, inverse: true, axisTick: { show: false }, axisLine: { show: false }, axisLabel: monoLabel(p) },
    visualMap: {
      min: 0,
      max,
      orient: 'horizontal',
      left: 'center',
      bottom: 0,
      itemWidth: 10,
      itemHeight: 140,
      calculable: false,
      inRange: { color: p.heat },
      text: [`${formatNumber(max)} ${unit}`, '0'],
      textStyle: monoLabel(p),
    },
    series: [
      {
        type: 'heatmap',
        data,
        itemStyle: { borderColor: p.surface, borderWidth: 1.5, borderRadius: 2 },
        emphasis: { itemStyle: { borderColor: p.text, borderWidth: 1 } },
      },
    ],
  };
}

/**
 * Barras verticales (una o varias series). `colors` colorea cada barra de una serie única
 * (p. ej. fines de semana más claros); `average` dibuja la línea del promedio.
 */
export function barsChart(opts: {
  labels: string[];
  series: SeriesSpec[];
  unit?: string;
  decimals?: number;
  dark: boolean;
  colors?: string[];
  average?: number | null;
  highlightMax?: boolean;
}): ChartOption {
  const p = chartPalette(opts.dark);
  const multi = opts.series.length > 1;
  const decimals = opts.decimals ?? 0;
  return {
    animationDuration: 500,
    grid: { left: 8, right: 10, top: multi ? 48 : 28, bottom: 4, containLabel: true },
    legend: legend(p, multi),
    ...(multi ? narrowLegend(opts.series.map((s) => s.name)) : {}),
    tooltip: { ...tooltip(p, opts.unit, decimals), trigger: 'axis', axisPointer: { type: 'shadow', shadowStyle: { color: withAlpha(p.axis, 0.12) } } },
    xAxis: categoryAxis(p, opts.labels),
    yAxis: valueAxis(p, opts.unit, decimals),
    series: opts.series.map((s, i) => {
      const color = s.color ?? p.series[i % p.series.length];
      const max = Math.max(...s.values.map((v) => v ?? Number.NEGATIVE_INFINITY));
      return {
        type: 'bar',
        name: s.name,
        barMaxWidth: multi ? 12 : 18,
        barGap: '20%',
        // El color de la serie también pinta la muestra de la leyenda
        itemStyle: { color, borderRadius: [4, 4, 0, 0] },
        data: s.values.map((value, j) => (!multi && opts.colors?.[j] ? { value, itemStyle: { color: opts.colors[j], borderRadius: [4, 4, 0, 0] } } : value)),
        label:
          opts.highlightMax && !multi
            ? {
                show: true,
                position: 'top',
                ...monoLabel(p),
                color: p.text,
                fontWeight: 600,
                formatter: (params: { value: unknown }) => (params.value === max ? formatNumber(Number(params.value), decimals) : ''),
              }
            : undefined,
        markLine:
          i === 0 && opts.average !== undefined && opts.average !== null
            ? {
                symbol: 'none',
                silent: true,
                lineStyle: { color: p.muted, type: 'dashed', width: 1 },
                // Fondo del color de la tarjeta: la etiqueta se lee aunque quede sobre una barra
                label: {
                  ...monoLabel(p),
                  color: p.muted,
                  formatter: () => `prom. ${formatNumber(opts.average ?? 0, decimals)}`,
                  position: 'insideEndTop',
                  backgroundColor: withAlpha(p.surface, 0.88),
                  padding: [1, 4],
                  borderRadius: 3,
                },
                data: [{ yAxis: opts.average }],
              }
            : undefined,
      };
    }),
  };
}

/** Líneas por periodo (suma móvil de 12 meses, real frente a línea base…). */
export function linesChart(opts: { labels: string[]; series: SeriesSpec[]; unit?: string; decimals?: number; dark: boolean; minZero?: boolean }): ChartOption {
  const p = chartPalette(opts.dark);
  const multi = opts.series.length > 1;
  const decimals = opts.decimals ?? 0;
  return {
    animationDuration: 500,
    grid: { left: 8, right: 14, top: multi ? 48 : 28, bottom: 4, containLabel: true },
    legend: legend(p, multi),
    ...(multi ? narrowLegend(opts.series.map((s) => s.name)) : {}),
    tooltip: { ...tooltip(p, opts.unit, decimals), trigger: 'axis' },
    xAxis: categoryAxis(p, opts.labels, { boundaryGap: false }),
    yAxis: valueAxis(p, opts.unit, decimals, opts.minZero === false ? { scale: true } : {}),
    series: opts.series.map((s, i) => {
      const color = s.color ?? p.series[i % p.series.length];
      return {
        type: 'line',
        name: s.name,
        data: s.values,
        symbol: 'circle',
        symbolSize: 5,
        showSymbol: s.values.length <= 24,
        lineStyle: { width: s.dashed ? 1.6 : 2.4, type: s.dashed ? 'dashed' : 'solid', color },
        itemStyle: { color },
        areaStyle: s.area ? { color: withAlpha(color, 0.1) } : undefined,
      };
    }),
  };
}

/** Barras horizontales ordenadas (intensidad por espacio, Pareto de usos finales); el valor va en la etiqueta. */
export function rankingChart(opts: {
  items: { label: string; value: number; color: string; faded?: boolean; note?: string }[];
  unit?: string;
  decimals?: number;
  dark: boolean;
}): ChartOption {
  const p = chartPalette(opts.dark);
  const decimals = opts.decimals ?? 0;
  return {
    animationDuration: 500,
    grid: { left: 8, right: 108, top: 4, bottom: 4, containLabel: true },
    tooltip: { ...tooltip(p, opts.unit, decimals), trigger: 'axis', axisPointer: { type: 'shadow', shadowStyle: { color: withAlpha(p.axis, 0.12) } } },
    xAxis: { type: 'value', splitNumber: 3, axisLabel: { show: false }, splitLine: { lineStyle: { color: p.grid } } },
    yAxis: {
      type: 'category',
      inverse: true,
      data: opts.items.map((i) => i.label),
      axisTick: { show: false },
      axisLine: { lineStyle: { color: p.line } },
      axisLabel: { color: p.text, fontFamily: SANS, fontSize: 12 },
    },
    series: [
      {
        type: 'bar',
        name: opts.unit ?? '',
        barMaxWidth: 16,
        data: opts.items.map((item) => ({ value: item.value, itemStyle: { color: item.faded ? withAlpha(item.color, 0.35) : item.color, borderRadius: [0, 4, 4, 0] } })),
        label: {
          show: true,
          position: 'right',
          ...monoLabel(p),
          color: p.muted,
          formatter: (params: { dataIndex: number }) => opts.items[params.dataIndex].note ?? formatNumber(opts.items[params.dataIndex].value, decimals),
        },
      },
    ],
  };
}

/** Pareto de usos finales: barras de mayor a menor, los usos significativos a color y el resto atenuado. */
export function paretoChart(opts: {
  items: { label: string; kwh: number; share: number; cumulative: number; color: string; significant: boolean }[];
  dark: boolean;
}): ChartOption {
  return rankingChart({
    dark: opts.dark,
    unit: 'kWh/año',
    items: opts.items.map((i) => ({
      label: i.label,
      value: i.kwh,
      color: i.color,
      faded: !i.significant,
      note: `${formatPercent(i.share, 0)} · acum. ${formatPercent(i.cumulative, 0)}`,
    })),
  });
}

/** Diagrama de Sankey del flujo de energía (columnas: total → usos finales → espacios). */
export function sankeyChart(opts: {
  nodes: { id: string; label: string; color: string }[];
  links: { source: string; target: string; value: number }[];
  unit: string;
  dark: boolean;
  /** Espacio a la derecha para los nombres de la última columna (px). */
  labelSpace?: number;
  /**
   * Color de los flujos: degradado entre nodos (pantalla) o el color del origen, que en PNG pesa
   * diez veces menos porque el degradado translúcido se comprime mal.
   */
  linkColor?: 'gradient' | 'source';
}): ChartOption {
  const p = chartPalette(opts.dark);
  const labels = new Map(opts.nodes.map((n) => [n.id, n.label]));
  const name = (id: string) => labels.get(id) ?? id;
  return {
    animationDuration: 600,
    tooltip: {
      ...tooltip(p, opts.unit),
      trigger: 'item',
      formatter: (params: { dataType?: string; name: string; value: number; data: { source?: string; target?: string } }) =>
        params.dataType === 'edge'
          ? `${name(params.data.source ?? '')} → ${name(params.data.target ?? '')}<br/><b>${formatNumber(params.value)} ${opts.unit}</b>`
          : `${name(params.name)}<br/><b>${formatNumber(params.value)} ${opts.unit}</b>`,
    },
    series: [
      {
        type: 'sankey',
        left: 4,
        right: opts.labelSpace ?? 128,
        top: 8,
        // Margen para que la etiqueta del último nodo no se corte
        bottom: 16,
        nodeWidth: 12,
        nodeGap: 10,
        draggable: false,
        layoutIterations: 64,
        emphasis: { focus: 'adjacency' },
        lineStyle: { color: opts.linkColor ?? 'gradient', curveness: 0.5, opacity: 0.32 },
        // Fondo translúcido: las etiquetas de las columnas intermedias quedan sobre los flujos
        label: {
          color: p.text,
          fontFamily: SANS,
          fontSize: 12,
          backgroundColor: withAlpha(p.surface, 0.82),
          padding: [2, 5],
          borderRadius: 3,
          formatter: (params: { name: string }) => name(params.name),
        },
        data: opts.nodes.map((n) => ({ name: n.id, itemStyle: { color: n.color, borderWidth: 0 } })),
        links: opts.links,
      },
    ],
  };
}

/** Medidor semicircular (FP, carga del transformador): bandas de estado, aguja y el valor debajo. */
export function gaugeChart(opts: {
  value: number;
  max: number;
  unit: string;
  decimals?: number;
  bands: { to: number; color: string }[];
  dark: boolean;
}): ChartOption {
  const p = chartPalette(opts.dark);
  return {
    animationDuration: 700,
    series: [
      {
        type: 'gauge',
        min: 0,
        max: opts.max,
        startAngle: 200,
        endAngle: -20,
        radius: '96%',
        center: ['50%', '60%'],
        axisLine: { lineStyle: { width: 14, color: opts.bands.map((b) => [Math.min(1, b.to / opts.max), b.color]) } },
        pointer: { length: '56%', width: 5, itemStyle: { color: p.text } },
        anchor: { show: true, size: 10, itemStyle: { color: p.text } },
        axisTick: { show: false },
        splitLine: { show: false },
        axisLabel: { show: false },
        title: { show: false },
        detail: {
          valueAnimation: true,
          offsetCenter: [0, '44%'],
          fontFamily: MONO,
          fontSize: 22,
          fontWeight: 600,
          color: p.text,
          formatter: (v: number) => `${formatNumber(v, opts.decimals ?? 0)}${opts.unit ? ` ${opts.unit}` : ''}`,
        },
        data: [{ value: opts.value }],
      },
    ],
  };
}

/** Matriz de priorización: burbujas con ahorro anual frente a inversión; el tamaño es el ahorro de energía. */
export function bubbleChart(opts: {
  points: { label: string; x: number; y: number; size: number; color: string }[];
  xUnit: string;
  yUnit: string;
  dark: boolean;
}): ChartOption {
  const p = chartPalette(opts.dark);
  const maxSize = Math.max(1, ...opts.points.map((pt) => pt.size));
  return {
    animationDuration: 600,
    grid: { left: 8, right: 24, top: 28, bottom: 8, containLabel: true },
    tooltip: {
      ...tooltip(p),
      trigger: 'item',
      formatter: (params: { dataIndex: number }) => {
        const pt = opts.points[params.dataIndex];
        return `<b>${pt.label}</b><br/>Inversión: ${formatNumber(pt.x)} ${opts.xUnit}<br/>Ahorro: ${formatNumber(pt.y)} ${opts.yUnit}`;
      },
    },
    xAxis: { ...valueAxis(p, opts.xUnit), nameLocation: 'end' },
    yAxis: valueAxis(p, opts.yUnit),
    series: [
      {
        type: 'scatter',
        data: opts.points.map((pt) => ({
          value: [pt.x, pt.y],
          symbolSize: 12 + (pt.size / maxSize) * 36,
          itemStyle: { color: withAlpha(pt.color, 0.75), borderColor: pt.color, borderWidth: 1.5 },
          label: { show: true, position: 'top', formatter: pt.label, fontFamily: MONO, fontSize: 10, color: p.text },
        })),
      },
    ],
  };
}

/**
 * Barra de lo que hay (con el color de su estado) y una marca vertical en lo que se requiere, por fila:
 * capacidad de los aires frente a la carga térmica, iluminancia frente a la requerida…
 * La cifra de cada fila va en una columna a la derecha, para no chocar con la marca.
 */
export function bulletChart(opts: {
  items: { label: string; value: number; target: number; color: string; note?: string }[];
  unit: string;
  valueName: string;
  targetName: string;
  decimals?: number;
  dark: boolean;
}): ChartOption {
  const p = chartPalette(opts.dark);
  const decimals = opts.decimals ?? 0;
  const notes = opts.items.map((item) => item.note ?? (item.target ? formatPercent(item.value / item.target, 0) : ''));
  const category = { type: 'category', inverse: true, axisTick: { show: false } };
  return {
    animationDuration: 500,
    grid: { left: 8, right: 8, top: 30, bottom: 4, containLabel: true },
    legend: { ...legend(p, true), data: [opts.valueName, opts.targetName] },
    ...narrowLegend([opts.valueName, opts.targetName]),
    tooltip: { ...tooltip(p, opts.unit, decimals), trigger: 'axis', axisPointer: { type: 'shadow', shadowStyle: { color: withAlpha(p.axis, 0.12) } } },
    xAxis: { type: 'value', splitNumber: 3, axisLabel: { show: false }, splitLine: { lineStyle: { color: p.grid } } },
    yAxis: [
      { ...category, data: opts.items.map((i) => i.label), axisLine: { lineStyle: { color: p.line } }, axisLabel: { color: p.text, fontFamily: SANS, fontSize: 12 } },
      { ...category, position: 'right', data: notes, axisLine: { show: false }, axisLabel: { ...monoLabel(p), color: p.muted } },
    ],
    series: [
      {
        type: 'bar',
        name: opts.valueName,
        barMaxWidth: 14,
        itemStyle: { color: p.series[0] },
        data: opts.items.map((item) => ({ value: item.value, itemStyle: { color: item.color, borderRadius: [0, 4, 4, 0] } })),
      },
      {
        type: 'scatter',
        name: opts.targetName,
        symbol: 'rect',
        symbolSize: [3, 22],
        z: 3,
        itemStyle: { color: p.text },
        data: opts.items.map((item, index) => [item.target, index]),
      },
    ],
  };
}
