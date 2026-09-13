import { Packer } from 'docx';
import { renderChartPng } from '@/charts/echarts';
import { backupFileName } from '@/db/backup';
import type { PontiaDb } from '@/db/schema';
import { PHOTO_KINDS } from '@/domain/catalogs';
import type { Photo, Project } from '@/domain/types';
import { loadReportData } from './data';
import { buildAuditDocument, type AuditAssets, type AuditOptions } from './docx/audit';
import { auditFigures } from './figures';
import { buildAuditModel } from './model';

/** Aviso de avance: qué se está haciendo y cuántos pasos van. */
export type Progress = (step: string, done: number, total: number) => void;

export interface GeneratedFile {
  blob: Blob;
  fileName: string;
}

/** «PONTIA_Informe-auditoria_BL-06_2026-09-12.docx»: el mismo estilo de nombre que el respaldo. */
export function reportFileName(project: Pick<Project, 'name' | 'code'>, label: string, extension: string, date = new Date()): string {
  return backupFileName(project, date).replace(/^PONTIA_/, `PONTIA_${label}_`).replace(/\.zip$/, `.${extension}`);
}

const dataUrlBytes = (url: string) => Uint8Array.from(atob(url.split(',')[1] ?? ''), (c) => c.charCodeAt(0));

/** Deja que el navegador pinte la barra de avance entre gráfica y gráfica. */
const nextFrame = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

/** Pie de foto: registro al que pertenece, tipo de foto, código y descripción. */
function photoCaption(photo: Photo, owners: ReadonlyMap<string, string>): string {
  const kind = PHOTO_KINDS.find((k) => k.id === photo.kind)?.label ?? 'Foto';
  return [photo.entityId ? owners.get(photo.entityId) : undefined, kind, photo.code, photo.caption].filter(Boolean).join(' · ');
}

export interface AuditReportOptions extends AuditOptions {
  includePhotos?: boolean;
  onProgress?: Progress;
}

/** Informe Word de auditoría: dibuja cada figura en modo claro, agrega las fotos y arma el .docx. */
export async function generateAuditReport(db: PontiaDb, projectId: string, { includePhotos = true, photoSize, onProgress }: AuditReportOptions = {}): Promise<GeneratedFile & { figures: number; photos: number }> {
  onProgress?.('Leyendo el proyecto', 0, 1);
  const data = await loadReportData(db, projectId);
  const model = buildAuditModel(data);
  const figures = auditFigures(model);
  const photos = includePhotos ? data.photos : [];
  const total = figures.length + photos.length + 1;
  const assets: AuditAssets = { figures: new Map(), photos: [] };

  for (const [index, figure] of figures.entries()) {
    onProgress?.(`Dibujando «${figure.title}»`, index, total);
    await nextFrame();
    assets.figures.set(figure.id, { data: dataUrlBytes(await renderChartPng(figure.option, figure.width, figure.height)), width: figure.width, height: figure.height });
  }

  const owners = new Map<string, string>([...data.areas, ...data.equipment, ...data.electrical].map((r) => [r.id, r.name]));
  for (const [index, photo] of photos.entries()) {
    onProgress?.('Agregando las fotos', figures.length + index, total);
    assets.photos.push({
      photo,
      data: new Uint8Array(await photo.blob.arrayBuffer()),
      width: photo.width ?? 1600,
      height: photo.height ?? 1200,
      type: photo.blob.type === 'image/png' ? 'png' : 'jpg',
      caption: photoCaption(photo, owners),
    });
  }

  onProgress?.('Armando el documento', total - 1, total);
  await nextFrame();
  const blob = await Packer.toBlob(buildAuditDocument(model, figures, assets, { photoSize }));
  return { blob, fileName: reportFileName(data.project, 'Informe-auditoria', 'docx', data.generatedAt), figures: figures.length, photos: assets.photos.length };
}
