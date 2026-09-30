import { describe, expect, it } from 'vitest';
import { frequencyMonths, maintenanceStatus, nextDue } from '@/domain/maintenance';

describe('mantenimiento de equipos (Formato 9)', () => {
  it('entiende la frecuencia escrita', () => {
    expect(frequencyMonths('semestral')).toBe(6);
    expect(frequencyMonths('Anual')).toBe(12);
    expect(frequencyMonths('Trimestral')).toBe(3);
    expect(frequencyMonths('cada 4 meses')).toBe(4);
    expect(frequencyMonths('según uso')).toBeNull();
    expect(frequencyMonths('cuando se dañe')).toBeNull();
    expect(frequencyMonths(undefined)).toBeNull();
  });

  it('calcula el próximo mantenimiento y conserva el último día del mes', () => {
    expect(nextDue({ lastAt: '2026-03-15', frequency: 'semestral' })).toBe('2026-09-15');
    expect(nextDue({ lastAt: '2026-08-31', frequency: 'mensual' })).toBe('2026-09-30');
    expect(nextDue({ lastAt: '2026-03-15', frequency: 'según uso' })).toBeUndefined();
    expect(nextDue({ frequency: 'anual' })).toBeUndefined();
  });

  it('dice si está al día, próximo, atrasado, sin plan o sin registro', () => {
    const hoy = '2026-09-29';
    expect(maintenanceStatus({ type: 'preventivo', lastAt: '2026-08-01', frequency: 'anual' }, hoy)).toBe('al-dia');
    expect(maintenanceStatus({ type: 'preventivo', lastAt: '2025-10-15', frequency: 'anual' }, hoy)).toBe('proximo');
    expect(maintenanceStatus({ type: 'preventivo', lastAt: '2025-09-29', frequency: 'anual' }, hoy)).toBe('proximo');
    expect(maintenanceStatus({ type: 'preventivo', lastAt: '2025-01-10', frequency: 'anual' }, hoy)).toBe('atrasado');
    expect(maintenanceStatus({ type: 'correctivo', lastAt: '2026-05-01' }, hoy)).toBe('sin-plan');
    expect(maintenanceStatus({ type: 'ninguno' }, hoy)).toBe('sin-registro');
    expect(maintenanceStatus({ type: 'preventivo', frequency: 'anual' }, hoy)).toBe('sin-registro');
  });
});
