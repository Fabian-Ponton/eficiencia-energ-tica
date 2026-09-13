import type { Workbook } from 'exceljs';
import type { CsvColumn } from './csv';
import type { ExportTable } from './tables';

/** Formato de número de Excel según los decimales de la columna: Excel lo muestra con la configuración regional. */
const numberFormat = (decimals: number) => (decimals > 0 ? `#,##0.${'0'.repeat(decimals)}` : '#,##0');

/** Excel no acepta estos caracteres en el nombre de una hoja y lo corta en 31. */
const sheetName = (title: string) => title.replace(/[\\/?*[\]:]/g, ' ').slice(0, 31);

const cellValue = (value: string | number | null | undefined) => (typeof value === 'number' && !Number.isFinite(value) ? null : (value ?? null));

/**
 * Libro de Excel con una hoja por tabla: encabezado azul con filtro, fila de títulos fija,
 * anchos según el contenido y formato numérico por columna. ExcelJS se carga solo al exportar.
 */
export async function buildWorkbook(tables: readonly ExportTable[], meta: { title: string; created?: Date }): Promise<Blob> {
  const { default: ExcelJS } = await import('exceljs');
  const workbook: Workbook = new ExcelJS.Workbook();
  workbook.creator = 'PONTIA';
  workbook.title = meta.title;
  workbook.created = meta.created ?? new Date();

  for (const t of tables) {
    const columns = t.columns as unknown as CsvColumn<unknown>[];
    const sheet = workbook.addWorksheet(sheetName(t.title), { views: [{ state: 'frozen', ySplit: 1 }] });
    sheet.addRow(columns.map((c) => c.header));
    for (const row of t.rows) sheet.addRow(columns.map((c) => cellValue(c.value(row))));

    const header = sheet.getRow(1);
    header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF10234B' } };
    header.alignment = { vertical: 'middle', wrapText: true };
    header.height = 32;

    columns.forEach((c, index) => {
      const column = sheet.getColumn(index + 1);
      if (c.decimals !== undefined) column.numFmt = numberFormat(c.decimals);
      // Ancho: el mayor entre el título y los primeros 200 valores, entre 10 y 42 caracteres
      const longest = t.rows.slice(0, 200).reduce<number>((max, row) => Math.max(max, String(c.value(row) ?? '').length), 0);
      column.width = Math.min(42, Math.max(10, Math.ceil(c.header.length * 0.9) + 2, longest + 2));
    });
    sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columns.length } };
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}
