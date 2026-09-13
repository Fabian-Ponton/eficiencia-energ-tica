import { annualEnergyKwh } from '@/domain/calc/equipment';
import { computeProgress, type ProjectCounts, type StageProgress } from '@/domain/progress';
import type { Bill, Project, ReportRecord } from '@/domain/types';
import { isActive } from './records';
import type { PontiaDb } from './schema';

export interface NewProjectInput {
  name: string;
  code?: string;
  client?: string;
  city?: string;
  sector?: string;
  areaM2?: number;
}

export function createProjectRecord(input: NewProjectInput, now = Date.now()): Project {
  const text = (value?: string) => value?.trim() || undefined;
  return {
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
    name: input.name.trim(),
    code: text(input.code),
    client: text(input.client),
    city: text(input.city),
    sector: text(input.sector),
    areaM2: input.areaM2 || undefined,
    calendar: { daysPerWeek: 5, holidays: [], vacationDaysPerYear: 0 },
    economics: { tariffCopPerKwh: 0, discountRate: 0.12, tariffEscalation: 0, horizonYears: 10, emissionFactorKgPerKwh: 0 },
  };
}

export async function addProject(db: PontiaDb, input: NewProjectInput): Promise<Project> {
  const project = createProjectRecord(input);
  await db.projects.add(project);
  return project;
}

/** Guarda cambios de los datos generales y marca el proyecto como modificado. */
export async function updateProject(db: PontiaDb, id: string, changes: Partial<Omit<Project, 'id' | 'createdAt'>>, now = Date.now()): Promise<void> {
  await db.projects.update(id, { ...changes, updatedAt: now });
}

/** Registra la descarga del respaldo sin cambiar la fecha de modificación. */
export const markBackup = async (db: PontiaDb, id: string, now = Date.now()): Promise<void> => {
  await db.projects.update(id, { lastBackupAt: now });
};

/** Historial de informes: se guardan los 50 más recientes. */
export const REPORT_HISTORY_LIMIT = 50;

/** Registra un informe o una exportación generada; como el respaldo, no cuenta como modificación de los datos. */
export async function logReport(db: PontiaDb, id: string, report: Omit<ReportRecord, 'id' | 'at'>, now = Date.now()): Promise<ReportRecord> {
  const entry: ReportRecord = { id: crypto.randomUUID(), at: now, ...report };
  await db.transaction('rw', db.projects, async () => {
    const project = await db.projects.get(id);
    if (!project) return;
    await db.projects.update(id, { reports: [entry, ...(project.reports ?? [])].slice(0, REPORT_HISTORY_LIMIT) });
  });
  return entry;
}

/** Oculta el proyecto sin borrar sus datos, para poder deshacer. */
export const softDeleteProject = async (db: PontiaDb, id: string, now = Date.now()): Promise<void> => {
  await db.projects.update(id, { deletedAt: now, updatedAt: now });
};

export const restoreProject = async (db: PontiaDb, id: string): Promise<void> => {
  await db.projects.update(id, { deletedAt: undefined, updatedAt: Date.now() });
};

export async function listProjects(db: PontiaDb): Promise<Project[]> {
  const projects = await db.projects.orderBy('updatedAt').reverse().toArray();
  return projects.filter((p) => !p.deletedAt);
}

/** Consumo de los últimos 12 meses facturados, si hay al menos 12. */
export function lastTwelveMonthsKwh(bills: readonly Bill[]): number | null {
  if (bills.length < 12) return null;
  return [...bills]
    .sort((a, b) => a.period.localeCompare(b.period))
    .slice(-12)
    .reduce((total, b) => total + b.kwh, 0);
}

export interface ProjectSummary {
  project: Project;
  equipmentCount: number;
  estimatedAnnualKwh: number;
  billedAnnualKwh: number | null;
  progress: StageProgress[];
}

export async function summarizeProject(db: PontiaDb, project: Project): Promise<ProjectSummary> {
  const id = project.id;
  const [areas, equipment, electrical, measurements, readings, bills, intervalSeries, findings, measures, pgee, tasks] = await Promise.all([
    db.areas.where('projectId').equals(id).filter(isActive).toArray(),
    db.equipment.where('projectId').equals(id).filter(isActive).toArray(),
    db.electrical.where('projectId').equals(id).filter(isActive).count(),
    db.measurements.where('projectId').equals(id).filter(isActive).count(),
    db.meterReadings.where('projectId').equals(id).filter(isActive).count(),
    db.bills.where('projectId').equals(id).filter(isActive).toArray(),
    db.intervalSeries.where('projectId').equals(id).filter(isActive).count(),
    db.findings.where('projectId').equals(id).filter(isActive).count(),
    db.measures.where('projectId').equals(id).filter(isActive).count(),
    db.pgee.where('projectId').equals(id).filter(isActive).toArray(),
    db.tasks.where('projectId').equals(id).filter(isActive).count(),
  ]);
  const counts: ProjectCounts = {
    hasGeneralData: Boolean(project.client && project.city && project.areaM2),
    areas: areas.length,
    areasWithDimensions: areas.filter((a) => a.lengthM && a.widthM && a.heightM).length,
    equipment: equipment.length,
    electrical,
    measurements: measurements + readings,
    bills: bills.length,
    intervalSeries,
    findings,
    measures,
    pgeeObjectives: pgee.reduce((total, p) => total + p.objectives.length, 0),
    tasks,
    reports: project.reports?.length ?? 0,
  };
  return {
    project,
    equipmentCount: equipment.reduce((total, e) => total + e.quantity, 0),
    estimatedAnnualKwh: equipment.reduce((total, e) => total + annualEnergyKwh(e, e.operatingDaysPerMonth), 0),
    billedAnnualKwh: lastTwelveMonthsKwh(bills),
    progress: computeProgress(counts),
  };
}
