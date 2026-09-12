/**
 * Formatos numéricos de Colombia: punto para miles y coma para decimales.
 * Se arman a mano para no depender de los datos regionales de cada navegador.
 */

/** Redondeo decimal estable: evita que 0,575 quede en 0,57 por la representación binaria. */
export function round(value: number, decimals = 0): number {
  const factor = 10 ** decimals;
  return Math.round((value + Math.sign(value) * Number.EPSILON) * factor) / factor;
}

export function formatNumber(value: number, decimals = 0): string {
  if (!Number.isFinite(value)) return '—';
  const rounded = round(value, decimals);
  const [integer = '0', fraction] = Math.abs(rounded).toFixed(decimals).split('.');
  const grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return (rounded < 0 ? '−' : '') + grouped + (fraction ? `,${fraction}` : '');
}

export const formatCop = (value: number): string => `$${formatNumber(value)}`;

export const formatMillionsCop = (value: number, decimals = 1): string =>
  `$${formatNumber(value / 1_000_000, decimals)} M`;

/** Recibe una fracción (0,042) y la muestra como porcentaje (4,2 %). */
export const formatPercent = (fraction: number, decimals = 1): string =>
  `${formatNumber(fraction * 100, decimals)} %`;

export const formatKwh = (value: number, decimals = 0): string => `${formatNumber(value, decimals)} kWh`;
