import type { Table } from 'dexie';
import JSZip from 'jszip';
import type { IntervalDay, Photo, Project } from '@/domain/types';
import type { PontiaDb } from './schema';

/** Respaldo de un proyecto en un .zip: sirve para guardar copias y para pasar el proyecto del celular al PC. */
export const BACKUP_FORMAT = 'pontia-respaldo';
export const BACKUP_VERSION = 1;

/** Tablas con registros del proyecto; las fotos y los días de las series se guardan aparte. */
const TABLES = ['areas', 'equipment', 'electrical', 'measurements', 'meterReadings', 'intervalSeries', 'bills', 'findings', 'measures', 'pgee', 'tasks'] as const;
type TableName = (typeof TABLES)[number];
type StoredRecord = Record<string, unknown>;

interface PhotoEntry extends Omit<Photo, 'blob' | 'thumb'> {
  file: string;
  thumbFile?: string;
}

interface BackupManifest {
  format: typeof BACKUP_FORMAT;
  version: number;
  exportedAt: string;
  project: Project;
  tables: Partial<Record<TableName, StoredRecord[]>>;
  intervalDays: IntervalDay[];
  photos: PhotoEntry[];
}

export interface OpenedBackup {
  manifest: BackupManifest;
  zip: JSZip;
}

const EXTENSION: Record<string, string> = { 'image/png': 'png', 'image/webp': 'webp' };
const MIME: Record<string, string> = { png: 'image/png', webp: 'image/webp' };
const mimeOf = (path: string) => MIME[path.slice(path.lastIndexOf('.') + 1).toLowerCase()] ?? 'image/jpeg';

/** Nombre del archivo, p. ej. PONTIA_BL-06_2026-09-11.zip */
export function backupFileName(project: Pick<Project, 'name' | 'code'>, date = new Date()): string {
  const base =
    (project.code || project.name)
      .normalize('NFD')
      .replace(/\p{M}/gu, '')
      .replace(/[^A-Za-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'proyecto';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `PONTIA_${base}_${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}.zip`;
}

export async function exportProjectZip(db: PontiaDb, projectId: string, now = new Date()): Promise<Blob> {
  const project = await db.projects.get(projectId);
  if (!project) throw new Error('El proyecto no existe en este equipo.');
  const zip = new JSZip();
  const tables: Partial<Record<TableName, StoredRecord[]>> = {};
  for (const name of TABLES) tables[name] = await db.table(name).where('projectId').equals(projectId).toArray();
  const intervalDays = await db.intervalDays.where('projectId').equals(projectId).toArray();
  const photos: PhotoEntry[] = [];
  for (const { blob, thumb, ...meta } of await db.photos.where('projectId').equals(projectId).toArray()) {
    const file = `fotos/${meta.id}.${EXTENSION[blob.type] ?? 'jpg'}`;
    // Las fotos ya están comprimidas: se guardan tal cual
    zip.file(file, await blob.arrayBuffer(), { binary: true, compression: 'STORE' });
    let thumbFile: string | undefined;
    if (thumb) {
      thumbFile = `miniaturas/${meta.id}.jpg`;
      zip.file(thumbFile, await thumb.arrayBuffer(), { binary: true, compression: 'STORE' });
    }
    photos.push({ ...meta, file, thumbFile });
  }
  const manifest: BackupManifest = { format: BACKUP_FORMAT, version: BACKUP_VERSION, exportedAt: now.toISOString(), project, tables, intervalDays, photos };
  zip.file('proyecto.json', JSON.stringify(manifest, null, 1));
  const bytes = await zip.generateAsync({ type: 'arraybuffer', compression: 'DEFLATE', compressionOptions: { level: 6 } });
  return new Blob([bytes], { type: 'application/zip' });
}

/** Lee y valida un respaldo sin tocar la base local. */
export async function openBackup(file: Blob | ArrayBuffer): Promise<OpenedBackup> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(file instanceof ArrayBuffer ? file : await file.arrayBuffer());
  } catch {
    throw new Error('El archivo no es un .zip válido.');
  }
  const text = await zip.file('proyecto.json')?.async('string');
  let manifest: BackupManifest | undefined;
  try {
    manifest = text ? (JSON.parse(text) as BackupManifest) : undefined;
  } catch {
    manifest = undefined;
  }
  if (!manifest || manifest.format !== BACKUP_FORMAT || !manifest.project?.id) throw new Error('El archivo no es un respaldo de PONTIA.');
  if (manifest.version > BACKUP_VERSION) throw new Error('El respaldo se hizo con una versión más nueva de PONTIA. Actualiza la app e inténtalo de nuevo.');
  return { manifest, zip };
}

