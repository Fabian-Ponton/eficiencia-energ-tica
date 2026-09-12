import { describe, expect, it } from 'vitest';
import { annualEnergyKwh, dailyEnergyKwh, hourlyProfileKw, monthlyEnergyKwh, sumProfiles } from '@/domain/calc/equipment';

describe('consumo de equipos', () => {
  it('10 lámparas de 40 W, 10 h al día y 22 días → 88 kWh/mes', () => {
    expect(monthlyEnergyKwh({ powerKw: 0.04, quantity: 10, hoursPerDay: 10 })).toBeCloseTo(88, 10);
  });

  it('mini-split del prototipo: 1,65 kW × 2 × 9 h × 0,80', () => {
    const aire = { powerKw: 1.65, quantity: 2, hoursPerDay: 9, useFactor: 0.8 };
    expect(dailyEnergyKwh(aire)).toBeCloseTo(23.76, 10);
    expect(monthlyEnergyKwh(aire)).toBeCloseTo(522.72, 10);
    expect(annualEnergyKwh(aire)).toBeCloseTo(6272.64, 10);
  });

  it('arma y suma perfiles horarios', () => {
    const horas = Array.from({ length: 24 }, (_, h) => h >= 7 && h < 12);
    const perfil = hourlyProfileKw({ powerKw: 1.65, quantity: 2, useFactor: 0.8 }, horas);
    expect(perfil[8]).toBeCloseTo(2.64, 10);
    expect(perfil[3]).toBe(0);
    expect(sumProfiles([perfil, perfil])[9]).toBeCloseTo(5.28, 10);
  });
});
