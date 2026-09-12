import type { Table } from 'dexie';
import type { Area, Bill, ElectricalNode, EntityType, Equipment, IntervalSeries, Measurement, MeterReadingRecord, Photo } from '@/domain/types';
import type { PontiaDb } from './schema';

/** Tablas que se editan desde las pantallas de la auditoría. */
export interface RecordTables {
  areas: Area;
  equipment: Equipment;
  electrical: ElectricalNode;
  measurements: Measurement;
  meterReadings: MeterReadingRecord;
  bills: Bill;
  photos: Photo;
  intervalSeries: IntervalSeries;
}
export type RecordTable = keyof RecordTables;

/** Registro tal como lo arma un formulario: las fechas de control las pone `saveRecord`. */
export type Draft<T> = Omit<T, 'createdAt' | 'updatedAt' | 'deletedAt'> & { createdAt?: number };

export const isActive = (record: { deletedAt?: number }): boolean => !record.deletedAt;

/** Tipo de vínculo de las fotos de cada tabla: al eliminar un registro también se ocultan sus fotos. */
const PHOTO_ENTITY: Partial<Record<RecordTable, EntityType>> = {
  areas: 'area',
  equipment: 'equipo',
  electrical: 'electrico',
  measurements: 'medicion',
  meterReadings: 'medicion',
  bills: 'factura',
};

/** Quita los campos vacíos (null, undefined o texto en blanco) y recorta los textos. */
export function compact<T extends object>(value: T): T {
  const out: Record<string, unknown> = {};
  for (const [key, field] of Object.entries(value)) {
    if (field === null || field === undefined) continue;
    if (typeof field === 'string') {
      const text = field.trim();
      if (text) out[key] = text;
    } else out[key] = field;
  }
  return out as T;
}

const tableOf = <K extends RecordTable>(db: PontiaDb, name: K) => db.table(name) as Table<RecordTables[K], string>;

/** Crea o reemplaza un registro y marca el proyecto como modificado. */
export async function saveRecord<K extends RecordTable>(
  db: PontiaDb,
  name: K,
  draft: Draft<RecordTables[K]>,
  now = Date.now(),
): Promise<RecordTables[K]> {
  const record = { ...compact(draft), createdAt: draft.createdAt ?? now, updatedAt: now } as unknown as RecordTables[K];
  const table = tableOf(db, name);
  await db.transaction('rw', [table, db.projects], async () => {
    await table.put(record);
    await db.projects.update(record.projectId, { updatedAt: now });
  });
  return record;
}

/** Oculta registros (y sus fotos) sin borrarlos, para poder deshacer. */
export async function softDeleteRecords(db: PontiaDb, name: RecordTable, ids: readonly string[], now = Date.now()): Promise<void> {
  const table: Table = db.table(name);
  const entityType = PHOTO_ENTITY[name];
  await db.transaction('rw', [table, db.photos, db.projects], async () => {
    const records = (await table.bulkGet([...ids])).filter((r): r is { id: string; projectId: string } => Boolean(r));
    for (const record of records) {
      await table.update(record.id, { deletedAt: now, updatedAt: now });
      if (entityType) {
        await db.photos
          .where('[entityType+entityId]')
          .equals([entityType, record.id])
          .filter(isActive)
          .modify({ deletedAt: now, updatedAt: now });
      }
    }
    for (const projectId of new Set(records.map((r) => r.projectId))) await db.projects.update(projectId, { updatedAt: now });
  });
}

/** Deshace `softDeleteRecords`: recupera los registros y las fotos que se ocultaron con ellos. */
export async function restoreRecords(db: PontiaDb, name: RecordTable, ids: readonly string[], now = Date.now()): Promise<void> {
  const table: Table = db.table(name);
  const entityType = PHOTO_ENTITY[name];
  await db.transaction('rw', [table, db.photos, db.projects], async () => {
    const records = (await table.bulkGet([...ids])).filter((r): r is { id: string; projectId: string; deletedAt?: number } => Boolean(r));
    for (const record of records) {
      const deletedAt = record.deletedAt;
      if (!deletedAt) continue;
      await table.update(record.id, { deletedAt: undefined, updatedAt: now });
      if (entityType) {
        await db.photos
          .where('[entityType+entityId]')
          .equals([entityType, record.id])
          .filter((photo) => photo.deletedAt === deletedAt)
          .modify((photo) => {
            delete photo.deletedAt;
            photo.updatedAt = now;
          });
      }
    }
    for (const projectId of new Set(records.map((r) => r.projectId))) await db.projects.update(projectId, { updatedAt: now });
  });
}

/** Borra las fotos de un registro nuevo que se descartó sin guardarlo. */
export const discardPhotos = (db: PontiaDb, entityType: EntityType, entityId: string): Promise<number> =>
  db.photos.where('[entityType+entityId]').equals([entityType, entityId]).delete();
