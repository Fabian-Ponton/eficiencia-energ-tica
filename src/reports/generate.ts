import { Packer } from 'docx';
import { renderChartPng } from '@/charts/echarts';
import { backupFileName } from '@/db/backup';
import type { PontiaDb } from '@/db/schema';
import { PHOTO_KINDS } from '@/domain/catalogs';
import type { Photo, Project } from '@/domain/types';
import { toLocalDate } from '@/utils/dates';
import { loadReportData } from './data';
import { buildAuditDocument, type AuditAssets, type AuditOptions } from './docx/audit';
import { buildImplementationDocument } from './docx/implementation';
import { buildPgeeDocument } from './docx/pgee';
import { auditFigures, type ReportFigure } from './figures';
import { implementationFigures } from './implementationFigures';
import { buildAuditModel } from './model';
import { pgeeFigures } from './pgeeFigures';

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

/** Dibuja cada figura en modo claro y la guarda como PNG para el documento. */
async function drawFigures(figures: readonly ReportFigure[], onProgress: Progress | undefined, total: number): Promise<AuditAssets['figures']> {
  const drawn: AuditAssets['figures'] = new Map();
  for (const [index, figure] of figures.entries()) {
    onProgress?.(`Dibujando «${figure.title}»`, index, total);
    await nextFrame();
    drawn.set(figure.id, { data: dataUrlBytes(await renderChartPng(figure.option, figure.width, figure.height)), width: figure.width, height: figure.height });
  }
  return drawn;
}

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
  const assets: AuditAssets = { figures: await drawFigures(figures, onProgress, total), photos: [] };

  const owners = new Map<string, string>([
    ...[...data.areas, ...data.equipment, ...data.electrical].map((r): [string, string] => [r.id, r.name]),
    ...data.findings.map((f): [string, string] => [f.id, f.title]),
    ...data.measures.map((x): [string, string] => [x.id, `${x.code} · ${x.title}`]),
    ...data.tasks.map((t): [string, string] => [t.id, t.name]),
  ]);
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

/** PGEE en Word: la revisión energética del proyecto, el plan con sus medidas y la matriz de priorización. */
export async function generatePgeeReport(db: PontiaDb, projectId: string, { onProgress }: { onProgress?: Progress } = {}): Promise<GeneratedFile> {
  onProgress?.('Leyendo el proyecto', 0, 1);
  const data = await loadReportData(db, projectId);
  const model = buildAuditModel(data);
  // Un PGEE por proyecto: si hubiera más de uno, el primero que se creó (el mismo que edita la pantalla)
  const pgee = (await db.pgee.where('projectId').equals(projectId).toArray()).filter((p) => !p.deletedAt).sort((a, b) => a.createdAt - b.createdAt)[0];
  const figures = pgeeFigures(data.measures.filter((x) => x.selected));
  const total = figures.length + 1;
  const drawn = await drawFigures(figures, onProgress, total);
  onProgress?.('Armando el documento', total - 1, total);
  await nextFrame();
  const blob = await Packer.toBlob(buildPgeeDocument(model, { pgee, measures: data.measures, findings: data.findings }, figures, { figures: drawn }));
  return { blob, fileName: reportFileName(data.project, 'PGEE', 'docx', data.generatedAt) };
}

/** Plan de implementación en Word: cronograma, presupuesto, flujo de caja, responsables y seguimiento. */
export async function generateImplementationReport(db: PontiaDb, projectId: string, { onProgress }: { onProgress?: Progress } = {}): Promise<GeneratedFile> {
  onProgress?.('Leyendo el proyecto', 0, 1);
  const data = await loadReportData(db, projectId);
  const model = buildAuditModel(data);
  const figures = implementationFigures(data.tasks, data.measures, data.project.economics, toLocalDate(data.generatedAt));
  const total = figures.length + 1;
  const drawn = await drawFigures(figures, onProgress, total);
  onProgress?.('Armando el documento', total - 1, total);
  await nextFrame();
  const blob = await Packer.toBlob(buildImplementationDocument(model, { tasks: data.tasks, measures: data.measures }, figures, { figures: drawn }));
  return { blob, fileName: reportFileName(data.project, 'Plan-implementacion', 'docx', data.generatedAt) };
}
