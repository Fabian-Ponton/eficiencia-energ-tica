import Papa from 'papaparse';
import { isoDate, type IntervalReading } from '../calc/interval';
import { quantile } from '../calc/stats';

export type DateOrder = 'DMY' | 'MDY' | 'YMD';
export type ValueKind = 'potencia' | 'energia-intervalo' | 'energia-acumulada';
export type ValueUnit = 'W' | 'kW' | 'Wh' | 'kWh';

/** Cómo leer el archivo de un analizador de redes, data logger u operador de red. */
export interface IntervalCsvMapping {
  /** Líneas de encabezado del equipo que se saltan antes de los títulos de columna. */
  skipRows?: number;
  hasHeader?: boolean;
  /** Vacío o ausente para detectarlo automáticamente. */
  delimiter?: string;
  decimal: ',' | '.';
  /** Columna de fecha (o fecha y hora): índice desde 0 o título. */
  timestampColumn: number | string;
  /** Columna de hora, cuando la fecha y la hora vienen separadas. */
  timeColumn?: number | string;
  dateOrder: DateOrder;
  valueColumn: number | string;
  valueKind: ValueKind;
  unit: ValueUnit;
  /** Si no se indica, se deduce de las marcas de tiempo. */
  intervalMinutes?: number;
}

export interface IntervalCsvResult {
  readings: IntervalReading[];
  intervalMinutes: number;
  rowsRead: number;
  warnings: string[];
}

