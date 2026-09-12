import Papa from 'papaparse';
import { parseDecimal, type DateOrder, type IntervalCsvMapping, type ValueKind, type ValueUnit } from './intervalCsv';

const DATE_LIKE = /^\s*\d{1,4}[/.-]\d{1,2}[/.-]\d{1,4}/;
const TIME_LIKE = /^\s*\d{1,2}:\d{2}(:\d{2})?\s*([ap]\.?\s*m\.?)?\s*$/i;
const NUMBER_LIKE = /^\s*-?[\d.,]+\s*$/;

/** Primeras líneas del archivo en celdas, alineadas con las líneas reales (para saltar encabezados). */
export function previewRows(text: string, delimiter = '', max = 40): { rows: string[][]; delimiter: string } {
  const sample = text.replace(/^﻿/, '').split(/\r?\n/).slice(0, max).join('\n');
  const result = Papa.parse<string[]>(sample, { delimiter, skipEmptyLines: false });
  return { rows: result.data, delimiter: result.meta.delimiter };
}

/** Coma o punto decimal según los números sin ambigüedad del archivo («48,9», «1.234,5», «48.9»). */
export function detectDecimal(rows: readonly (readonly string[])[]): ',' | '.' {
  let comma = 0;
  let dot = 0;
  for (const row of rows) {
    for (const cell of row) {
      const t = cell.trim();
      if (!NUMBER_LIKE.test(t) || DATE_LIKE.test(t)) continue;
      if (/^-?\d+,\d+$/.test(t)) {
        if (!/^-?\d{1,3},\d{3}$/.test(t)) comma++;
      } else if (/^-?\d{1,3}(\.\d{3})+,\d+$/.test(t)) comma++;
      else if (/^-?\d+\.\d+$/.test(t)) {
        if (!/^-?\d{1,3}\.\d{3}$/.test(t)) dot++;
      } else if (/^-?\d{1,3}(,\d{3})+\.\d+$/.test(t)) dot++;
    }
  }
  return comma > dot ? ',' : '.';
}

function detectDateOrder(stamps: readonly string[]): DateOrder {
  for (const stamp of stamps) {
    const m = /^\s*(\d{1,4})[/.-](\d{1,2})[/.-](\d{1,4})/.exec(stamp ?? '');
    if (!m) continue;
    if (m[1].length === 4) return 'YMD';
    if (Number(m[1]) > 12) return 'DMY';
    if (Number(m[2]) > 12) return 'MDY';
  }
  return 'DMY';
}

/** Qué tan probable es que la columna sea la potencia o energía total, según su título. */
function headerScore(header: string): number {
  const t = header.toLowerCase();
  if (/p\s*total|potencia total|kw\s*total|total\s*kw|demanda/.test(t)) return 5;
  if (/kwh|energ/.test(t)) return 4;
  if (/\bkw\b|potencia|power|^p\b/.test(t)) return 3;
  if (/\bw\b|\bwh\b/.test(t)) return 2;
  return 0;
}

function kindFromHeader(header: string): { valueKind: ValueKind; unit: ValueUnit } {
  const t = header.toLowerCase();
  if (/acum|lectura|register|registro/.test(t) && /wh/.test(t)) return { valueKind: 'energia-acumulada', unit: /kwh/.test(t) ? 'kWh' : 'Wh' };
  if (/kwh/.test(t)) return { valueKind: 'energia-intervalo', unit: 'kWh' };
  if (/\bwh\b/.test(t)) return { valueKind: 'energia-intervalo', unit: 'Wh' };
  if ((/\bw\b|\(w\)/.test(t) || /watts?/.test(t)) && !/kw/.test(t)) return { valueKind: 'potencia', unit: 'W' };
  return { valueKind: 'potencia', unit: 'kW' };
}

export interface DetectedLayout {
  skipRows: number;
  hasHeader: boolean;
  /** Títulos de las columnas (o «Columna 1», «Columna 2»… si el archivo no tiene). */
  headers: string[];
  delimiter: string;
  decimal: ',' | '.';
  timestampColumn: number;
  timeColumn?: number;
  dateOrder: DateOrder;
  valueColumn: number;
  valueKind: ValueKind;
  unit: ValueUnit;
}

/**
 * Deduce cómo leer el archivo: filas de encabezado del equipo, títulos, columnas de fecha, hora y valor,
 * orden de la fecha y convención decimal. El auditor puede corregir cualquier dato después.
 */
export function detectLayout(text: string): DetectedLayout | null {
  const { rows, delimiter } = previewRows(text);
  const isData = (row: readonly string[]) =>
    row.some((c) => DATE_LIKE.test(c)) && row.some((c) => NUMBER_LIKE.test(c) && !DATE_LIKE.test(c) && !TIME_LIKE.test(c));
  const firstData = rows.findIndex(isData);
  if (firstData < 0) return null;
  const hasHeader = firstData > 0 && rows[firstData - 1].some((c) => c.trim() && !NUMBER_LIKE.test(c) && !DATE_LIKE.test(c));
  const skipRows = hasHeader ? firstData - 1 : firstData;
  const data = rows.slice(firstData).filter(isData);
  const width = Math.max(...data.map((r) => r.length));
  const headers = Array.from({ length: width }, (_, i) => (hasHeader ? rows[firstData - 1][i]?.trim() : '') || `Columna ${i + 1}`);

  const timestampColumn = data[0].findIndex((c) => DATE_LIKE.test(c));
  const next = data[0][timestampColumn + 1];
  const stampHasTime = /\d{1,2}:\d{2}/.test(data[0][timestampColumn]);
  const timeColumn = !stampHasTime && next !== undefined && TIME_LIKE.test(next) ? timestampColumn + 1 : undefined;
  const decimal = detectDecimal(data);

  // Columna de valor: la que el título señala como potencia o energía; si no, la primera numérica
  const numeric = headers
    .map((_, i) => i)
    .filter(
      (i) =>
        i !== timestampColumn &&
        i !== timeColumn &&
        data.every((r) => !r[i]?.trim() || (NUMBER_LIKE.test(r[i]) && parseDecimal(r[i], decimal) !== null)) &&
        data.some((r) => r[i]?.trim()),
    );
  const valueColumn = [...numeric].sort((a, b) => headerScore(headers[b]) - headerScore(headers[a]))[0];
  if (valueColumn === undefined) return null;
  return {
    skipRows,
    hasHeader,
    headers,
    delimiter,
    decimal,
    timestampColumn,
    timeColumn,
    dateOrder: detectDateOrder(data.map((r) => r[timestampColumn])),
    valueColumn,
    ...kindFromHeader(headers[valueColumn]),
  };
}

/** Configuración del importador a partir de lo detectado (con las columnas por posición). */
export const layoutToMapping = (layout: DetectedLayout): IntervalCsvMapping => ({
  skipRows: layout.skipRows,
  hasHeader: layout.hasHeader,
  delimiter: layout.delimiter,
  decimal: layout.decimal,
  timestampColumn: layout.timestampColumn,
  timeColumn: layout.timeColumn,
  dateOrder: layout.dateOrder,
  valueColumn: layout.valueColumn,
  valueKind: layout.valueKind,
  unit: layout.unit,
});
