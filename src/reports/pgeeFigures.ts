import { bubbleChart, routeChart } from '@/charts/builders';
import { chartPalette } from '@/charts/palette';
import type { RoutePlan } from '@/domain/route';
import type { Measure } from '@/domain/types';
import type { ReportFigure } from './figures';

/** Figuras del PGEE: la ruta anual frente a la meta legal y la matriz de priorización de las medidas del plan (modo claro, para Word y PNG). */
export function pgeeFigures(measures: readonly Measure[], route?: RoutePlan): ReportFigure[] {
  const figures: ReportFigure[] = [];
  if (route?.rows.length) {
    figures.push({
      id: 'ruta-anual',
      title: 'Ruta de cumplimiento anual de ahorro',
      source: 'Ahorro anual previsto con las medidas que ya operan cada año, frente a la meta del año y al mínimo legal (Ley 1715, art. 30).',
      option: routeChart({ rows: route.rows, legalPct: route.legal.pct, dark: false }),
      width: 960,
      height: 420,
    });
  }
  if (!measures.length) return figures;
  const p = chartPalette(false);
  const colors = { alta: p.serious, media: p.warning, baja: p.estimate } as const;
  return [
    ...figures,
    {
      id: 'matriz-priorizacion',
      title: 'Matriz de priorización de las medidas',
      source: 'Inversión frente al ahorro anual en millones de pesos; el tamaño de cada burbuja es la energía ahorrada.',
      option: bubbleChart({
        dark: false,
        xUnit: 'M COP',
        yUnit: 'M COP/año',
        points: measures.map((m) => ({
          label: m.code,
          x: Math.round(m.investmentCop / 10_000) / 100,
          y: Math.round(m.savingsCopYear / 10_000) / 100,
          size: m.savingsKwhYear,
          color: m.priority ? colors[m.priority] : p.series[0],
        })),
      }),
      width: 960,
      height: 440,
    },
  ];
}
