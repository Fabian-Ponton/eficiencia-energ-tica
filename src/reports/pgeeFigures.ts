import { bubbleChart } from '@/charts/builders';
import { chartPalette } from '@/charts/palette';
import type { Measure } from '@/domain/types';
import type { ReportFigure } from './figures';

/** Figuras del PGEE: la matriz de priorización de las medidas del plan (modo claro, para Word y PNG). */
export function pgeeFigures(measures: readonly Measure[]): ReportFigure[] {
  if (!measures.length) return [];
  const p = chartPalette(false);
  const colors = { alta: p.serious, media: p.warning, baja: p.estimate } as const;
  return [
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
