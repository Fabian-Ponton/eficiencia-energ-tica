import { describe, expect, it } from 'vitest';
import { apparentPowerKva, derivePower, imbalanceLevel } from '@/domain/measurements';

describe('mediciones por fase', () => {
  it('calcula la potencia aparente según cómo se midió la tensión', () => {
    // Trifásico entre fases: √3 × 208 V × 100 A = 36,03 kVA
    expect(apparentPowerKva({ phases: 3, voltageRef: 'LL', voltageV: [208, 208, 208], currentA: [100, 100, 100] })).toBeCloseTo(36.03, 2);
    // Fase-neutro: suma de V·I de cada fase
    expect(apparentPowerKva({ phases: 3, voltageRef: 'LN', voltageV: [120, 120, 120], currentA: [100, 50, 50] })).toBeCloseTo(24, 6);
    expect(apparentPowerKva({ phases: 1, voltageRef: 'LN', voltageV: [120], currentA: [10] })).toBeCloseTo(1.2, 6);
    expect(apparentPowerKva({ phases: 3, voltageRef: 'LL', voltageV: [208, null, 208], currentA: [1, 1, 1] })).toBeNull();
  });

  it('completa FP y reactiva con kW y kVA, y evalúa el desbalance', () => {
    const d = derivePower({ phases: 3, voltageRef: 'LL', voltageV: [208, 208, 208], currentA: [120, 100, 80], kw: 32 });
    // kVA = √3·208·100/1000 = 36,03; FP = 32/36,03 = 0,888
    expect(d.kva).toBeCloseTo(36.03, 2);
    expect(d.pf).toBeCloseTo(0.888, 3);
    expect(d.kvar).toBeCloseTo(Math.sqrt(36.0267 ** 2 - 32 ** 2), 1);
    expect(d.imbalance).toBeCloseTo(0.2, 6);
    expect(d.calculated).toEqual({ kw: false, kva: true, kvar: true, pf: true });
    expect(imbalanceLevel(0.05)).toBe('normal');
    expect(imbalanceLevel(0.2)).toBe('alto');
    expect(imbalanceLevel(0.25)).toBe('critico');
  });

  it('respeta los valores que registró el auditor', () => {
    const d = derivePower({ phases: 1, voltageV: [120], currentA: [10], kw: 1, kva: 1.25, pf: 0.8 });
    expect(d).toMatchObject({ kw: 1, kva: 1.25, pf: 0.8, imbalance: null });
    expect(d.kvar).toBeCloseTo(0.75, 6);
  });
});
