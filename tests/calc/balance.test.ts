import { describe, expect, it } from 'vitest';
import { endUseBalance, reconciliationDeviation, significantEnergyUses } from '@/domain/calc/balance';
import { energyIntensity, energyPerUser } from '@/domain/calc/indicators';

const USOS = [
  { category: 'Iluminación', kwh: 33_552 },
  { category: 'Climatización', kwh: 95_064 },
  { category: 'TI y oficina', kwh: 24_232 },
  { category: 'Refrigeración', kwh: 11_184 },
  { category: 'Motores y bombas', kwh: 9_320 },
  { category: 'Otros', kwh: 7_456 },
  { category: 'Cocina', kwh: 5_592 },
];

describe('balance energético', () => {
  it('ordena los usos y calcula su participación', () => {
    const balance = endUseBalance(USOS);
    expect(balance[0].category).toBe('Climatización');
    expect(balance[0].share).toBeCloseTo(0.51, 10);
    expect(balance.at(-1)?.cumulativeShare).toBeCloseTo(1, 10);
  });

  it('agrupa las categorías repetidas', () => {
    const balance = endUseBalance([
      { category: 'A', kwh: 1 },
      { category: 'A', kwh: 2 },
      { category: 'B', kwh: 1 },
    ]);
    expect(balance).toHaveLength(2);
    expect(balance[0].kwh).toBe(3);
  });

  it('identifica los usos significativos por Pareto (80 %)', () => {
    expect(significantEnergyUses(endUseBalance(USOS)).map((u) => u.category)).toEqual(['Climatización', 'Iluminación', 'TI y oficina']);
  });

  it('compara el censo con la facturación', () => {
    expect(reconciliationDeviation(201_300, 186_400)).toBeCloseTo(0.07994, 5);
  });

  it('calcula indicadores de desempeño', () => {
    expect(energyIntensity(186_400, 3000)).toBeCloseTo(62.13, 2);
    expect(energyPerUser(1000, 0)).toBeNaN();
  });
});
