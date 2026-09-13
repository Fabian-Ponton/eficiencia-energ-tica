import { loadSeriesReadings } from '@/db/intervals';
import type { PontiaDb } from '@/db/schema';
import type { ReportData } from './model';

const alive = <T extends { deletedAt?: number }>(rows: T[]): T[] => rows.filter((r) => !r.deletedAt);
const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, 'es', { numeric: true });

/** Lee todo lo que necesita el informe de un proyecto: solo los registros vigentes, ya ordenados. */
export async function loadReportData(db: PontiaDb, projectId: string, generatedAt = new Date()): Promise<ReportData> {
  const project = await db.projects.get(projectId);
  if (!project || project.deletedAt) throw new Error('El proyecto no existe en este equipo.');
  const [areas, equipment, electrical, measurements, readings, bills, series, photos] = await Promise.all([
    db.areas.where('projectId').equals(projectId).toArray(),
    db.equipment.where('projectId').equals(projectId).toArray(),
    db.electrical.where('projectId').equals(projectId).toArray(),
    db.measurements.where('projectId').equals(projectId).toArray(),
    db.meterReadings.where('projectId').equals(projectId).toArray(),
    db.bills.where('projectId').equals(projectId).toArray(),
    db.intervalSeries.where('projectId').equals(projectId).toArray(),
    db.photos.where('projectId').equals(projectId).toArray(),
  ]);

  // Serie principal: la más reciente de toda la instalación; si ninguna lo es, la más reciente
  const activeSeries = alive(series).sort((a, b) => b.createdAt - a.createdAt);
  const main = activeSeries.find((s) => s.wholeFacility) ?? activeSeries[0];

  return {
    project,
    areas: alive(areas).sort(byName),
    equipment: alive(equipment),
    electrical: alive(electrical),
    measurements: alive(measurements).sort((a, b) => a.takenAt.localeCompare(b.takenAt)),
    readings: alive(readings).sort((a, b) => a.at.localeCompare(b.at)),
    bills: alive(bills).sort((a, b) => a.period.localeCompare(b.period)),
    series: activeSeries,
    mainSeries: main ? { series: main, readings: await loadSeriesReadings(db, main) } : undefined,
    photos: alive(photos).sort((a, b) => a.takenAt.localeCompare(b.takenAt)),
    generatedAt,
  };
}
