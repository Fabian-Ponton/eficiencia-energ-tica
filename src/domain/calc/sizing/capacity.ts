export const kvaFromKw = (kw: number, powerFactor: number): number => kw / powerFactor;

/** Corriente de línea en un sistema trifásico (A). */
export const threePhaseCurrentA = (kva: number, lineVoltageV: number): number => (kva * 1000) / (Math.sqrt(3) * lineVoltageV);

export const singlePhaseCurrentA = (kva: number, voltageV: number): number => (kva * 1000) / voltageV;

/** Carga respecto a la capacidad (transformador, tablero o protección) como fracción. */
export const loadingRatio = (demand: number, capacity: number): number => demand / capacity;

export type LoadingLevel = 'normal' | 'alta' | 'critica';

/** Menos del 60 %: normal; del 60 % al 80 %: alta; más del 80 %: crítica. Umbrales configurables. */
export function loadingLevel(ratio: number, { high = 0.6, critical = 0.8 } = {}): LoadingLevel {
  if (ratio > critical + 1e-9) return 'critica';
  if (ratio >= high) return 'alta';
  return 'normal';
}

/** Desbalance de corrientes entre fases: máxima desviación respecto al promedio, como fracción. */
export function phaseImbalance(currents: readonly number[]): number {
  const average = currents.reduce((a, b) => a + b, 0) / currents.length;
  if (average === 0) return 0;
  return Math.max(...currents.map((i) => Math.abs(i - average))) / average;
}
