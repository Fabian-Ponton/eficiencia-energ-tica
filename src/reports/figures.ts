import { barsChart, bulletChart, dayProfileChart, linesChart, paretoChart, sankeyChart, weekHeatmapChart } from '@/charts/builders';
import type { ChartOption } from '@/charts/echarts';
import { chartPalette } from '@/charts/palette';
import { singleLineChart } from '@/charts/singleLineChart';
import { endUseOf } from '@/domain/catalogs';
import type { EndUseCategory } from '@/domain/types';
import { MONTHS_SHORT, periodLabel } from '@/utils/dates';
import type { AuditModel } from './model';
import { pgeeFigures } from './pgeeFigures';

/** Figura del informe: la gráfica en modo claro y el tamaño en píxeles al que se dibuja. */
export interface ReportFigure {
  id: string;
  title: string;
  /** Fuente o aclaración que va en el pie de la figura. */
  source: string;
  option: ChartOption;
  width: number;
  height: number;
}

const round1 = (values: readonly number[]) => values.map((v) => Math.round(v * 10) / 10);
const monthName = (period: string) => MONTHS_SHORT[Number(period.slice(5, 7)) - 1] ?? period;

/** Todas las figuras que el informe puede incluir, en el orden en que aparecen. */
export function auditFigures(m: AuditModel): ReportFigure[] {
  const p = chartPalette(false);
  const figures: ReportFigure[] = [];
  const add = (figure: ReportFigure | null) => figure && figures.push(figure);

  const last12 = m.months.slice(-12);
  if (last12.length) {
    const hasPrevious = last12.some((r) => r.previousKwh !== null);
    const current = { name: `${periodLabel(last12[0].period)} – ${periodLabel(last12[last12.length - 1].period)}`, values: last12.map((r) => r.kwh), color: p.series[0] };
    add({
      id: 'consumo-mensual',
      title: 'Consumo mensual de energía',
      source: hasPrevious ? 'Facturas del operador de red; en gris, el mismo mes del año anterior.' : 'Facturas del operador de red.',
      option: barsChart({
        labels: last12.map((r) => monthName(r.period)),
        series: hasPrevious ? [{ name: 'Año anterior', values: last12.map((r) => r.previousKwh), color: p.estimate }, current] : [current],
        unit: 'kWh',
        highlightMax: !hasPrevious,
        dark: false,
      }),
      width: 960,
      height: 400,
    });
  }
  if (m.annual.rolling.length >= 2) {
    add({
      id: 'tendencia-anual',
      title: 'Tendencia del consumo anual',
      source: 'Suma móvil de los últimos 12 meses facturados.',
      option: linesChart({
        labels: m.annual.rolling.map((r) => periodLabel(r.period)),
        series: [{ name: 'Suma de 12 meses', values: m.annual.rolling.map((r) => r.kwh), area: true }],
        unit: 'kWh',
        minZero: false,
        dark: false,
      }),
      width: 960,
      height: 360,
    });
  }

  const hasEstimate = m.estimated.laborable.some((kw) => kw > 0);
  if (m.daily || hasEstimate) {
    const series = m.data.mainSeries?.series;
    const compare = hasEstimate && Boolean(series?.wholeFacility);
    add({
      id: 'curva-de-carga',
      title: m.daily ? 'Curva de carga típica' : 'Curva de carga estimada con el inventario',
      source: m.daily && series ? `${series.name}: ${m.daily.completeDays} días completos, registro cada ${series.intervalMinutes} min.` : 'Horarios de uso registrados en el inventario.',
      option: dayProfileChart({
        dark: false,
        series: m.daily
          ? [
              { name: 'Laborable · medido', values: round1(m.daily.weekdayProfile), color: p.series[0], area: true },
              ...(m.daily.dailyEnergy.some((d) => d.weekend) ? [{ name: 'Fin de semana · medido', values: round1(m.daily.weekendProfile), color: p.series[1] }] : []),
              ...(compare ? [{ name: 'Estimado con el inventario', values: round1(m.estimated.laborable), color: p.estimate, dashed: true }] : []),
            ]
          : [
              { name: 'Laborable · estimado', values: round1(m.estimated.laborable), color: p.series[0], area: true },
              { name: 'Fin de semana · estimado', values: round1(m.estimated.finDeSemana), color: p.series[1] },
            ],
      }),
      width: 960,
      height: 380,
    });
  }
  if (m.daily) {
    add({
      id: 'mapa-de-calor',
      title: 'Potencia media por día de la semana y hora',
      source: 'Registro del analizador de redes o del medidor inteligente.',
      option: weekHeatmapChart({ matrix: m.daily.matrix, dark: false }),
      width: 960,
      height: 360,
    });
  }

  if (m.shares.length) {
    const significant = new Set(m.significant.map((s) => s.category));
    add({
      id: 'pareto-usos',
      title: 'Consumo anual por uso final',
      source: 'Censo de carga; a color, los usos significativos (80 % del consumo).',
      option: paretoChart({
        dark: false,
        items: m.shares.map((s) => ({
          label: endUseOf(s.category as EndUseCategory).label,
          kwh: Math.round(s.kwh),
          share: s.share,
          cumulative: s.cumulativeShare,
          color: endUseOf(s.category as EndUseCategory).color,
          significant: significant.has(s.category),
        })),
      }),
      width: 960,
      height: Math.max(260, m.shares.length * 46),
    });
  }
  if (m.flow.nodes.length > 1) {
    add({
      id: 'flujo-energia',
      title: 'Flujo anual de la energía',
      source: 'Del consumo total a los usos finales y a los espacios (kWh/año).',
      option: sankeyChart({
        dark: false,
        unit: 'kWh/año',
        // En el informe: flujos de color sólido (PNG liviano) y espacio para nombres largos de espacios
        labelSpace: 220,
        linkColor: 'source',
        nodes: m.flow.nodes.map((n) => ({
          id: n.id,
          label: n.label,
          color: n.kind === 'total' ? p.navy : n.kind === 'resto' ? p.estimate : n.kind === 'area' ? p.axis : endUseOf(n.category ?? 'otros').color,
        })),
        links: m.flow.links.map((l) => ({ source: l.source, target: l.target, value: Math.round(l.kwh) })),
      }),
      width: 960,
      height: Math.max(420, m.flow.nodes.length * 34),
    });
  }
  if (m.baseline) {
    add({
      id: 'linea-base',
      title: 'Consumo real frente a la línea base',
      source: 'Regresión con las variables relevantes de las facturas (ISO 50006).',
      option: linesChart({
        labels: m.baseline.rows.map((r) => periodLabel(r.period)),
        series: [
          { name: 'Consumo real', values: m.baseline.rows.map((r) => r.actual), color: p.series[0] },
          { name: 'Línea base', values: m.baseline.rows.map((r) => Math.round(r.predicted)), color: p.series[1], dashed: true },
        ],
        unit: 'kWh',
        minZero: false,
        dark: false,
      }),
      width: 960,
      height: 380,
    });
  }

  if (m.cooling.length) {
    const colors = { adecuado: p.good, subdimensionado: p.serious, sobredimensionado: p.warning, 'sin-aire': p.estimate } as const;
    add({
      id: 'climatizacion',
      title: 'Capacidad de climatización frente a la carga térmica',
      source: 'Método simplificado de carga térmica; la marca oscura es la carga requerida.',
      option: bulletChart({
        dark: false,
        unit: 'BTU/h',
        valueName: 'Capacidad instalada',
        targetName: 'Carga requerida',
        items: m.cooling.map((c) => ({
          label: c.area.name,
          value: Math.round(c.installedBtuH),
          target: Math.round(c.requiredBtuH),
          color: colors[c.status],
          note: c.status === 'sin-aire' ? 'sin aire' : undefined,
        })),
      }),
      width: 960,
      height: Math.max(220, m.cooling.length * 44 + 60),
    });
  }
  if (m.lighting.length) {
    const colors = { adecuada: p.good, insuficiente: p.serious, excesiva: p.warning } as const;
    add({
      id: 'iluminacion',
      title: 'Iluminancia frente a la requerida',
      source: 'Iluminancia medida o calculada con el método de los lúmenes; la marca oscura es la referencia.',
      option: bulletChart({
        dark: false,
        unit: 'lx',
        valueName: 'Iluminancia actual',
        targetName: 'Requerida',
        items: m.lighting.map((l) => ({
          label: l.area.name,
          value: Math.round(l.lux ?? 0),
          target: l.requiredLux,
          color: l.status ? colors[l.status] : p.estimate,
          note: l.lux === null ? 'sin dato' : `${Math.round(l.lux)} lx`,
        })),
      }),
      width: 960,
      height: Math.max(220, m.lighting.length * 44 + 60),
    });
  }
  if (m.data.electrical.length) {
    const diagram = singleLineChart(m.data.electrical, m.capacity.byNode);
    add({
      id: 'unifilar',
      title: 'Diagrama unifilar simplificado',
      source: 'Carga de cada elemento frente a su capacidad; en rojo, más del 80 %.',
      option: diagram.option,
      width: diagram.width,
      height: diagram.height,
    });
  }
  // Matriz de priorización de todas las medidas evaluadas (el PGEE muestra solo las del plan)
  figures.push(...pgeeFigures(m.data.measures));
  return figures;
}
