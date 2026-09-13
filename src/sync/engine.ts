import type { Table } from 'dexie';
import type { PontiaDb } from '@/db/schema';
import type { CloudSession, IntervalDay, Photo } from '@/domain/types';
import type { CloudClient, CloudRow } from './client';

/**
 * Sincronización con la nube: sube lo que cambió en este equipo y baja lo que cambió en los demás.
 * Gana el cambio más reciente de cada registro (`updatedAt`); lo eliminado viaja como marca (`deletedAt`).
 * Las fotos van al depósito privado del usuario y los días de cada serie viajan dentro de su serie.
 */

/** Tablas que se sincronizan; las fotos al final, para que sus registros lleguen después de lo que documentan. */
export const SYNC_TABLES = ['projects', 'areas', 'equipment', 'electrical', 'measurements', 'meterReadings', 'intervalSeries', 'bills', 'findings', 'measures', 'pgee', 'tasks', 'photos'] as const;
type SyncTable = (typeof SYNC_TABLES)[number];
type AnyRecord = { id: string; projectId?: string; createdAt: number; updatedAt: number; deletedAt?: number } & Record<string, unknown>;

/** Hasta dónde va la sincronización de este equipo. Se actualiza mientras avanza, para retomar si se corta. */
export interface SyncState {
  lastSeq: number;
  lastPushedAt: number;
}

export interface SyncReport {
  pushed: number;
  pulled: number;
  photosUp: number;
  photosDown: number;
  /** Cambios de la nube que ya estaban aquí o que perdieron contra uno más reciente de este equipo. */
  skipped: number;
}

export type SyncProgress = (step: string) => void;

const CHUNK = 200;
const PAGE = 500;

/** Ruta de la foto en el depósito: la carpeta del usuario, la del proyecto y el id de la foto. */
export const photoPath = (owner: string, photo: Pick<Photo, 'projectId' | 'id'>, thumb = false) => `${owner}/${photo.projectId}/${photo.id}${thumb ? '-miniatura' : ''}.jpg`;

const isSyncTable = (name: string): name is SyncTable => (SYNC_TABLES as readonly string[]).includes(name);
const tableOf = (db: PontiaDb, name: SyncTable) => db.table(name) as Table<AnyRecord, string>;

/** Registro listo para la nube: las fotos sin el binario (va al depósito) y cada serie con sus días. */
async function toRow(db: PontiaDb, table: SyncTable, record: AnyRecord, owner: string): Promise<CloudRow> {
  const data: Record<string, unknown> = { ...record };
  if (table === 'photos') {
    data.hasThumb = Boolean(data.thumb);
    delete data.blob;
    delete data.thumb;
  }
  if (table === 'intervalSeries') {
    const days = await db.intervalDays.where('seriesId').equals(record.id).toArray();
    data.days = days.map((d) => ({ date: d.date, values: d.values }));
  }
  return {
    owner,
    table_name: table,
    id: record.id,
    project_id: (table === 'projects' ? record.id : record.projectId) ?? '',
    data,
    updated_at: record.updatedAt,
    deleted_at: record.deletedAt ?? null,
  };
}

/** Sube los registros que cambiaron desde la última subida; las fotos nuevas, antes que sus registros. */
async function push(db: PontiaDb, client: CloudClient, session: CloudSession, state: SyncState, report: SyncReport, progress?: SyncProgress): Promise<void> {
  // Lo que cambie mientras se sube tiene fecha posterior y entra en la próxima sincronización
  const startedAt = Date.now();
  const rows: CloudRow[] = [];
  for (const table of SYNC_TABLES) {
    const changed = await tableOf(db, table)
      .filter((r) => r.updatedAt > state.lastPushedAt)
      .toArray();
    for (const record of changed) {
      if (table === 'photos' && !record.deletedAt && record.createdAt > state.lastPushedAt) {
        progress?.(`Subiendo fotos · ${report.photosUp + 1}`);
        const photo = record as unknown as Photo;
        await client.uploadPhoto(session, photoPath(session.userId, photo), photo.blob);
        if (photo.thumb) await client.uploadPhoto(session, photoPath(session.userId, photo, true), photo.thumb);
        report.photosUp += 1;
      }
      rows.push(await toRow(db, table, record, session.userId));
    }
  }
  for (let i = 0; i < rows.length; i += CHUNK) {
    progress?.(`Subiendo cambios · ${Math.min(i + CHUNK, rows.length)} de ${rows.length}`);
    await client.upsert(session, rows.slice(i, i + CHUNK));
  }
  report.pushed += rows.length;
  state.lastPushedAt = startedAt;
}

