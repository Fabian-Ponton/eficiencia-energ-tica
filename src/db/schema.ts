import Dexie, { type EntityTable, type Table } from 'dexie';
import type {
  Area,
  Bill,
  ElectricalNode,
  Equipment,
  Finding,
  IntervalDay,
  IntervalSeries,
  Measure,
  Measurement,
  MeterReadingRecord,
  Pgee,
  Photo,
  Project,
  Settings,
  Task,
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
  return db;
}

let instance: PontiaDb | undefined;

/** Base de datos de la app, creada al primer uso. */
export const getDb = (): PontiaDb => (instance ??= createDb());
