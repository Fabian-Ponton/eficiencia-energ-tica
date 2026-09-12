/** Lectura acumulada del medidor (kWh). */
export interface MeterReading {
  at: Date;
  kwh: number;
}

export interface ReadingPeriod {
  from: Date;
  to: Date;
  kwh: number;
  days: number;
  kwhPerDay: number;
}

export interface ReadingAnomaly {
  from: Date;
  to: Date;
  reason: 'fecha-repetida' | 'lectura-menor';
}

const MS_PER_DAY = 86_400_000;

/**
 * Consumo entre lecturas consecutivas. Las lecturas menores que la anterior (cambio de medidor,
 * error de digitación) no se cuentan y se reportan como anomalías para que el auditor las revise.
 */
export function consumptionFromReadings(readings: readonly MeterReading[]): {
  periods: ReadingPeriod[];
  anomalies: ReadingAnomaly[];
} {
  const sorted = [...readings].sort((a, b) => a.at.getTime() - b.at.getTime());
  const periods: ReadingPeriod[] = [];
  const anomalies: ReadingAnomaly[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const previous = sorted[i - 1];
    const current = sorted[i];
    const days = (current.at.getTime() - previous.at.getTime()) / MS_PER_DAY;
    const kwh = current.kwh - previous.kwh;
    if (days <= 0) anomalies.push({ from: previous.at, to: current.at, reason: 'fecha-repetida' });
    else if (kwh < 0) anomalies.push({ from: previous.at, to: current.at, reason: 'lectura-menor' });
    else periods.push({ from: previous.at, to: current.at, kwh, days, kwhPerDay: kwh / days });
  }
  return { periods, anomalies };
}
