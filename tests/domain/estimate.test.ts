import { describe, expect, it } from 'vitest';
import { dayFactors, estimatedProfiles, scheduleWeights } from '@/domain/estimate';
import type { Equipment } from '@/domain/types';

const equipo = (extra: Partial<Equipment> = {}): Equipment => ({
  id: 'e',
  projectId: 'p',
  createdAt: 0,
  updatedAt: 0,
  name: 'Luminaria',
  category: 'iluminacion',
  powerKw: 1,
  quantity: 2,
  hoursPerDay: 8,
  operatingDaysPerMonth: 22,
  useFactor: 0.5,
  condition: 'bueno',
  ...extra,
});

describe('curva estimada desde el inventario', () => {
  it('usa el horario marcado o un bloque desde las 7:00, con la hora parcial', () => {
    expect(scheduleWeights(equipo({ hoursPerDay: 2.5 })).slice(6, 11)).toEqual([0, 1, 1, 0.5, 0]);
    const marcado = Array.from({ length: 24 }, (_, h) => h === 3);
    expect(scheduleWeights(equipo({ activeHours: marcado }))[3]).toBe(1);
    expect(scheduleWeights(equipo({ activeHours: marcado }))[7]).toBe(0);
    expect(scheduleWeights(equipo({ hoursPerDay: 24 })).every((w) => w === 1)).toBe(true);
  });

  it('reparte los días de uso entre semana y fin de semana', () => {
    expect(dayFactors(22)).toEqual({ laborable: 1, finDeSemana: 0 });
    expect(dayFactors(30)).toEqual({ laborable: 1, finDeSemana: 1 });
    expect(dayFactors(11).laborable).toBeCloseTo(0.5, 9);
  });

  it('conserva la energía diaria y separa el fin de semana', () => {
    const nevera = equipo({ id: 'n', category: 'refrigeracion', hoursPerDay: 24, operatingDaysPerMonth: 30, powerKw: 0.2, quantity: 1, useFactor: 1 });
    const { laborable, finDeSemana, byCategory } = estimatedProfiles([equipo(), nevera]);
    const total = (values: number[]) => values.reduce((a, b) => a + b, 0);
    // 1 kW × 2 × 0,5 × 8 h = 8 kWh, más la nevera: 0,2 kW × 24 h = 4,8 kWh
    expect(total(laborable)).toBeCloseTo(12.8, 9);
    expect(total(finDeSemana)).toBeCloseTo(4.8, 9);
    expect(total(byCategory.get('iluminacion') ?? [])).toBeCloseTo(8, 9);
  });
});
