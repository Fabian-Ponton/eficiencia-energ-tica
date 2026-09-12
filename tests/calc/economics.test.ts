import { describe, expect, it } from 'vitest';
import { annuityFactor, avoidedEmissionsTonnes, irr, npv, projectCashFlows, simplePayback } from '@/domain/calc/economics';

describe('evaluación económica', () => {
  it('retorno simple: 1.000.000 ÷ 250.000 = 4 años', () => {
    expect(simplePayback(1_000_000, 250_000)).toBe(4);
    expect(simplePayback(100, 0)).toBe(Infinity);
  });

  it('factor de anualidad al 12 % durante 10 años', () => {
    expect(annuityFactor(0.12, 10)).toBeCloseTo(5.650223, 6);
  });

  it('VPN de la medida M1 del prototipo', () => {
    expect(npv(0.12, projectCashFlows({ investment: 0.8, annualSavings: 6.1, years: 10 }))).toBeCloseTo(33.66636, 4);
  });

  it('flujos con incremento de tarifa', () => {
    const flujos = projectCashFlows({ investment: 10, annualSavings: 100, years: 3, escalation: 0.1 });
    [-10, 100, 110, 121].forEach((v, i) => expect(flujos[i]).toBeCloseTo(v, 8));
  });

  it('TIR de 1.000 invertidos con 300 anuales durante 5 años', () => {
    expect(irr([-1000, 300, 300, 300, 300, 300])).toBeCloseTo(0.1524, 3);
    expect(irr([100, 100])).toBeNull();
  });

  it('emisiones evitadas con un factor configurable', () => {
    expect(avoidedEmissionsTonnes(31_300, 0.126)).toBeCloseTo(3.9438, 4);
  });
});
