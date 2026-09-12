export type CsvFormat = 'es-CO' | 'estandar';

export interface CsvColumn<T> {
  header: string;
  value: (row: T) => string | number | null | undefined;
  /** Decimales fijos para columnas numéricas. */
  decimals?: number;
}

/**
 * Excel en Colombia espera punto y coma como separador y coma decimal; el BOM hace que
 * reconozca las tildes. El formato estándar sirve para otros programas.
 */
const FORMATS = {
  'es-CO': { separator: ';', decimal: ',', bom: '﻿' },
  estandar: { separator: ',', decimal: '.', bom: '' },
} as const;

/** Texto que una hoja de cálculo ejecutaría como fórmula (inyección CSV). */
const FORMULA_START = /^[=+\-@\t\r]/;

export function toCsv<T>(rows: readonly T[], columns: readonly CsvColumn<T>[], format: CsvFormat = 'es-CO'): string {
  const { separator, decimal, bom } = FORMATS[format];
  const cell = (raw: string | number | null | undefined, decimals?: number): string => {
    if (raw === null || raw === undefined) return '';
    let text: string;
    if (typeof raw === 'number') {
      if (!Number.isFinite(raw)) return '';
      text = (decimals === undefined ? String(raw) : raw.toFixed(decimals)).replace('.', decimal);
    } else {
      text = FORMULA_START.test(raw) ? `'${raw}` : raw;
    }
    return text.includes(separator) || /["\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const lines = [
    columns.map((c) => cell(c.header)),
    ...rows.map((row) => columns.map((c) => cell(c.value(row), c.decimals))),
  ];
  return bom + lines.map((line) => line.join(separator)).join('\r\n') + '\r\n';
}
