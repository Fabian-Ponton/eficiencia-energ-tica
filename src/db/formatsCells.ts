/**
 * Lectura tolerante de las celdas de los formatos de Excel. El auditor los llena a mano, con lo que cada técnico escribe:
 * «1.500», «1,5 kW», «7:00 a. m.», «15/03/2026», «sep-2026», «N/D». Aquí se entiende todo eso, y lo que no se entiende
 * se devuelve como «sin valor» para que quien lo llame avise en vez de inventar un dato.
 */

/** Valor de una celda de ExcelJS reducido a lo que importa. */
export type CellValue = string | number | boolean | Date | undefined;

const MONTHS: Record<string, number> = {
  ene: 1, enero: 1, feb: 2, febrero: 2, mar: 3, marzo: 3, abr: 4, abril: 4, may: 5, mayo: 5, jun: 6, junio: 6,
  jul: 7, julio: 7, ago: 8, agosto: 8, sep: 9, sept: 9, septiembre: 9, set: 9, oct: 10, octubre: 10, nov: 11, noviembre: 11, dic: 12, diciembre: 12,
};

/** Reduce el valor que entrega ExcelJS (texto enriquecido, fórmula con resultado, hipervínculo) a un valor simple. */
export function plainCell(value: unknown): CellValue {
  if (value === null || value === undefined) return undefined;
  if (typeof value === 'string') return value.trim() === '' ? undefined : value.trim();
  if (typeof value === 'number' || typeof value === 'boolean' || value instanceof Date) return value;
  if (typeof value === 'object') {
    const v = value as { richText?: { text: string }[]; result?: unknown; text?: unknown; error?: unknown };
    if (v.error !== undefined) return undefined;
    if (Array.isArray(v.richText)) return plainCell(v.richText.map((part) => part.text).join(''));
    if (v.result !== undefined) return plainCell(v.result);
    if (v.text !== undefined) return plainCell(v.text);
  }
  return undefined;
}

/** «N/D»: el dato no está disponible. En los formatos se escribe así en vez de dejar la celda en blanco. */
export const isND = (value: unknown): boolean => typeof value === 'string' && /^\s*n\s*\/\s*d\s*$/i.test(value);

/** Texto comparable: sin tildes, en minúsculas y con los espacios normalizados. */
export const norm = (text: unknown): string =>
  String(text ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

/** Encabezado sin la unidad entre paréntesis: «Potencia (W/kW)» y «potencia» son el mismo. */
export const normHeader = (text: unknown): string => norm(String(text ?? '').replace(/\([^)]*\)/g, ' '));

/** Texto de la celda, sin «N/D» ni vacíos. */
export function cellText(value: CellValue): string | undefined {
  if (value === undefined || isND(value)) return undefined;
  if (value instanceof Date) return undefined;
  const text = String(value).trim();
  return text === '' ? undefined : text;
}

/** Número de una celda: acepta «1.234,5» (es-CO), «1,234.5», «$ 850», «12,5». `undefined` si no es un número. */
export function parseNumber(value: CellValue): number | undefined {
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  if (typeof value !== 'string' || isND(value)) return undefined;
  let text = value.replace(/[\s$]/g, '').replace(/^\+/, '');
  if (!/^-?[\d.,]+$/.test(text) || !/\d/.test(text)) return undefined;
  const lastDot = text.lastIndexOf('.');
  const lastComma = text.lastIndexOf(',');
  if (lastDot >= 0 && lastComma >= 0) {
    // Lo que aparece al final es el decimal; el otro signo agrupa miles
    text = lastComma > lastDot ? text.replace(/\./g, '').replace(',', '.') : text.replace(/,/g, '');
  } else if (lastComma >= 0) {
    text = /^-?\d{1,3}(,\d{3})+$/.test(text) ? text.replace(/,/g, '') : text.replace(',', '.');
  } else if (lastDot >= 0 && /^-?\d{1,3}(\.\d{3})+$/.test(text)) {
    text = text.replace(/\./g, '');
  }
  const number = Number(text);
  return Number.isFinite(number) ? number : undefined;
}

