/** Fechas locales en los formatos que usan los formularios y los textos de la app (sin desfase por zona horaria). */

const pad = (n: number) => String(n).padStart(2, '0');

export const MONTHS_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
export const MONTHS_LONG = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

/** AAAA-MM-DD */
export const toLocalDate = (date = new Date()): string => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

/** AAAA-MM-DDTHH:mm, el formato de los campos «datetime-local». */
export const toLocalDateTime = (date = new Date()): string => `${toLocalDate(date)}T${pad(date.getHours())}:${pad(date.getMinutes())}`;

/** AAAA-MM */
export const toPeriod = (date = new Date()): string => `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;

/** Lee AAAA-MM, AAAA-MM-DD o AAAA-MM-DDTHH:mm como fecha local. */
export function parseLocal(text: string | undefined): Date | null {
  const m = /^(\d{4})-(\d{2})(?:-(\d{2}))?(?:T(\d{2}):(\d{2}))?/.exec(text ?? '');
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, m[3] ? Number(m[3]) : 1, m[4] ? Number(m[4]) : 0, m[5] ? Number(m[5]) : 0);
}

export function nextPeriod(period: string, months = 1): string {
  const [year, month] = period.split('-').map(Number);
  return toPeriod(new Date(year, month - 1 + months, 1));
}

/** Meses sin factura entre el primer y el último periodo registrados. */
export function missingPeriods(periods: readonly string[]): string[] {
  const sorted = [...new Set(periods)].sort();
  const missing: string[] = [];
  for (let i = 1; i < sorted.length; i++) {
    let period = nextPeriod(sorted[i - 1]);
    for (let guard = 0; period < sorted[i] && guard < 600; guard++) {
      missing.push(period);
      period = nextPeriod(period);
    }
  }
  return missing;
}

/** Días entre dos fechas AAAA-MM-DD; `null` si faltan o están al revés. */
export function daysBetween(start: string | undefined, end: string | undefined): number | null {
  const a = parseLocal(start);
  const b = parseLocal(end);
  if (!a || !b) return null;
  const days = Math.round((b.getTime() - a.getTime()) / 86_400_000);
  return days > 0 ? days : null;
}

/** «sep 2026» */
export function periodLabel(period: string): string {
  const [year, month] = period.split('-');
  return `${MONTHS_SHORT[Number(month) - 1] ?? month} ${year}`;
}

/** «septiembre de 2026» */
export function periodLabelLong(period: string): string {
  const [year, month] = period.split('-');
  return `${MONTHS_LONG[Number(month) - 1] ?? month} de ${year}`;
}

/** «8 sep 2026» */
export function formatDate(text: string | undefined): string {
  const date = parseLocal(text);
  return date ? `${date.getDate()} ${MONTHS_SHORT[date.getMonth()]} ${date.getFullYear()}` : '—';
}

/** «8 sep 2026 · 10:30» */
export function formatDateTime(text: string | undefined): string {
  const date = parseLocal(text);
  return date ? `${formatDate(text)} · ${pad(date.getHours())}:${pad(date.getMinutes())}` : '—';
}
