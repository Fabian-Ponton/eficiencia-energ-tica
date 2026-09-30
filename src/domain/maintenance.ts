import { addMonths, daysBetween, toLocalDate } from '@/utils/dates';
import type { MaintenanceRecord } from './types';

/** Mantenimiento y condición de los equipos (Formato 9). */

export const MAINTENANCE_TYPES: readonly { id: MaintenanceRecord['type']; label: string }[] = [
  { id: 'preventivo', label: 'Preventivo' },
  { id: 'correctivo', label: 'Correctivo' },
  { id: 'predictivo', label: 'Predictivo' },
  { id: 'ninguno', label: 'Sin mantenimiento registrado' },
];

export const FREQUENCIES: readonly { id: string; label: string; months: number | null }[] = [
  { id: 'mensual', label: 'Mensual', months: 1 },
  { id: 'trimestral', label: 'Trimestral', months: 3 },
  { id: 'semestral', label: 'Semestral', months: 6 },
  { id: 'anual', label: 'Anual', months: 12 },
  { id: 'segun-uso', label: 'Según uso', months: null },
  { id: 'sin-plan', label: 'Sin plan', months: null },
];

/** Meses entre mantenimientos según lo escrito: «semestral», «Anual», «cada 3 meses». `null` si no hay un plazo. */
export function frequencyMonths(text: string | undefined): number | null {
  const value = (text ?? '').trim().toLowerCase();
  if (!value) return null;
  const known = FREQUENCIES.find((f) => f.id === value || f.label.toLowerCase() === value);
  if (known) return known.months;
  const every = /cada\s+(\d+)\s+mes/.exec(value);
  return every ? Number(every[1]) : null;
}

export type MaintenanceStatus = 'al-dia' | 'proximo' | 'atrasado' | 'sin-plan' | 'sin-registro';

/** Días de aviso antes de que venza el mantenimiento. */
export const DUE_SOON_DAYS = 30;

/** Fecha del próximo mantenimiento (AAAA-MM-DD), si se conoce el último y la frecuencia. */
export function nextDue(record: Pick<MaintenanceRecord, 'lastAt' | 'frequency'>): string | undefined {
  const months = frequencyMonths(record.frequency);
  return record.lastAt && months ? addMonths(record.lastAt, months) : undefined;
}

export function maintenanceStatus(record: Pick<MaintenanceRecord, 'type' | 'lastAt' | 'frequency'>, today = toLocalDate()): MaintenanceStatus {
  if (!record.lastAt || record.type === 'ninguno') return 'sin-registro';
  const due = nextDue(record);
  if (!due) return 'sin-plan';
  if (due < today) return 'atrasado';
  // `daysBetween` devuelve null cuando la fecha es hoy mismo (cero días)
  const left = daysBetween(today, due);
  return left === null || left <= DUE_SOON_DAYS ? 'proximo' : 'al-dia';
}
