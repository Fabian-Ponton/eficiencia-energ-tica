import { describe, expect, it } from 'vitest';
import { areaUse, dailyUseHours, hoursBetween, minutesOf, parseDays, termsOf, useByArea } from '@/domain/occupancy';
import type { OccupancyRecord } from '@/domain/types';

const bloque = (extra: Partial<OccupancyRecord>): OccupancyRecord => ({
  id: crypto.randomUUID(),
  projectId: 'p',
  createdAt: 0,
  updatedAt: 0,
  areaId: 'lab-1',
  term: '2026-1',
  activity: 'Práctica',
  day: 'L-V',
  start: '07:00',
  end: '11:00',
  hours: 4,
  ...extra,
});

describe('horarios y ocupación (Formato 6)', () => {
  it('entiende los días sueltos, los grupos y los rangos', () => {
    expect(parseDays('L-V')).toEqual([0, 1, 2, 3, 4]);
    expect(parseDays('l-s')).toEqual([0, 1, 2, 3, 4, 5]);
    expect(parseDays('M')).toEqual([1]);
    expect(parseDays('L, X ,V')).toEqual([0, 2, 4]);
    expect(parseDays('S-L')).toEqual([]);
    expect(parseDays('lunes')).toEqual([]);
    expect(parseDays(undefined)).toEqual([]);
  });

  it('calcula las horas entre dos horas, también si cruzan la medianoche', () => {
    expect(hoursBetween('07:00', '11:00')).toBe(4);
    expect(hoursBetween('7:30', '9:00')).toBe(1.5);
    expect(hoursBetween('22:00', '02:00')).toBe(4);
    expect(hoursBetween('08:00', '08:00')).toBe(0);
    expect(hoursBetween('25:00', '08:00')).toBeNull();
    expect(hoursBetween('', '08:00')).toBeNull();
    expect(minutesOf('23:59')).toBe(1439);
    expect(minutesOf('12:60')).toBeNull();
  });

  it('suma las horas semanales de cada bloque por los días que cubre', () => {
    const registros = [
      bloque({ day: 'L-V', hours: 4, avgOccupants: 20, usesAc: true, usesLighting: true }),
      bloque({ day: 'S', hours: 3, avgOccupants: 10, usesLighting: true }),
      bloque({ day: 'M', start: '14:00', end: '16:00', hours: 2, avgOccupants: 30, usesAc: true }),
    ];
    const uso = areaUse(registros, 'lab-1');
    expect(uso.blocks).toBe(3);
    // 4 h × 5 días + 3 h × 1 día + 2 h × 1 día
    expect(uso.weeklyHours).toBe(25);
    expect(uso.acWeeklyHours).toBe(22);
    expect(uso.lightingWeeklyHours).toBe(23);
    // Ocupación ponderada por horas: (20×20 + 3×10 + 2×30) / 25
    expect(uso.avgOccupants).toBeCloseTo(19.6, 6);
    expect(dailyUseHours(uso, 5)).toBe(5);
    expect(dailyUseHours(uso, 0)).toBe(0);
  });

  it('separa por periodo y por espacio, e ignora lo eliminado', () => {
    const registros = [
      bloque({ term: '2026-1', hours: 4 }),
      bloque({ term: '2026-2', hours: 2, day: 'L' }),
      bloque({ areaId: 'lab-2', hours: 3 }),
      bloque({ hours: 8, deletedAt: 1 }),
    ];
    expect(areaUse(registros, 'lab-1', '2026-1').weeklyHours).toBe(20);
    expect(areaUse(registros, 'lab-1', '2026-2').weeklyHours).toBe(2);
    expect(areaUse(registros, 'lab-1').weeklyHours).toBe(22);
    expect(areaUse(registros, 'lab-1', '2026-1').avgOccupants).toBeNull();
    expect(termsOf(registros)).toEqual(['2026-2', '2026-1']);
    const porEspacio = useByArea(registros, '2026-1');
    expect([...porEspacio.keys()].sort()).toEqual(['lab-1', 'lab-2']);
    expect(porEspacio.get('lab-2')?.weeklyHours).toBe(15);
    expect(areaUse([], 'x')).toMatchObject({ blocks: 0, weeklyHours: 0, avgOccupants: null });
  });
});
