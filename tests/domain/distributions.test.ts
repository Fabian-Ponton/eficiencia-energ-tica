import { describe, expect, it } from 'vitest';
import { fitLinearModel } from '@/domain/calc/baseline';
import { fisherUpperP, logGamma, regularizedIncompleteBeta, studentTwoTailedP } from '@/domain/calc/distributions';

/** P(|T| ≥ t) de la t de Student con tres grados de libertad, que tiene forma cerrada. */
const cerrada3 = (t: number) => {
  const x = t / Math.sqrt(3);
  return 1 - (2 / Math.PI) * (Math.atan(x) + x / (1 + x * x));
};

describe('distribuciones de la regresión', () => {
  it('ln Γ coincide con los factoriales y con Γ(1/2) = √π', () => {
    expect(logGamma(5)).toBeCloseTo(Math.log(24), 10);
    expect(logGamma(0.5)).toBeCloseTo(Math.log(Math.sqrt(Math.PI)), 10);
    expect(logGamma(1)).toBeCloseTo(0, 10);
  });

  it('la beta incompleta regularizada llega a 0 y a 1 y es simétrica', () => {
    expect(regularizedIncompleteBeta(0, 2, 3)).toBe(0);
    expect(regularizedIncompleteBeta(1, 2, 3)).toBe(1);
    expect(regularizedIncompleteBeta(0.5, 2, 2)).toBeCloseTo(0.5, 12);
    // I_x(a, b) = 1 − I_(1−x)(b, a)
    expect(regularizedIncompleteBeta(0.3, 2, 5)).toBeCloseTo(1 - regularizedIncompleteBeta(0.7, 5, 2), 12);
  });

  it('la t de Student de dos colas da los valores críticos de las tablas', () => {
    expect(studentTwoTailedP(0, 10)).toBeCloseTo(1, 12);
    expect(studentTwoTailedP(2.228138852, 10)).toBeCloseTo(0.05, 6);
    expect(studentTwoTailedP(12.7062047, 1)).toBeCloseTo(0.05, 6);
    expect(studentTwoTailedP(1, 1)).toBeCloseTo(0.5, 10);
    expect(studentTwoTailedP(2.0, 30)).toBeCloseTo(0.054625, 5);
    // Con tres grados de libertad existe la fórmula cerrada
    expect(studentTwoTailedP(2.3094, 3)).toBeCloseTo(cerrada3(2.3094), 8);
    expect(studentTwoTailedP(0.5, 3)).toBeCloseTo(cerrada3(0.5), 8);
    expect(studentTwoTailedP(Number.POSITIVE_INFINITY, 5)).toBe(0);
    expect(studentTwoTailedP(-2.228138852, 10)).toBeCloseTo(0.05, 6);
  });

  it('la F de Fisher da los valores críticos y con un grado equivale a la t al cuadrado', () => {
    expect(fisherUpperP(4.964603, 1, 10)).toBeCloseTo(0.05, 5);
    expect(fisherUpperP(3.492828, 2, 20)).toBeCloseTo(0.05, 5);
    expect(fisherUpperP(2.5 ** 2, 1, 12)).toBeCloseTo(studentTwoTailedP(2.5, 12), 10);
    expect(fisherUpperP(0, 3, 10)).toBe(1);
  });

  it('la regresión entrega errores estándar, t y probabilidades como la de Excel', () => {
    // y = 0,6 + 0,8·x con residuos −0,4; 0,8; −1; 1,2; −0,6 → SCE = 3,6, s² = 1,2
    const model = fitLinearModel([1, 3, 2, 5, 4], [[1], [2], [3], [4], [5]]);
    expect(model.coefficients[0]).toBeCloseTo(0.6, 10);
    expect(model.coefficients[1]).toBeCloseTo(0.8, 10);
    expect(model.degreesOfFreedom).toBe(3);
    expect(model.standardErrors[1]).toBeCloseTo(Math.sqrt(1.2 / 10), 10);
    expect(model.standardErrors[0]).toBeCloseTo(Math.sqrt(1.2 * (1 / 5 + 9 / 10)), 10);
    expect(model.tValues[1]).toBeCloseTo(0.8 / Math.sqrt(0.12), 10);
    expect(model.pValues[1]).toBeCloseTo(cerrada3(0.8 / Math.sqrt(0.12)), 8);
    expect(model.pValues[0]).toBeCloseTo(cerrada3(0.6 / Math.sqrt(1.2 * 1.1)), 8);
    expect(model.r2).toBeCloseTo(0.64, 10);
    expect(model.adjustedR2).toBeCloseTo(1 - (0.36 * 4) / 3, 10);
    expect(model.fStatistic).toBeCloseTo(0.64 / (0.36 / 3), 8);
    // Con una sola variable, la prueba F es la de la t al cuadrado
    expect(model.fPValue).toBeCloseTo(model.pValues[1], 8);
  });

  it('sin variables la línea base es el promedio y la prueba F no aplica', () => {
    const model = fitLinearModel([10, 12, 11, 13, 14]);
    expect(model.coefficients).toHaveLength(1);
    expect(model.coefficients[0]).toBeCloseTo(12, 10);
    expect(model.r2).toBe(0);
    expect(model.fStatistic).toBe(0);
    expect(model.fPValue).toBe(1);
  });

  it('un ajuste perfecto tiene probabilidad 0 y no divide por cero', () => {
    const model = fitLinearModel([2, 4, 6, 8, 10], [[1], [2], [3], [4], [5]]);
    expect(model.r2).toBeCloseTo(1, 10);
    expect(model.pValues[1]).toBeLessThan(1e-10);
    expect(model.fPValue).toBeLessThan(1e-10);
  });
});
