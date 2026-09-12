import type { Table } from 'dexie';
import { computed } from 'vue';
import { isActive, type RecordTable, type RecordTables } from '@/db/records';
import { getDb } from '@/db/schema';
import type { EntityType } from '@/domain/types';
import { useCurrentProject } from './useCurrentProject';
import { useLiveQuery } from './useLiveQuery';

/** Registros vigentes (no eliminados) del proyecto abierto, actualizados en vivo. */
export function useProjectRecords<K extends RecordTable>(name: K, sort?: (a: RecordTables[K], b: RecordTables[K]) => number) {
  const { projectId } = useCurrentProject();
  const db = getDb();
  const live = useLiveQuery(async () => {
    const table = db.table(name) as Table<RecordTables[K], string>;
    const rows = await table
      .where('projectId')
      .equals(projectId.value)
      .filter((row) => !row.deletedAt)
      .toArray();
    return sort ? rows.sort(sort) : rows;
  }, [projectId]);
  return { rows: computed(() => live.value ?? []), ready: computed(() => live.value !== undefined) };
}

/** Cantidad de fotos vigentes de cada registro, para el contador de las listas. */
export function usePhotoCounts(entityType: EntityType) {
  const { projectId } = useCurrentProject();
  const db = getDb();
  const live = useLiveQuery(async () => {
    const counts = new Map<string, number>();
    await db.photos
      .where('projectId')
      .equals(projectId.value)
      .filter((photo) => isActive(photo) && photo.entityType === entityType)
      .each((photo) => {
        if (photo.entityId) counts.set(photo.entityId, (counts.get(photo.entityId) ?? 0) + 1);
      });
    return counts;
  }, [projectId]);
  return computed(() => live.value ?? new Map<string, number>());
}