export interface BackupInfo {
  name: string;
  code?: string;
  exportedAt: string;
  counts: { areas: number; equipment: number; bills: number; photos: number };
  /** Proyecto con el mismo identificador que ya está en este equipo. */
  existing?: Project;
}

export async function describeBackup(db: PontiaDb, { manifest }: OpenedBackup): Promise<BackupInfo> {
  const active = (rows: { deletedAt?: unknown }[] = []) => rows.filter((r) => !r.deletedAt).length;
  return {
    name: manifest.project.name,
    code: manifest.project.code,
    exportedAt: manifest.exportedAt,
    counts: {
      areas: active(manifest.tables.areas),
      equipment: active(manifest.tables.equipment),
      bills: active(manifest.tables.bills),
      photos: active(manifest.photos),
    },
    existing: await db.projects.get(manifest.project.id),
  };
}

/**
 * `auto` conserva los identificadores si el proyecto no está en este equipo (así se mueve del celular al PC)
 * y crea una copia si ya está; `reemplazar` cambia la versión local por la del respaldo.
 */
export type RestoreMode = 'auto' | 'reemplazar' | 'copia';

export interface RestoreResult {
  project: Project;
  outcome: 'nuevo' | 'reemplazado' | 'copia';
}

/** Campos que guardan identificadores de otros registros del proyecto. */
const REFERENCE_FIELDS = ['id', 'projectId', 'areaId', 'panelId', 'parentId', 'pointId', 'measureId', 'entityId', 'seriesId', 'clientLogoPhotoId'];

export async function restoreBackup(
  db: PontiaDb,
  { manifest, zip }: OpenedBackup,
  mode: RestoreMode = 'auto',
  newId: () => string = () => crypto.randomUUID(),
): Promise<RestoreResult> {
  const sourceId = manifest.project.id;
  const exists = (await db.projects.get(sourceId)) !== undefined;
  const outcome: RestoreResult['outcome'] = !exists ? 'nuevo' : mode === 'reemplazar' ? 'reemplazado' : 'copia';

  // En una copia cada identificador cambia, pero los vínculos entre registros se conservan
  const ids = new Map<string, string>();
  const map = (id: string) => {
    let next = ids.get(id);
    if (!next) {
      next = newId();
      ids.set(id, next);
    }
    return next;
  };
  const remap = <T extends object>(record: T): T => {
    if (outcome !== 'copia') return record;
    const out = { ...record } as Record<string, unknown>;
    for (const field of REFERENCE_FIELDS) if (typeof out[field] === 'string') out[field] = map(out[field] as string);
    if (Array.isArray(out.findingIds)) out.findingIds = out.findingIds.map((id: unknown) => (typeof id === 'string' ? map(id) : id));
    return out as T;
  };

  const project = remap({ ...manifest.project, updatedAt: Date.now() });
  delete project.deletedAt;
  if (outcome === 'copia') project.name = `${project.name} (copia)`;

  const photos: Photo[] = [];
  for (const { file, thumbFile, ...meta } of manifest.photos ?? []) {
    const data = await zip.file(file)?.async('arraybuffer');
    if (!data) continue;
    const thumbData = thumbFile ? await zip.file(thumbFile)?.async('arraybuffer') : undefined;
    photos.push(
      remap({
        ...meta,
        blob: new Blob([data], { type: mimeOf(file) }),
        thumb: thumbData ? new Blob([thumbData], { type: 'image/jpeg' }) : undefined,
      }),
    );
  }

  const tables: Table[] = TABLES.map((name) => db.table(name));
  const everything: Table[] = [...tables, db.intervalDays as Table, db.photos as Table];
  await db.transaction('rw', [db.projects, ...everything], async () => {
    if (outcome === 'reemplazado') {
      for (const table of everything) await table.where('projectId').equals(sourceId).delete();
    }
    await db.projects.put(project);
    for (const name of TABLES) await db.table(name).bulkPut((manifest.tables[name] ?? []).map(remap));
    await db.intervalDays.bulkPut((manifest.intervalDays ?? []).map(remap));
    await db.photos.bulkPut(photos);
  });
  return { project, outcome };
}
