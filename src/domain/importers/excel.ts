import type { CellValue, Workbook } from 'exceljs';

const pad = (n: number) => String(n).padStart(2, '0');

/** Texto de una celda. Las fechas de Excel no tienen zona horaria: ExcelJS las entrega en UTC. */
function cellText(value: CellValue): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) {
    return `${value.getUTCFullYear()}-${pad(value.getUTCMonth() + 1)}-${pad(value.getUTCDate())} ${pad(value.getUTCHours())}:${pad(value.getUTCMinutes())}:${pad(value.getUTCSeconds())}`;
  }
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (typeof value === 'string') return value;
  if ('result' in value) return cellText((value.result ?? null) as CellValue);
  if ('richText' in value) return value.richText.map((part) => part.text).join('');
  if ('text' in value) return String(value.text);
  return '';
}

const quote = (text: string) => (/[;"\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text);

/**
 * Convierte la primera hoja de un .xlsx en texto separado por punto y coma, con punto decimal,
 * para leerlo con el mismo importador de los CSV.
 */
export async function excelToText(data: ArrayBuffer): Promise<{ text: string; sheet: string }> {
  const { default: ExcelJS } = await import('exceljs');
  const workbook: Workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(data as unknown as Parameters<Workbook['xlsx']['load']>[0]);
  const sheet = workbook.worksheets[0];
  if (!sheet) throw new Error('El archivo de Excel no tiene hojas.');
  const lines: string[] = [];
  sheet.eachRow({ includeEmpty: true }, (row) => {
    const cells: string[] = [];
    for (let c = 1; c <= row.cellCount; c++) cells.push(quote(cellText(row.getCell(c).value)));
    lines.push(cells.join(';'));
  });
  return { text: lines.join('\n'), sheet: sheet.name };
}
