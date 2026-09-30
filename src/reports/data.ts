import { loadSeriesReadings } from '@/db/intervals';
import type { PontiaDb } from '@/db/schema';
import { isElectric, isNotElectric } from '@/domain/carriers';
import { SEVERITY_ORDER } from '@/domain/diagnosis';
import { savingsTypeOf } from '@/domain/measures';
import { measureAllowance, tenureScope } from '@/domain/tenure';
import type { ReportData } from './model';

const alive = <T extends { deletedAt?: number }>(rows: T[]): T[] => rows.filter((r) => !r.deletedAt);
const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, 'es', { numeric: true });

/** Lee todo lo que necesita el informe de un proyecto: solo los registros vigentes, ya ordenados. */
export async function loadReportData(db: PontiaDb, projectId: string, generatedAt = new Date()): Promise<ReportData> {
  const project = await db.projects.get(projectId);
  if (!project || project.deletedAt) throw new Error('El proyecto no existe en este equipo.');
  const [areas, equipment, electrical, measurements, readings, bills, series, photos, findings, measures, tasks, occupancy, maintenance, collection, baselineAdjustments] = await Promise.all([
    db.areas.where('projectId').equals(projectId).toArray(),
    db.equipment.where('projectId').equals(projectId).toArray(),
    db.electrical.where('projectId').equals(projectId).toArray(),
    db.measurements.where('projectId').equals(projectId).toArray(),
    db.meterReadings.where('projectId').equals(projectId).toArray(),
    db.bills.where('projectId').equals(projectId).toArray(),
    db.intervalSeries.where('projectId').equals(projectId).toArray(),
    db.photos.where('projectId').equals(projectId).toArray(),
    db.findings.where('projectId').equals(projectId).toArray(),
    db.measures.where('projectId').equals(projectId).toArray(),
    db.tasks.where('projectId').equals(projectId).toArray(),
    db.occupancy.where('projectId').equals(projectId).toArray(),
    db.maintenance.where('projectId').equals(projectId).toArray(),
    db.collection.where('projectId').equals(projectId).toArray(),
    db.baselineAdjustments.where('projectId').equals(projectId).toArray(),
  ]);

  // Serie principal: la más reciente de toda la instalación; si ninguna lo es, la más reciente
  const activeSeries = alive(series).sort((a, b) => b.createdAt - a.createdAt);
  const main = activeSeries.find((s) => s.wholeFacility) ?? activeSeries[0];

  return {
    project,
    areas: alive(areas).sort(byName),
    equipment: alive(equipment).filter(isElectric),
    otherEquipment: alive(equipment).filter(isNotElectric),
    electrical: alive(electrical),
    measurements: alive(measurements).sort((a, b) => a.takenAt.localeCompare(b.takenAt)),
    readings: alive(readings).sort((a, b) => a.at.localeCompare(b.at)),
    bills: alive(bills).filter(isElectric).sort((a, b) => a.period.localeCompare(b.period)),
    otherBills: alive(bills).filter(isNotElectric).sort((a, b) => a.period.localeCompare(b.period)),
    occupancy: alive(occupancy),
    maintenance: alive(maintenance),
    collection: alive(collection),
    baselineAdjustments: alive(baselineAdjustments).sort((a, b) => a.date.localeCompare(b.date)),
    series: activeSeries,
    mainSeries: main ? { series: main, readings: await loadSeriesReadings(db, main) } : undefined,
    photos: alive(photos).sort((a, b) => a.takenAt.localeCompare(b.takenAt)),
    findings: alive(findings).sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] || a.createdAt - b.createdAt),
    // Una medida que la tenencia no permite no entra al plan, aunque un dato viejo la marque
    measures: alive(measures)
      .map((m) => (m.selected && measureAllowance(tenureScope(project.building?.tenure, project.entity?.kind), savingsTypeOf(m)) === 'no-permitida' ? { ...m, selected: false } : m))
      .sort((a, b) => a.code.localeCompare(b.code, 'es', { numeric: true })),
    tasks: alive(tasks).sort((a, b) => (a.start ?? '9999').localeCompare(b.start ?? '9999') || a.name.localeCompare(b.name, 'es')),
    generatedAt,
  };
}
