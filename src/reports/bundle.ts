import JSZip from 'jszip';
import { renderChartPng } from '@/charts/echarts';
import { toCsv, type CsvFormat } from './csv';
import type { ReportFigure } from './figures';
import type { Progress } from './generate';
import type { ExportTable } from './tables';

/** «03_espacios.csv»: el número conserva el orden de las tablas al abrir el .zip. */
const numbered = (index: number, name: string, extension: string) => `${String(index + 1).padStart(2, '0')}_${name}.${extension}`;

const nextFrame = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

async function toBlob(zip: JSZip): Promise<Blob> {
  const bytes = await zip.generateAsync({ type: 'arraybuffer', compression: 'DEFLATE', compressionOptions: { level: 6 } });
  return new Blob([bytes], { type: 'application/zip' });
}

/** Todas las tablas del proyecto en CSV, dentro de un .zip. */
export async function csvBundle(tables: readonly ExportTable[], format: CsvFormat): Promise<Blob> {
  const zip = new JSZip();
  tables.forEach((t, index) => zip.file(numbered(index, t.id, 'csv'), toCsv(t.rows as never[], t.columns, format)));
  return toBlob(zip);
}

/** Todas las gráficas del informe en PNG (modo claro), dentro de un .zip. */
export async function chartsBundle(figures: readonly ReportFigure[], onProgress?: Progress): Promise<Blob> {
  const zip = new JSZip();
  for (const [index, figure] of figures.entries()) {
    onProgress?.(`Dibujando «${figure.title}»`, index, figures.length);
    await nextFrame();
    const url = await renderChartPng(figure.option, figure.width, figure.height);
    zip.file(numbered(index, figure.id, 'png'), url.split(',')[1] ?? '', { base64: true, compression: 'STORE' });
  }
  return toBlob(zip);
}
