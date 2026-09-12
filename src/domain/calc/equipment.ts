/** Uso de un equipo del censo de carga. */
export interface EquipmentUsage {
  /** Potencia eléctrica de una unidad, en kW. */
  powerKw: number;
  quantity: number;
  /** Horas de funcionamiento en un día de operación. */
  hoursPerDay: number;
  /** Fracción del tiempo de uso en que el equipo trabaja a plena carga (0 a 1). */
  useFactor?: number;
}

/** Días de operación por mes que usaba PONTIA 1.6 cuando no se indica otro valor. */
export const DEFAULT_OPERATING_DAYS_PER_MONTH = 22;

export const installedPowerKw = (e: Pick<EquipmentUsage, 'powerKw' | 'quantity'>): number => e.powerKw * e.quantity;

export const dailyEnergyKwh = (e: EquipmentUsage): number =>
  e.powerKw * e.quantity * e.hoursPerDay * (e.useFactor ?? 1);

export const monthlyEnergyKwh = (e: EquipmentUsage, operatingDaysPerMonth = DEFAULT_OPERATING_DAYS_PER_MONTH): number =>
  dailyEnergyKwh(e) * operatingDaysPerMonth;

export const annualEnergyKwh = (e: EquipmentUsage, operatingDaysPerMonth = DEFAULT_OPERATING_DAYS_PER_MONTH): number =>
  monthlyEnergyKwh(e, operatingDaysPerMonth) * 12;

/** Perfil de 24 horas (kW) a partir de las horas marcadas como en uso. */
export function hourlyProfileKw(e: Omit<EquipmentUsage, 'hoursPerDay'>, activeHours: readonly boolean[]): number[] {
  const kw = e.powerKw * e.quantity * (e.useFactor ?? 1);
  return Array.from({ length: 24 }, (_, hour) => (activeHours[hour] ? kw : 0));
}

/** Suma hora a hora los perfiles de varios equipos: curva diaria estimada desde el inventario. */
export function sumProfiles(profiles: readonly (readonly number[])[]): number[] {
  const total = new Array<number>(24).fill(0);
  for (const profile of profiles) {
    for (let hour = 0; hour < 24; hour++) total[hour] += profile[hour] ?? 0;
  }
  return total;
}