export interface PowerReading {
  /** Potencia en kW. */
  kw?: number;
  /** El valor viene sin unidad, o no es un número. */
  problem?: 'sin-unidad' | 'no-numero';
  /** Lo que se leyó, para poder avisar. */
  raw?: string;
}

const POWER_UNITS: Record<string, number> = { kw: 1, kilovatio: 1, kilovatios: 1, kilowatt: 1, kilowatts: 1, w: 0.001, watt: 0.001, watts: 0.001, vatio: 0.001, vatios: 0.001, hp: 0.746, cv: 0.7355 };

/**
 * Potencia de una celda. La guía de los formatos exige anotar siempre la unidad («1500 W», «1,5 kW», «2 HP»): un número
 * suelto solo se acepta si el encabezado ya la fija (`unitOfHeader`, p. ej. «Potencia/unidad (W)»).
 */
export function parsePower(value: CellValue, unitOfHeader?: 'W' | 'kW'): PowerReading {
  if (value === undefined || isND(value) || value instanceof Date || typeof value === 'boolean') return {};
  // Se redondea a la milésima de vatio para que 36 W sean 0,036 kW y no 0,036000000000000004
  const withUnit = (number: number, factor: number): PowerReading => ({ kw: Math.round(number * factor * 1e6) / 1e6 });
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return { problem: 'no-numero', raw: String(value) };
    return unitOfHeader ? withUnit(value, POWER_UNITS[unitOfHeader.toLowerCase()]) : { problem: 'sin-unidad', raw: String(value) };
  }
  const match = /^\s*(-?[\d.,\s]+?)\s*([a-zA-Z]+)?\s*$/.exec(value);
  if (!match) return { problem: 'no-numero', raw: value };
  const number = parseNumber(match[1].replace(/\s/g, ''));
  if (number === undefined) return { problem: 'no-numero', raw: value };
  const factor = match[2] ? POWER_UNITS[match[2].toLowerCase()] : undefined;
  if (match[2] && factor === undefined) return { problem: 'no-numero', raw: value };
  if (factor !== undefined) return withUnit(number, factor);
  return unitOfHeader ? withUnit(number, POWER_UNITS[unitOfHeader.toLowerCase()]) : { problem: 'sin-unidad', raw: value };
}

const pad = (n: number) => String(n).padStart(2, '0');
const isoDate = (year: number, month: number, day: number): string | undefined => {
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day ? `${year}-${pad(month)}-${pad(day)}` : undefined;
};
/** Días desde el 30-dic-1899, que es el día cero de Excel. */
const fromSerial = (serial: number): Date => new Date(Math.round((serial - 25569) * 86_400_000));
const fullYear = (year: number) => (year < 100 ? 2000 + year : year);

/** Fecha AAAA-MM-DD de una celda de fecha, de un número de serie de Excel o de un texto («15/03/2026», «15 sep 2026»). */
export function parseDate(value: CellValue): string | undefined {
  if (value === undefined || isND(value) || typeof value === 'boolean') return undefined;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? undefined : isoDate(value.getUTCFullYear(), value.getUTCMonth() + 1, value.getUTCDate());
  if (typeof value === 'number') return value > 20_000 && value < 80_000 ? parseDate(fromSerial(value)) : undefined;
  let m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/.exec(value);
  if (m) return isoDate(Number(m[1]), Number(m[2]), Number(m[3]));
  // En Colombia la fecha se escribe día, mes y año
  m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})$/.exec(value);
  if (m) return isoDate(fullYear(Number(m[3])), Number(m[2]), Number(m[1]));
  m = /^(\d{1,2})\s*(?:de\s+)?([a-zA-Záéíóú]+)\.?\s*(?:de\s+)?(\d{2}|\d{4})$/.exec(value);
  const month = m ? MONTHS[norm(m[2])] : undefined;
  return m && month ? isoDate(fullYear(Number(m[3])), month, Number(m[1])) : undefined;
}

