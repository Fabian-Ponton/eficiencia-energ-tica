import { describe, expect, it } from 'vitest';
import { consumptionFromReadings } from '@/domain/calc/readings';

describe('lecturas del medidor', () => {
  it('calcula el consumo entre lecturas y reporta las anomalías', () => {
    const { periods, anomalies } = consumptionFromReadings([
      { at: new Date(2026, 2, 4, 8), kwh: 11_630 },
      { at: new Date(2026, 2, 1, 8), kwh: 10_000 },
      { at: new Date(2026, 2, 2, 8), kwh: 10_690 },
      { at: new Date(2026, 2, 5, 8), kwh: 11_600 },
    ]);
    expect(periods).toHaveLength(2);
    expect(periods[0].kwhPerDay).toBeCloseTo(690, 10);
    expect(periods[1].days).toBeCloseTo(2, 10);
    expect(periods[1].kwhPerDay).toBeCloseTo(470, 10);
    expect(anomalies).toEqual([{ from: new Date(2026, 2, 4, 8), to: new Date(2026, 2, 5, 8), reason: 'lectura-menor' }]);
  });
});
