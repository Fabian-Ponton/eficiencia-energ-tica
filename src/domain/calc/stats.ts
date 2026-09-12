export const sum = (values: readonly number[]): number => values.reduce((total, v) => total + v, 0);

export const mean = (values: readonly number[]): number => (values.length ? sum(values) / values.length : NaN);

/** Cuantil con interpolación lineal (q entre 0 y 1). */
export function quantile(values: readonly number[], q: number): number {
  if (values.length === 0) return NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const position = (sorted.length - 1) * q;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower);
}
