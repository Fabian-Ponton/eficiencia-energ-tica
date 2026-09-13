import { describe, expect, it } from 'vitest';
import { findingFromSuggestion, pendingSuggestions, ruleIdOf } from '@/domain/diagnosis';
import { capacitorMeasure, commercialKvar, hvacMeasure, ledMeasure, measureEconomics, nextMeasureCode, pvMeasure, suggestedPriority } from '@/domain/measures';

const economics = { tariffCopPerKwh: 850, discountRate: 0.12, tariffEscalation: 0, horizonYears: 10, emissionFactorKgPerKwh: 0.126 };

describe('evaluación económica de una medida', () => {
  it('retorno, VPN, TIR y CO₂ con los parámetros del proyecto', () => {
    const e = measureEconomics({ investmentCop: 1_000_000, savingsCopYear: 250_000, annualCostCop: 0, lifetimeYears: 10, savingsKwhYear: 1000 }, economics);
    expect(e.paybackYears).toBe(4);
    // 250.000 × factor de anualidad al 12 % en 10 años (5,650223) − 1.000.000
    expect(e.npvCop).toBeCloseTo(412_555.8, 0);
    expect(e.irr).toBeCloseTo(0.2141, 3);
    expect(e.co2TonnesYear).toBeCloseTo(0.126, 6);
    expect(e.years).toBe(10);
  });

  it('evalúa hasta el horizonte del proyecto y resta el costo anual', () => {
    const e = measureEconomics({ investmentCop: 1_000_000, savingsCopYear: 300_000, annualCostCop: 50_000, lifetimeYears: 25, savingsKwhYear: 0 }, economics);
    expect(e.years).toBe(10);
    expect(e.paybackYears).toBe(4);
    expect(e.cashFlows).toHaveLength(11);
    expect(e.co2TonnesYear).toBe(0);
  });

  it('sugiere la prioridad por el retorno', () => {
    expect(suggestedPriority({ paybackYears: 1.5 }, 100)).toBe('alta');
    expect(suggestedPriority({ paybackYears: 4 }, 100)).toBe('media');
    expect(suggestedPriority({ paybackYears: 8 }, 100)).toBe('baja');
    expect(suggestedPriority({ paybackYears: Infinity }, 0)).toBe('alta');
  });
});

describe('calculadoras de medidas', () => {
  it('solar fotovoltaica: 100 kWh/día, 5,5 HSP, PR 0,8', () => {
    const fv = pvMeasure({ dailyEnergyKwh: 100, peakSunHours: 5.5, performanceRatio: 0.8, moduleWp: 550, moduleAreaM2: 2.6, costPerKwp: 4_000_000, tariff: 850, availableRoofM2: 100 });
    expect(fv.sizing.installedKwp).toBeCloseTo(23.1, 10);
    expect(fv.savingsKwhYear).toBeCloseTo(37_098.6, 1);
    expect(fv.savingsCopYear).toBeCloseTo(31_533_810, 0);
    expect(fv.investmentCop).toBeCloseTo(92_400_000, 4);
    expect(fv.annualCostCop).toBeCloseTo(924_000, 4);
    // 42 módulos × 2,6 m² = 109,2 m²: no caben en 100 m²
    expect(fv.fitsRoof).toBe(false);
  });

  it('banco de condensadores de 100 kW, de 0,80 a 0,95', () => {
    const bank = capacitorMeasure({ demandKw: 100, currentPf: 0.8, targetPf: 0.95, costPerKvar: 150_000, annualReactiveChargeCop: 2_400_000 });
    expect(bank.requiredKvar).toBeCloseTo(42.13, 2);
    expect(bank.bankKvar).toBe(45);
    expect(bank.investmentCop).toBe(6_750_000);
    expect(bank.savingsCopYear).toBe(2_400_000);
    expect(commercialKvar(40)).toBe(40);
    expect(commercialKvar(0)).toBe(0);
  });

  it('reemplazo de dos aires de 36.000 BTU/h con EER 10,9 por EER 16', () => {
    const ac = hvacMeasure({ units: 2, capacityBtuH: 36_000, currentEer: 10.9, newEer: 16, fullLoadHoursPerYear: 1800, costPerUnit: 7_000_000, tariff: 850 });
    expect(ac.savingsKwhYear).toBeCloseTo(3789.9, 1);
    // 1.894,954 kWh por unidad × 2 × 850 COP/kWh
    expect(ac.savingsCopYear).toBeCloseTo(3_221_422, 0);
    expect(ac.investmentCop).toBe(14_000_000);
  });

  it('cambio a LED: 8 luminarias de 70 W por 8 de 40 W, 2.000 h/año', () => {
    const led = ledMeasure({ currentCount: 8, currentW: 70, proposedCount: 8, proposedW: 40, hoursPerYear: 2000, costPerLuminaire: 180_000, tariff: 850 });
    expect(led.savingsKwhYear).toBeCloseTo(480, 10);
    expect(led.savingsCopYear).toBeCloseTo(408_000, 6);
    expect(led.investmentCop).toBe(1_440_000);
  });

  it('numera las medidas en orden', () => {
    expect(nextMeasureCode([])).toBe('M1');
    expect(nextMeasureCode([{ code: 'M1' }, { code: 'M4' }, { code: 'otra' }])).toBe('M5');
  });
});

describe('hallazgos sugeridos', () => {
  const suggestions = [
    { tone: 'critical' as const, topic: 'electrico' as const, title: 'Transformador T1: carga crítica', detail: 'Trabaja al 82 %.' },
    { tone: 'info' as const, topic: 'consumo' as const, title: 'Usos significativos de energía', detail: '…' },
    { tone: 'serious' as const, topic: 'iluminacion' as const, title: 'Iluminancia por debajo de la requerida', detail: 'Aula 601.' },
  ];

  it('ofrece solo lo que falta revisar', () => {
    const adopted = [{ ruleId: ruleIdOf('Transformador T1: carga crítica') }];
    expect(pendingSuggestions(suggestions, adopted).map((s) => s.title)).toEqual(['Iluminancia por debajo de la requerida']);
  });

  it('convierte una sugerencia en hallazgo con gravedad y categoría', () => {
    const f = findingFromSuggestion(suggestions[0], 'p');
    expect(f).toMatchObject({ severity: 'critico', category: 'electrico', auto: true, status: 'abierto', ruleId: 'transformador-t1-carga-critica' });
  });
});
