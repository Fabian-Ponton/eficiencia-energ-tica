import { describe, expect, it } from 'vitest';
import { daysBetween, formatDateTime, missingPeriods, nextPeriod, periodLabel, periodLabelLong, toLocalDateTime } from '@/utils/dates';
import { fittedSize } from '@/utils/image';

describe('fechas y periodos', () => {
  it('avanza periodos y encuentra meses sin factura', () => {
    expect(nextPeriod('2025-12')).toBe('2026-01');
    expect(nextPeriod('2026-01', -1)).toBe('2025-12');
    expect(missingPeriods(['2025-01', '2025-04', '2025-02'])).toEqual(['2025-03']);
    expect(missingPeriods(['2025-01'])).toEqual([]);
  });

  it('cuenta días y muestra fechas en español', () => {
    expect(daysBetween('2026-08-15', '2026-09-14')).toBe(30);
    expect(daysBetween('2026-09-14', '2026-08-15')).toBeNull();
    expect(daysBetween(undefined, '2026-08-15')).toBeNull();
    expect(periodLabel('2026-09')).toBe('sep 2026');
    expect(periodLabelLong('2026-09')).toBe('septiembre de 2026');
    expect(formatDateTime('2026-09-08T10:30')).toBe('8 sep 2026 · 10:30');
    expect(toLocalDateTime(new Date(2026, 8, 8, 7, 5))).toBe('2026-09-08T07:05');
  });
});

describe('tamaño de las fotos', () => {
  it('reduce el lado mayor sin deformar ni agrandar', () => {
    expect(fittedSize(4000, 3000, 1600)).toEqual({ width: 1600, height: 1200 });
    expect(fittedSize(3000, 4000, 1600)).toEqual({ width: 1200, height: 1600 });
    expect(fittedSize(800, 600, 1600)).toEqual({ width: 800, height: 600 });
  });
});
