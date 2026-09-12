import type { EndUseCategory, Equipment } from './types';

/** Hora de inicio que se supone cuando un equipo no tiene horario marcado. */
export const DEFAULT_START_HOUR = 7;

type Schedule = Pick<Equipment, 'activeHours' | 'hoursPerDay'>;

/**
 * Fracción de cada hora del día en que el equipo funciona: las horas marcadas en su horario
 * o, si no tiene, un bloque continuo desde las 7:00 con la duración de sus horas de uso.
 */
export function scheduleWeights(e: Schedule): number[] {
  if (e.activeHours?.some(Boolean)) return Array.from({ length: 24 }, (_, h) => (e.activeHours?.[h] ? 1 : 0));
  const hours = Math.max(0, Math.min(24, Number.isFinite(e.hoursPerDay) ? e.hoursPerDay : 0));
  return Array.from({ length: 24 }, (_, h) => Math.max(0, Math.min(1, hours - ((h - DEFAULT_START_HOUR + 24) % 24))));
}

/**
 * Parte de los días laborables y de los fines de semana en que opera un equipo, según sus días de uso al mes:
 * 22 días = lunes a viernes; 30 días = todos los días.
 */
export function dayFactors(operatingDaysPerMonth: number): { laborable: number; finDeSemana: number } {
  const days = Number.isFinite(operatingDaysPerMonth) ? operatingDaysPerMonth : 0;
  return { laborable: Math.min(1, Math.max(0, days / 22)), finDeSemana: Math.max(0, Math.min(1, (days - 22) / 6)) };
}

/** Potencia de un equipo hora por hora en un día en que opera (kW). */
export const equipmentProfile = (e: Equipment): number[] =>
  scheduleWeights(e).map((weight) => weight * e.powerKw * e.quantity * (e.useFactor ?? 1));

export interface EstimatedProfiles {
  laborable: number[];
  finDeSemana: number[];
  /** Aporte de cada uso final a la curva de un día laborable. */
  byCategory: Map<EndUseCategory, number[]>;
}

/** Curva diaria estimada desde el inventario: día laborable, fin de semana y aporte de cada uso final. */
export function estimatedProfiles(equipment: readonly Equipment[]): EstimatedProfiles {
  const laborable = new Array<number>(24).fill(0);
  const finDeSemana = new Array<number>(24).fill(0);
  const byCategory = new Map<EndUseCategory, number[]>();
  for (const e of equipment) {
    const factors = dayFactors(e.operatingDaysPerMonth);
    const category = byCategory.get(e.category) ?? new Array<number>(24).fill(0);
    equipmentProfile(e).forEach((kw, h) => {
      if (!Number.isFinite(kw)) return;
      laborable[h] += kw * factors.laborable;
      finDeSemana[h] += kw * factors.finDeSemana;
      category[h] += kw * factors.laborable;
    });
    byCategory.set(e.category, category);
  }
  return { laborable, finDeSemana, byCategory };
}
