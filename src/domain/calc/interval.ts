import { mean, quantile } from './stats';

/** Registro de un analizador de redes o de telemedida: potencia media del intervalo. */
export interface IntervalReading {
  /** Inicio del intervalo, en hora local. */
  start: Date;
  kw: number;
}

export type DayType = 'laborable' | 'finDeSemana';

export const isoDate = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function dayTypeOf(date: Date, holidays: ReadonlySet<string> = new Set()): DayType {
  const day = date.getDay();
  return day === 0 || day === 6 || holidays.has(isoDate(date)) ? 'finDeSemana' : 'laborable';
}

/** Curva de carga típica: potencia media por hora del día (24 valores en kW). */
export function typicalDayProfile(
  readings: readonly IntervalReading[],
  dayType: DayType | 'todos' = 'todos',
  holidays?: ReadonlySet<string>,
): number[] {
  const buckets = Array.from({ length: 24 }, () => [] as number[]);
  for (const r of readings) {
    if (dayType !== 'todos' && dayTypeOf(r.start, holidays) !== dayType) continue;
    buckets[r.start.getHours()].push(r.kw);
  }
  return buckets.map((values) => (values.length ? mean(values) : 0));
}

export function peakDemand(readings: readonly IntervalReading[]): IntervalReading | null {
  let peak: IntervalReading | null = null;
  for (const r of readings) if (!peak || r.kw > peak.kw) peak = r;
  return peak;
}

/** Carga base: potencia que casi nunca se apaga (percentil 5 por defecto). */
export const baseLoadKw = (readings: readonly IntervalReading[], q = 0.05): number =>
  quantile(readings.map((r) => r.kw), q);

/** Factor de carga: potencia media dividida por la máxima. */
export function loadFactor(profileKw: readonly number[]): number {
  const peak = Math.max(...profileKw);
  return peak > 0 ? mean(profileKw) / peak : 0;
}

/** Energía por día (kWh) a partir de registros con intervalo fijo en minutos. */
export function energyByDay(readings: readonly IntervalReading[], intervalMinutes: number): Map<string, number> {
  const hours = intervalMinutes / 60;
  const totals = new Map<string, number>();
  for (const r of readings) {
    const key = isoDate(r.start);
    totals.set(key, (totals.get(key) ?? 0) + r.kw * hours);
  }
  return totals;
}

/** Matriz de 7 × 24 (lunes primero) con la potencia media por día de la semana y hora: base del mapa de calor. */
export function weekdayHourMatrix(readings: readonly IntervalReading[]): number[][] {
  const sums = Array.from({ length: 7 }, () => new Array<number>(24).fill(0));
  const counts = Array.from({ length: 7 }, () => new Array<number>(24).fill(0));
  for (const r of readings) {
    const day = (r.start.getDay() + 6) % 7;
    const hour = r.start.getHours();
    sums[day][hour] += r.kw;
    counts[day][hour] += 1;
  }
  return sums.map((row, d) => row.map((total, h) => (counts[d][h] ? total / counts[d][h] : 0)));
}
