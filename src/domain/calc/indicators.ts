import { floorAreaOf } from '../areas';
import { isLabType } from '../catalogs';
import { areaUse } from '../occupancy';
import type { Area, Bill, Equipment, OccupancyRecord, Project } from '../types';
import { annualEnergyKwh } from './equipment';
import { sum } from './stats';

/** Indicadores de desempeño energético (IDEn) simples. */

/** kWh por metro cuadrado en el periodo del consumo recibido. */
export const energyIntensity = (kwh: number, areaM2: number): number => (areaM2 > 0 ? kwh / areaM2 : NaN);

/** kWh por usuario en el periodo del consumo recibido. */
export const energyPerUser = (kwh: number, users: number): number => (users > 0 ? kwh / users : NaN);

/** Costo por metro cuadrado en el periodo del costo recibido. */
export const costIntensity = (costCop: number, areaM2: number): number => (areaM2 > 0 ? costCop / areaM2 : NaN);

// ——— Indicadores por laboratorio y por variable de actividad (Res. UPME 016, §7.3) ———

/** Semanas de operación al año: los 365 días menos las vacaciones colectivas, entre 7. */
export const operatingWeeksPerYear = (calendar: Pick<Project['calendar'], 'vacationDaysPerYear'>): number => Math.max(1, (365 - Math.max(0, calendar.vacationDaysPerYear)) / 7);

export interface LabIndicator {
  areaId: string;
  name: string;
  /** Consumo anual estimado con el censo de carga del espacio. */
  annualKwh: number;
  areaM2: number | null;
  kwhPerM2Year: number | null;
  /** Horas de uso por semana según los horarios registrados; `null` si el espacio no tiene horario. */
  weeklyHours: number | null;
  /** kWh por hora de uso: consumo anual entre las horas por semana por las semanas de operación. */
  kwhPerUseHour: number | null;
  avgOccupants: number | null;
  /** kWh por persona-hora, si se conocen las personas presentes en promedio. */
  kwhPerPersonHour: number | null;
}

/** IDEn de cada laboratorio (espacios de tipo laboratorio o taller) con lo que tienen registrado; los más intensivos primero. */
export function laboratoryIndicators(
  areas: readonly Area[],
  equipment: readonly Equipment[],
  occupancy: readonly OccupancyRecord[],
  options: { weeksPerYear?: number; term?: string; all?: boolean } = {},
): LabIndicator[] {
  const weeks = options.weeksPerYear ?? 52;
  return areas
    .filter((a) => options.all || isLabType(a.spaceType))
    .map((area): LabIndicator | null => {
      const own = equipment.filter((e) => e.areaId === area.id);
      if (!own.length) return null;
      const annualKwh = sum(own.map((e) => annualEnergyKwh(e, e.operatingDaysPerMonth)));
      const m2 = floorAreaOf(area);
      const use = areaUse(occupancy, area.id, options.term);
      const weeklyHours = use.blocks ? use.weeklyHours : null;
      const useHours = weeklyHours ? weeklyHours * weeks : null;
      const perHour = useHours ? annualKwh / useHours : null;
      return {
        areaId: area.id,
        name: area.name,
        annualKwh,
        areaM2: m2,
        kwhPerM2Year: m2 ? annualKwh / m2 : null,
        weeklyHours,
        kwhPerUseHour: perHour,
        avgOccupants: use.avgOccupants,
        kwhPerPersonHour: perHour !== null && use.avgOccupants ? perHour / use.avgOccupants : null,
      };
    })
    .filter((row): row is LabIndicator => row !== null)
    .sort((a, b) => (b.kwhPerM2Year ?? b.annualKwh) - (a.kwhPerM2Year ?? a.annualKwh));
}

export interface ActivityIndicators {
  /** kWh por persona atendida y por hora de práctica, con los últimos meses que traen la variable. */
  kwhPerPerson: number | null;
  kwhPerPracticeHour: number | null;
  monthsWithPeople: number;
  monthsWithHours: number;
}

/** kWh por unidad de actividad con las facturas que registran las personas atendidas o las horas de práctica del mes. */
export function activityIndicators(bills: readonly Bill[], months = 12): ActivityIndicators {
  const recent = [...bills].sort((a, b) => a.period.localeCompare(b.period)).slice(-months);
  const withPeople = recent.filter((b) => (b.populationServed ?? 0) > 0);
  const withHours = recent.filter((b) => (b.practiceHours ?? 0) > 0);
  return {
    kwhPerPerson: withPeople.length ? sum(withPeople.map((b) => b.kwh)) / sum(withPeople.map((b) => b.populationServed ?? 0)) : null,
    kwhPerPracticeHour: withHours.length ? sum(withHours.map((b) => b.kwh)) / sum(withHours.map((b) => b.practiceHours ?? 0)) : null,
    monthsWithPeople: withPeople.length,
    monthsWithHours: withHours.length,
  };
}
