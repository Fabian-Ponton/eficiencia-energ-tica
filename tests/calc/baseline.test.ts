import { describe, expect, it } from 'vitest';
import { fitLinearModel } from '@/domain/calc/baseline';

describe('línea base energética', () => {
  it('ajusta una recta y reporta R², CV(RMSE) y NMBE', () => {
    const modelo = fitLinearModel([110, 190, 310, 390, 510], [[10], [20], [30], [40], [50]]);
    expect(modelo.coefficients[0]).toBeCloseTo(2, 8);
    expect(modelo.coefficients[1]).toBeCloseTo(10, 8);
    expect(modelo.r2).toBeCloseTo(0.995223, 6);
    expect(modelo.cvRmse).toBeCloseTo(0.0418845, 6);
    expect(modelo.nmbe).toBeCloseTo(0, 10);
    expect(modelo.predict([35])).toBeCloseTo(352, 8);
  });

  it('recupera un modelo con dos variables', () => {
    const variables = [[1, 2], [2, 1], [3, 5], [4, 3], [5, 8], [6, 2]];
    const consumo = variables.map(([a, b]) => 5 + 2 * a + 3 * b);
    const modelo = fitLinearModel(consumo, variables);
    [5, 2, 3].forEach((c, i) => expect(modelo.coefficients[i]).toBeCloseTo(c, 8));
    expect(modelo.r2).toBeCloseTo(1, 10);
  });

  it('sin variables usa el promedio', () => {
    const modelo = fitLinearModel([10, 20, 30]);
    expect(modelo.coefficients[0]).toBeCloseTo(20, 10);
    expect(modelo.r2).toBe(0);
  });

  it('rechaza variables colineales', () => {
    expect(() => fitLinearModel([1, 2, 3, 4], [[1, 2], [2, 4], [3, 6], [4, 8]])).toThrow(/colineales/);
  });
});
