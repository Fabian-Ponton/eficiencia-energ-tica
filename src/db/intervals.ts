import type { IntervalReading } from '@/domain/calc/interval';
import { expandDays } from '@/domain/importers/intervalCsv';
import type { IntervalDay, IntervalSeries } from '@/domain/types';
import type { PontiaDb } from './schema';

export type NewSeries = Omit<IntervalSeries, 'createdAt' | 'updatedAt' | 'deletedAt'>;

/** Resumen de una serie (fechas, días, demanda máxima y energía) para listarla sin leer todos los días. */
export function summarizeDays(days: readonly { date: string; values: readonly number[] }[], intervalMinutes: number) {
  const hours = intervalMinutes / 60;
  let peakKw = 0;
  let energyKwh = 0;
  for (const day of days) {
    for (const kw of day.values) {
      if (!Number.isFinite(kw)) continue;
      peakKw = Math.max(peakKw, kw);
      energyKwh += kw * hours;
    }
  }
  return { firstDate: days[0]?.date, lastDate: days[days.length - 1]?.date, dayCount: days.length, peakKw, energyKwh };
}

/** Guarda una serie importada y sus días en una sola transacción. */
export async function saveIntervalSeries(
  db: PontiaDb,
  series: NewSeries,
  days: readonly { date: string; values: number[] }[],
  now = Date.now(),
): Promise<IntervalSeries> {
  const record: IntervalSeries = { ...series, ...summarizeDays(days, series.intervalMinutes), createdAt: now, updatedAt: now };
  const rows: IntervalDay[] = days.map((d) => ({ seriesId: record.id, projectId: record.projectId, date: d.date, values: d.values }));
  await db.transaction('rw', [db.intervalSeries, db.intervalDays, db.projects], async () => {
    await db.intervalSeries.put(record);
    await db.intervalDays.where('seriesId').equals(record.id).delete();
    await db.intervalDays.bulkPut(rows);
    await db.projects.update(record.projectId, { updatedAt: now });
  });
  return record;
}

/** Registros de una serie en orden cronológico, sin los intervalos vacíos. */
export async function loadSeriesReadings(db: PontiaDb, series: Pick<IntervalSeries, 'id' | 'intervalMinutes'>): Promise<IntervalReading[]> {
  const days = await db.intervalDays.where('seriesId').equals(series.id).sortBy('date');
  return expandDays(days, series.intervalMinutes);
}
