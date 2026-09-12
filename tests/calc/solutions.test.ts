import { describe, expect, it } from 'vitest';
import { capacitorBankKvar } from '@/domain/calc/solutions/capacitors';
import { electricPowerKw, hvacReplacementSavingsKwh, nearestCommercialSize } from '@/domain/calc/solutions/hvac';
import { lightingRetrofitSavingsKwh } from '@/domain/calc/solutions/lighting';
import { pvSizing } from '@/domain/calc/solutions/pv';

describe('dimensionamiento de soluciones', () => {
  it('sistema FV: 100 kWh/día, HSP 5,5 y PR 0,8 → 22,7 kWp', () => {
    const fv = pvSizing({ dailyEnergyKwh: 100, peakSunHours: 5.5, performanceRatio: 0.8, moduleWp: 550, moduleAreaM2: 2.6 });
    expect(fv.requiredKwp).toBeCloseTo(22.727, 3);
    expect(fv.modules).toBe(42);
    expect(fv.installedKwp).toBeCloseTo(23.1, 10);
    expect(fv.arrayAreaM2).toBeCloseTo(109.2, 10);
    expect(fv.annualGenerationKwh).toBeCloseTo(37_098.6, 1);
  });

  it('banco de condensadores para 100 kW de FP 0,80 a 0,95 → 42,1 kvar', () => {
    expect(capacitorBankKvar(100, 0.8, 0.95)).toBeCloseTo(42.13, 2);
    expect(capacitorBankKvar(100, 0.96, 0.95)).toBe(0);
  });

  it('aires: potencia eléctrica, tamaño comercial y ahorro por eficiencia', () => {
    expect(electricPowerKw(18_000, 10.9)).toBeCloseTo(1.6514, 4);
    expect(nearestCommercialSize(42_500)).toBe(48_000);
    expect(nearestCommercialSize(80_000)).toBe(60_000);
    expect(hvacReplacementSavingsKwh({ capacityBtuH: 36_000, currentEer: 10.9, newEer: 16, fullLoadHoursPerYear: 1800 })).toBeCloseTo(1894.95, 1);
  });

  it('ahorro por cambio a iluminación LED', () => {
    expect(lightingRetrofitSavingsKwh({ currentW: 563, proposedW: 480, hoursPerYear: 2000 })).toBeCloseTo(166, 10);
  });
});