/** Número con la convención decimal del archivo; admite separadores de miles. */
export function parseDecimal(text: string, decimal: ',' | '.'): number | null {
  let t = text.trim().replace(/\s/g, '');
  if (!t) return null;
  t = decimal === ',' ? t.replace(/\./g, '').replace(',', '.') : t.replace(/,/g, '');
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/** Fecha y hora local en los formatos habituales de equipos y operadores (incluye «a. m.» y «PM»). */
export function parseTimestamp(text: string, order: DateOrder): Date | null {
  const t = text.trim();
  if (/^\d{4}-\d{2}-\d{2}T.*(Z|[+-]\d{2}:?\d{2})$/.test(t)) {
    const d = new Date(t);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const m = /^(\d{1,4})[/.-](\d{1,2})[/.-](\d{1,4})(?:[ T,]+(\d{1,2}):(\d{2})(?::(\d{2})(?:[.,]\d+)?)?\s*([ap])?\.?\s*m?\.?)?$/i.exec(t);
  if (!m) return null;
  const a = Number(m[1]);
  const b = Number(m[2]);
  const c = Number(m[3]);
  let [year, month, day] = order === 'YMD' || m[1].length === 4 ? [a, b, c] : order === 'DMY' ? [c, b, a] : [c, a, b];
  if (year < 100) year += 2000;
  let hour = Number(m[4] ?? 0);
  if (m[7]) {
    const pm = m[7].toLowerCase() === 'p';
    if (pm && hour < 12) hour += 12;
    if (!pm && hour === 12) hour = 0;
  }
  const d = new Date(year, month - 1, day, hour, Number(m[5] ?? 0), Number(m[6] ?? 0));
  return d.getMonth() === month - 1 && d.getDate() === day ? d : null;
}

export function parseIntervalCsv(text: string, mapping: IntervalCsvMapping): IntervalCsvResult {
  const energy = mapping.valueKind !== 'potencia';
  if (energy !== mapping.unit.endsWith('h')) {
    throw new Error(energy ? 'Para valores de energía usa Wh o kWh.' : 'Para valores de potencia usa W o kW.');
  }

  const body = text.replace(/^﻿/, '').split(/\r?\n/).slice(mapping.skipRows ?? 0).join('\n');
  const rows = Papa.parse<string[]>(body, { delimiter: mapping.delimiter ?? '', skipEmptyLines: 'greedy' }).data;
  const header = mapping.hasHeader === false ? null : (rows.shift() ?? null);
  const column = (ref: number | string): number =>
    typeof ref === 'number' ? ref : (header?.findIndex((h) => h.trim().toLowerCase() === ref.trim().toLowerCase()) ?? -1);
  const tsCol = column(mapping.timestampColumn);
  const timeCol = mapping.timeColumn === undefined ? -1 : column(mapping.timeColumn);
  const valueCol = column(mapping.valueColumn);
  if (tsCol < 0 || valueCol < 0 || (mapping.timeColumn !== undefined && timeCol < 0)) {
    throw new Error('No se encontraron las columnas de fecha o de valor indicadas.');
  }

  const samples: { start: Date; value: number }[] = [];
  let invalid = 0;
  for (const row of rows) {
    const stampText = timeCol >= 0 ? `${row[tsCol] ?? ''} ${row[timeCol] ?? ''}` : (row[tsCol] ?? '');
    const start = parseTimestamp(stampText, mapping.dateOrder);
    const value = parseDecimal(row[valueCol] ?? '', mapping.decimal);
    if (!start || value === null) invalid++;
    else samples.push({ start, value });
  }
  samples.sort((x, y) => x.start.getTime() - y.start.getTime());

  const steps = samples.slice(1).map((s, i) => (s.start.getTime() - samples[i].start.getTime()) / 60_000).filter((m) => m > 0);
  const intervalMinutes = mapping.intervalMinutes ?? (steps.length ? quantile(steps, 0.5) : NaN);
  if (!Number.isFinite(intervalMinutes) || intervalMinutes <= 0) {
    throw new Error('No se pudo deducir el intervalo de registro; indícalo manualmente.');
  }

  const toKilo = mapping.unit === 'W' || mapping.unit === 'Wh' ? 1 / 1000 : 1;
  const readings: IntervalReading[] = [];
  let rejected = 0;
  if (mapping.valueKind === 'energia-acumulada') {
    for (let i = 1; i < samples.length; i++) {
      const kwh = (samples[i].value - samples[i - 1].value) * toKilo;
      const hours = (samples[i].start.getTime() - samples[i - 1].start.getTime()) / 3_600_000;
      if (kwh < 0 || hours <= 0) rejected++;
      else readings.push({ start: samples[i - 1].start, kw: kwh / hours });
    }
  } else {
    const hours = intervalMinutes / 60;
    for (const s of samples) readings.push({ start: s.start, kw: energy ? (s.value * toKilo) / hours : s.value * toKilo });
  }

  const warnings: string[] = [];
  if (invalid) warnings.push(`${invalid} fila(s) sin fecha o valor válido se omitieron.`);
  if (rejected) warnings.push(`${rejected} lectura(s) acumulada(s) menores o repetidas se omitieron (posible cambio de medidor).`);
  const gaps = steps.filter((m) => m > intervalMinutes * 1.5).length;
  if (gaps) warnings.push(`Hay ${gaps} hueco(s) en los registros.`);
  return { readings, intervalMinutes, rowsRead: rows.length, warnings };
}

/** Agrupa los registros por día para guardarlos; los intervalos sin dato quedan como NaN. */
export function groupReadingsByDay(readings: readonly IntervalReading[], intervalMinutes: number): { date: string; values: number[] }[] {
  const slots = Math.round(1440 / intervalMinutes);
  const days = new Map<string, number[]>();
  for (const r of readings) {
    const date = isoDate(r.start);
    const values = days.get(date) ?? new Array<number>(slots).fill(Number.NaN);
    values[Math.floor((r.start.getHours() * 60 + r.start.getMinutes()) / intervalMinutes)] = r.kw;
    days.set(date, values);
  }
  return [...days].sort(([a], [b]) => a.localeCompare(b)).map(([date, values]) => ({ date, values }));
}

/** Reconstruye los registros de intervalos a partir de los días guardados, sin los huecos. */
export function expandDays(days: readonly { date: string; values: readonly number[] }[], intervalMinutes: number): IntervalReading[] {
  const readings: IntervalReading[] = [];
  for (const { date, values } of days) {
    const [y, m, d] = date.split('-').map(Number);
    values.forEach((kw, slot) => {
      if (Number.isFinite(kw)) readings.push({ start: new Date(y, m - 1, d, 0, slot * intervalMinutes), kw });
    });
  }
  return readings;
}
