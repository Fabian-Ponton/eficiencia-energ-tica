import { describe, expect, it } from 'vitest';
import {
  powerFactorFromEnergy,
  relativeChange,
  rollingTwelveMonths,
  summarizeBills,
  totalsByYear,
  type BillRecord,
} from '@/domain/calc/bills';

const PERIODOS = ['2025-10', '2025-11', '2025-12', '2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09'];
const ACTUAL = [17200, 16800, 11900, 10800, 16400, 17900, 17600, 18300, 13200, 12600, 17100, 16600];
const ANTERIOR = [17900, 17600, 12500, 11200, 17100, 18600, 18400, 19100, 13800, 13100, 17900, 17400];

const facturas = (periodos: string[], kwh: number[]): BillRecord[] =>
  periodos.map((period, i) => ({ period, kwh: kwh[i], costCop: kwh[i] * 850 }));

describe('facturación', () => {
  it('resume el año del Bloque 6', () => {
    const r = summarizeBills(facturas(PERIODOS, ACTUAL));
    expect(r?.totalKwh).toBe(186_400);
    expect(r?.averageMonthlyKwh).toBeCloseTo(15_533.33, 2);
    expect(r?.peak.period).toBe('2026-05');
    expect(r?.lowest.period).toBe('2026-01');
    expect(r?.effectiveTariffCopPerKwh).toBeCloseTo(850, 10);
  });

  it('sin facturas no hay resumen', () => {
    expect(summarizeBills([])).toBeNull();
  });

  it('calcula la variación frente al año anterior', () => {
    expect(relativeChange(186_400, 194_600)).toBeCloseTo(-0.0421, 4);
  });

  it('suma móvil de 12 meses', () => {
    const previos = PERIODOS.map((p) => `${Number(p.slice(0, 4)) - 1}${p.slice(4)}`);
    const serie = rollingTwelveMonths([...facturas(previos, ANTERIOR), ...facturas(PERIODOS, ACTUAL)]);
    expect(serie).toHaveLength(13);
    expect(serie[0]).toEqual({ period: '2025-09', kwh: 194_600 });
    expect(serie.at(-1)).toEqual({ period: '2026-09', kwh: 186_400 });
  });

  it('totales por año calendario', () => {
    const totales = totalsByYear(facturas(PERIODOS, ACTUAL));
    expect(totales.get(2025)).toBe(45_900);
    expect(totales.get(2026)).toBe(140_500);
  });

  it('factor de potencia desde la energía activa y reactiva', () => {
    expect(powerFactorFromEnergy(1000, 484.3)).toBeCloseTo(0.9, 3);
    expect(powerFactorFromEnergy(0, 0)).toBe(1);
  });
});
