import type { UpmeBaseline } from '@/domain/upmeBaseline';
import { MONTHS_SHORT, periodLabel } from '@/utils/dates';
import { baselineBandChart, linesChart } from './builders';
import type { ChartOption } from './echarts';
import { chartPalette } from './palette';

export interface UpmeBaselineFigure {
  option: ChartOption;
  title: string;
  /** Pie de la figura. */
  source: string;
}

/**
 * Gráfica de la línea base de la Res. UPME 016: en los modelos de valor absoluto y de cociente, el promedio de cada mes con su
 * banda de ±10 % y los datos de cada año; en el estadístico, el consumo real frente a la línea base y a la línea meta.
 */
export function upmeBaselineFigure(baseline: UpmeBaseline, dark: boolean): UpmeBaselineFigure | null {
  const p = chartPalette(dark);
  if (baseline.statistical) {
    const s = baseline.statistical;
    const series = [
      { name: 'Consumo real', values: s.rows.map((r) => Math.round(r.actual)), color: p.series[0] },
      { name: 'LBEn (regresión)', values: s.rows.map((r) => Math.round(r.predicted)), color: p.series[1], dashed: true },
      ...(s.target ? [{ name: 'Línea meta (mejor desempeño)', values: s.target.rows.map((r) => Math.round(r.target)), color: p.accent, dashed: true }] : []),
    ];
    return {
      title: 'Consumo real, línea base y línea meta',
      source: 'Modelo estadístico de la Res. UPME 016 de 2024: regresión con las variables significativas (probabilidad ≤ 0,05).',
      option: linesChart({ labels: s.rows.map((r) => periodLabel(r.period)), series, unit: 'kWh/mes', minZero: false, dark }),
    };
  }
  const monthly = baseline.monthly;
  if (!monthly || !monthly.monthsCovered) return null;
  const years = [...new Set(monthly.months.flatMap((m) => m.data.map((d) => d.year)))].sort((a, b) => a - b);
  const ratio = baseline.ratio;
  const decimals = ratio ? 1 : 0;
  // Con diez o más datos del mes la banda es de dos desviaciones estándar: la leyenda y el título no dicen «±10 %»
  const withDeviation = monthly.months.some((m) => m.band === 'desviacion');
  return {
    title: ratio ? `Línea base mensual del cociente (${ratio.ratioUnit})` : withDeviation ? 'Línea base mensual de la energía con su banda de verificación' : 'Línea base mensual de la energía con su banda de ±10 %',
    source: 'Promedio del mismo mes en el periodo base (Res. UPME 016 de 2024, §7.5); los rombos son datos por fuera de la banda.',
    option: baselineBandChart({
      ...(withDeviation ? { bandLabel: 'Banda de verificación' } : {}),
      labels: MONTHS_SHORT,
      baseline: monthly.months.map((m) => m.baseline),
      upper: monthly.months.map((m) => m.upper),
      lower: monthly.months.map((m) => m.lower),
      minimum: monthly.months.map((m) => m.minimum),
      years: years.map((year) => ({
        name: String(year),
        values: monthly.months.map((m) => m.data.find((d) => d.year === year)?.value ?? null),
        outside: monthly.months.map((m) => m.data.find((d) => d.year === year)?.outside ?? false),
      })),
      unit: ratio ? ratio.ratioUnit : 'kWh/mes',
      decimals,
      dark,
    }),
  };
}
