import Dexie, { type EntityTable, type Table } from 'dexie';
import type {
  Area,
  BaselineAdjustment,
  Bill,
  CollectionItem,
  ElectricalNode,
  Equipment,
  Finding,
  IntervalDay,
  IntervalSeries,
  MaintenanceRecord,
  Measure,
  Measurement,
  MeterReadingRecord,
  OccupancyRecord,
  Pgee,
  Photo,
  Project,
  SafetyFinding,
  Settings,
  Task,
  UpmeCycle,
} from '@/domain/types';

export type PontiaDb = Dexie & {
  projects: EntityTable<Project, 'id'>;
  areas: EntityTable<Area, 'id'>;
  equipment: EntityTable<Equipment, 'id'>;
  electrical: EntityTable<ElectricalNode, 'id'>;
  measurements: EntityTable<Measurement, 'id'>;
  meterReadings: EntityTable<MeterReadingRecord, 'id'>;
  intervalSeries: EntityTable<IntervalSeries, 'id'>;
  intervalDays: Table<IntervalDay, [string, string]>;
  bills: EntityTable<Bill, 'id'>;
  photos: EntityTable<Photo, 'id'>;
  findings: EntityTable<Finding, 'id'>;
  measures: EntityTable<Measure, 'id'>;
  pgee: EntityTable<Pgee, 'id'>;
  tasks: EntityTable<Task, 'id'>;
  settings: EntityTable<Settings, 'id'>;
  /** Formato 6: horarios y ocupación por semestre. */
  occupancy: EntityTable<OccupancyRecord, 'id'>;
  /** Formato 9: mantenimiento de los equipos. */
  maintenance: EntityTable<MaintenanceRecord, 'id'>;
  /** Formato 13: control de recolección. */
  collection: EntityTable<CollectionItem, 'id'>;
  safetyFindings: EntityTable<SafetyFinding, 'id'>;
  baselineAdjustments: EntityTable<BaselineAdjustment, 'id'>;
  upmeCycles: EntityTable<UpmeCycle, 'id'>;
};

/** Base local en IndexedDB. Cada cambio de estructura debe agregar una versión nueva, nunca editar la 1. */
export function createDb(name = 'pontia'): PontiaDb {
  const db = new Dexie(name) as PontiaDb;
  db.version(1).stores({
    projects: 'id, updatedAt',
    areas: 'id, projectId',
    equipment: 'id, projectId, areaId, panelId, category',
    electrical: 'id, projectId, parentId',
    measurements: 'id, projectId, takenAt',
    meterReadings: 'id, projectId, at',
    intervalSeries: 'id, projectId',
    intervalDays: '[seriesId+date], seriesId, projectId',
    bills: 'id, projectId, period',
    photos: 'id, projectId, [entityType+entityId]',
    findings: 'id, projectId',
    measures: 'id, projectId',
    pgee: 'id, projectId',
    tasks: 'id, projectId, measureId',
    settings: 'id',
  });
  // Versión 2 (cumplimiento normativo): solo agrega tablas. No hay datos que transformar: los campos nuevos de los registros son opcionales.
  db.version(2).stores({
    occupancy: 'id, projectId, areaId, term',
    maintenance: 'id, projectId, equipmentId',
    collection: 'id, projectId, key',
    safetyFindings: 'id, projectId, entityId',
    baselineAdjustments: 'id, projectId, carrier',
    upmeCycles: 'id, projectId, year',
  });
  return db;
}

let instance: PontiaDb | undefined;

/** Base de datos de la app, creada al primer uso. */
export const getDb = (): PontiaDb => (instance ??= createDb());
