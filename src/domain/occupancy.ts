import type { OccupancyRecord } from './types';

/**
 * Horarios, uso y ocupación de los espacios (Formato 6). Cada registro es un bloque: una actividad, un día o un
 * grupo de días, una hora de inicio y una de fin, en un periodo académico.
 */

/** Días de la semana con la letra del Formato 6 (la X es el miércoles). */
export const WEEK_DAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'] as const;

export const DAY_OPTIONS = [
  { value: 'L-V', label: 'Lunes a viernes' },
  { value: 'L-S', label: 'Lunes a sábado' },
  { value: 'L', label: 'Lunes' },
  { value: 'M', label: 'Martes' },
  { value: 'X', label: 'Miércoles' },
  { value: 'J', label: 'Jueves' },
  { value: 'V', label: 'Viernes' },
  { value: 'S', label: 'Sábado' },
  { value: 'D', label: 'Domingo' },
] as const;

/** Posiciones (0 = lunes) que cubre un día o un grupo: «L-V», «L,M,X» o «S». Vacío si no se entiende. */
export function parseDays(text: string | undefined): number[] {
  const days = new Set<number>();
  for (const part of (text ?? '').toUpperCase().split(/[,\s;]+/).filter(Boolean)) {
    const range = /^([LMXJVSD])\s*-\s*([LMXJVSD])$/.exec(part);
    if (range) {
      const from = WEEK_DAYS.indexOf(range[1] as (typeof WEEK_DAYS)[number]);
      const to = WEEK_DAYS.indexOf(range[2] as (typeof WEEK_DAYS)[number]);
      if (from <= to) for (let i = from; i <= to; i++) days.add(i);
    } else if (part.length === 1) {
      const index = WEEK_DAYS.indexOf(part as (typeof WEEK_DAYS)[number]);
      if (index >= 0) days.add(index);
    }
  }
  return [...days].sort((a, b) => a - b);
}

/** Minutos desde la medianoche de una hora HH:mm (24 h); `null` si no es una hora válida. */
export function minutesOf(time: string | undefined): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec((time ?? '').trim());
  if (!m) return null;
  const [hours, minutes] = [Number(m[1]), Number(m[2])];
  return hours < 24 && minutes < 60 ? hours * 60 + minutes : null;
}

/** Horas entre el inicio y el fin. Si el fin es menor que el inicio, el bloque cruza la medianoche. `null` si falta una hora. */
export function hoursBetween(start: string | undefined, end: string | undefined): number | null {
  const a = minutesOf(start);
  const b = minutesOf(end);
  if (a === null || b === null) return null;
  const minutes = b >= a ? b - a : 24 * 60 - a + b;
  return Math.round((minutes / 60) * 100) / 100;
}

export interface AreaUse {
  areaId: string;
  blocks: number;
  /** Horas de uso por semana: horas de cada bloque por los días que cubre. */
  weeklyHours: number;
  /** Personas presentes en promedio, ponderadas por las horas de cada bloque; `null` si ningún bloque lo dice. */
  avgOccupants: number | null;
  /** Horas por semana con el aire o la iluminación en uso. */
  acWeeklyHours: number;
  lightingWeeklyHours: number;
}

const daysCount = (record: OccupancyRecord) => parseDays(record.day).length;

/** Periodos académicos registrados, del más reciente al más antiguo. */
export const termsOf = (records: readonly OccupancyRecord[]): string[] => [...new Set(records.map((r) => r.term).filter(Boolean))].sort().reverse();

/** Uso semanal de un espacio en un periodo (o en todos, si no se indica). */
export function areaUse(records: readonly OccupancyRecord[], areaId: string, term?: string): AreaUse {
  const own = records.filter((r) => r.areaId === areaId && !r.deletedAt && (!term || r.term === term));
  let weeklyHours = 0;
  let acWeeklyHours = 0;
  let lightingWeeklyHours = 0;
  let occupantHours = 0;
  let weightedOccupants = 0;
  for (const r of own) {
    const hours = r.hours * daysCount(r);
    weeklyHours += hours;
    if (r.usesAc) acWeeklyHours += hours;
    if (r.usesLighting) lightingWeeklyHours += hours;
    if (r.avgOccupants !== undefined) {
      occupantHours += hours;
      weightedOccupants += hours * r.avgOccupants;
    }
  }
  return {
    areaId,
    blocks: own.length,
    weeklyHours,
    avgOccupants: occupantHours > 0 ? weightedOccupants / occupantHours : null,
    acWeeklyHours,
    lightingWeeklyHours,
  };
}

/** Uso semanal de todos los espacios que tienen bloques registrados. */
export function useByArea(records: readonly OccupancyRecord[], term?: string): Map<string, AreaUse> {
  const areaIds = new Set(records.filter((r) => !r.deletedAt && (!term || r.term === term)).map((r) => r.areaId));
  return new Map([...areaIds].map((id) => [id, areaUse(records, id, term)]));
}

/** Horas de uso en un día de operación promedio, para compararlas con las horas por día de los equipos del espacio. */
export const dailyUseHours = (use: AreaUse, operatingDaysPerWeek: number): number => (operatingDaysPerWeek > 0 ? use.weeklyHours / operatingDaysPerWeek : 0);