/** Aplica un cambio de la nube si es más reciente que el de este equipo. */
async function applyRow(db: PontiaDb, client: CloudClient, session: CloudSession, row: CloudRow, report: SyncReport): Promise<void> {
  // Una tabla que esta versión no conoce (la creó una versión más nueva de PONTIA) se deja para después
  if (!isSyncTable(row.table_name)) return;
  const table = tableOf(db, row.table_name);
  const local = await table.get(row.id);
  if (local && local.updatedAt >= row.updated_at) {
    report.skipped += 1;
    return;
  }
  const incoming: AnyRecord = { ...row.data, id: row.id, updatedAt: row.updated_at } as AnyRecord;
  if (row.deleted_at) incoming.deletedAt = row.deleted_at;
  else delete incoming.deletedAt;

  if (row.table_name === 'photos') {
    const hasThumb = Boolean(incoming.hasThumb);
    delete incoming.hasThumb;
    const photo = incoming as unknown as Photo;
    if (local) {
      // Cambió la descripción o la marca de borrado: el binario ya está aquí
      photo.blob = (local as unknown as Photo).blob;
      photo.thumb = (local as unknown as Photo).thumb;
    } else if (row.deleted_at) {
      // Una foto eliminada que nunca llegó a este equipo no hace falta descargarla
      report.skipped += 1;
      return;
    } else {
      photo.blob = await client.downloadPhoto(session, photoPath(session.userId, photo));
      if (hasThumb) photo.thumb = await client.downloadPhoto(session, photoPath(session.userId, photo, true));
      report.photosDown += 1;
    }
    await db.photos.put(photo);
  } else if (row.table_name === 'intervalSeries') {
    const days = (incoming.days as { date: string; values: number[] }[] | undefined) ?? [];
    delete incoming.days;
    const projectId = String(incoming.projectId ?? row.project_id);
    await db.transaction('rw', [db.intervalSeries, db.intervalDays], async () => {
      await table.put(incoming);
      await db.intervalDays.where('seriesId').equals(row.id).delete();
      await db.intervalDays.bulkPut(days.map((d): IntervalDay => ({ seriesId: row.id, projectId, date: d.date, values: d.values })));
    });
  } else {
    await table.put(incoming);
  }
  report.pulled += 1;
}

/** Baja los cambios de la nube por páginas, en el orden en que llegaron al servidor. */
async function pull(db: PontiaDb, client: CloudClient, session: CloudSession, state: SyncState, report: SyncReport, progress?: SyncProgress): Promise<void> {
  for (;;) {
    progress?.(`Recibiendo cambios · ${report.pulled + report.skipped}`);
    const rows = await client.pull(session, state.lastSeq, PAGE);
    for (const row of rows) {
      await applyRow(db, client, session, row, report);
      state.lastSeq = Math.max(state.lastSeq, row.server_seq ?? state.lastSeq);
    }
    if (rows.length < PAGE) break;
  }
}

/**
 * Sincroniza este equipo con la nube: primero sube (la nube conserva la versión más reciente de cada
 * registro) y luego baja lo que llegó de los demás equipos.
 */
export async function synchronize(db: PontiaDb, client: CloudClient, session: CloudSession, state: SyncState, progress?: SyncProgress): Promise<SyncReport> {
  const report: SyncReport = { pushed: 0, pulled: 0, photosUp: 0, photosDown: 0, skipped: 0 };
  await push(db, client, session, state, report, progress);
  await pull(db, client, session, state, report, progress);
  return report;
}