/** Hora HH:mm de una celda de hora, de una fracción de día o de un texto («7:00», «7:30 a. m.», «5 pm», «19h»). */
export function parseTime(value: CellValue): string | undefined {
  if (value === undefined || isND(value) || typeof value === 'boolean') return undefined;
  const fromMinutes = (minutes: number) => (minutes >= 0 && minutes < 1440 ? `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}` : undefined);
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? undefined : fromMinutes(value.getUTCHours() * 60 + value.getUTCMinutes());
  if (typeof value === 'number') {
    // Un entero es una hora («7» = 07:00); una fracción es el formato de hora de Excel (0,2917 = 07:00)
    return Number.isInteger(value) ? fromMinutes((value * 60) % 1440) : fromMinutes(Math.round((value - Math.floor(value)) * 1440));
  }
  const text = norm(value).replace(/\./g, '');
  const m = /^(\d{1,2})(?::(\d{2}))?(?::\d{2})?\s*(am|pm|a m|p m|h|hs|horas)?$/.exec(text);
  if (!m) return undefined;
  let hours = Number(m[1]);
  const minutes = m[2] ? Number(m[2]) : 0;
  if (minutes > 59 || hours > 24) return undefined;
  const meridiem = m[3]?.replace(' ', '');
  if (meridiem === 'pm' && hours < 12) hours += 12;
  if (meridiem === 'am' && hours === 12) hours = 0;
  return hours === 24 && minutes === 0 ? '00:00' : hours < 24 ? `${pad(hours)}:${pad(minutes)}` : undefined;
}

/** Periodo AAAA-MM de «sep-2026», «septiembre de 2026», «2026-09», «09/2026» o una fecha completa. */
export function parsePeriod(value: CellValue): string | undefined {
  if (value === undefined || isND(value) || typeof value === 'boolean') return undefined;
  if (value instanceof Date || typeof value === 'number') {
    const date = parseDate(value);
    return date?.slice(0, 7);
  }
  const text = norm(value);
  let m = /^(\d{4})[-/.](\d{1,2})(?:[-/.]\d{1,2})?$/.exec(text);
  if (m && Number(m[2]) >= 1 && Number(m[2]) <= 12) return `${m[1]}-${pad(Number(m[2]))}`;
  m = /^(\d{1,2})[-/.](\d{4})$/.exec(text);
  if (m && Number(m[1]) >= 1 && Number(m[1]) <= 12) return `${m[2]}-${pad(Number(m[1]))}`;
  m = /^(?:\d{1,2}[-/.])(\d{1,2})[-/.](\d{2}|\d{4})$/.exec(text);
  if (m && Number(m[1]) >= 1 && Number(m[1]) <= 12) return `${fullYear(Number(m[2]))}-${pad(Number(m[1]))}`;
  m = /^([a-z]+)\.?[\s-]*(?:de\s+)?(\d{2}|\d{4})$/.exec(text);
  const month = m ? MONTHS[m[1]] : undefined;
  return m && month ? `${fullYear(Number(m[2]))}-${pad(month)}` : undefined;
}

/** Sí o No de una celda: «Sí», «si», «x», «1»… `undefined` si no dice nada. */
export function parseYesNo(value: CellValue): boolean | undefined {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1 ? true : value === 0 ? false : undefined;
  const text = norm(value);
  if (['si', 's', 'x', 'yes', 'true', 'verdadero', '1'].includes(text)) return true;
  if (['no', 'n', 'false', 'falso', '0'].includes(text)) return false;
  return undefined;
}

export interface Option<T> {
  id: T;
  label: string;
  aliases?: readonly string[];
}

/** Opción cuyo nombre (o alias) coincide con el texto de la celda, sin distinguir tildes ni mayúsculas. */
export function matchOption<T>(value: CellValue, options: readonly Option<T>[]): T | undefined {
  const text = norm(cellText(value));
  if (!text) return undefined;
  return options.find((o) => norm(o.label) === text || norm(String(o.id)) === text || o.aliases?.some((a) => norm(a) === text))?.id;
}
