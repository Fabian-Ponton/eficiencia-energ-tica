import { describe, expect, it } from 'vitest';
import { formatCop, formatKwh, formatMillionsCop, formatNumber, formatPercent } from '@/utils/format';

describe('formatos colombianos', () => {
  it('usa punto de miles y coma decimal', () => {
    expect(formatNumber(186_400)).toBe('186.400');
    expect(formatNumber(1850)).toBe('1.850');
    expect(formatNumber(15_533.333)).toBe('15.533');
    expect(formatNumber(-1234.5, 1)).toBe('−1.234,5');
  });

  it('redondea sin errores de representación binaria', () => {
    expect(formatNumber(0.575, 2)).toBe('0,58');
    expect(formatNumber(-0.001)).toBe('0');
  });

  it('formatea pesos, millones, porcentajes y energía', () => {
    expect(formatCop(158_440_000)).toBe('$158.440.000');
    expect(formatMillionsCop(158_440_000)).toBe('$158,4 M');
    expect(formatPercent(-0.0421)).toBe('−4,2 %');
    expect(formatKwh(6272.64)).toBe('6.273 kWh');
  });

  it('muestra una raya cuando el valor no es un número', () => {
    expect(formatNumber(Number.NaN)).toBe('—');
  });
});
