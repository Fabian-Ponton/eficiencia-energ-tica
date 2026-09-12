import { describe, expect, it } from 'vitest';
import { analyzeInterval, annualSummary, areaIntensity, energyFlow, fitBaseline, monthlyRows } from '@/domain/analysis';
import type { Area, Bill, Equipment } from '@/domain/types';
import { nextPeriod } from '@/utils/dates';

const bill = (period: string, kwh: number, extra: Partial<Bill> = {}): Bill => ({
  id: period,
  projectId: 'p',
  createdAt: 0,
  updatedAt: 0,
  period,
  kwh,
  costCop: kwh * 800,
  ...extra,
});
const area = (id: string, extra: Partial<Area> = {}): Area => ({ id, projectId: 'p', createdAt: 0, updatedAt: 0, name: id, ...extra });
const equipo = (category: Equipment['category'], powerKw: number, areaId?: string): Equipment => ({
  id: `${category}-${areaId ?? 'x'}`,
  projectId: 'p',
  createdAt: 0,
  updatedAt: 0,
  name: category,
  category,
  powerKw,
  quantity: 1,
  hoursPerDay: 10,
  operatingDaysPerMonth: 20,
  useFactor: 1,
  condition: 'bueno',
  areaId,
});

describe('curva diaria del analizador', () => {
  it('resume demanda máxima, perfiles por tipo de día, mapa de calor y energía diaria', () => {
    const lunes = Array.from({ length: 24 }, (_, h) => (h >= 8 && h < 18 ? 50 : 10));
    const sabado = Array.from({ length: 24 }, () => 10);
    const readings = [
      ...lunes.map((kw, h) => ({ start: new Date(2026, 7, 31, h), kw })),
      ...sabado.map((kw, h) => ({ start: new Date(2026, 8, 5, h), kw })),
    ];
    const a = analyzeInterval(readings, 60);
    expect(a?.peak?.kw).toBe(50);
    expect(a?.completeDays).toBe(2);
    expect(a?.dailyEnergy.map((d) => [d.date, d.kwh, d.weekend])).toEqual([
      ['2026-08-31', 640, false],
      ['2026-09-05', 240, true],
    ]);
    expect(a?.averageDailyKwh).toBe(440);
    expect(a?.weekdayProfile).toEqual(lunes);
    expect(a?.weekendProfile).toEqual(sabado);
    expect(a?.matrix[0]).toEqual(lunes);
    expect(a?.matrix[5]).toEqual(sabado);
    expect(a?.loadFactor).toBeCloseTo(880 / 48 / 50, 9);
    expect(analyzeInterval([], 15)).toBeNull();
  });
});

describe('comportamiento mensual y anual', () => {
  it('compara cada mes con el mismo mes del año anterior', () => {
    const rows = monthlyRows([bill('2025-09', 1000, { days: 30 }), bill('2026-09', 900, { days: 30, kvarh: 300 })]);
    expect(rows[1]).toMatchObject({ previousKwh: 1000, kwhPerDay: 30 });
    expect(rows[1].change).toBeCloseTo(-0.1, 9);
    expect(rows[1].pf).toBeCloseTo(900 / Math.hypot(900, 300), 9);
    expect(rows[0].change).toBeNull();
  });

  it('anualiza con kWh/día cuando faltan facturas y calcula las emisiones', () => {
    const s = annualSummary([bill('2026-08', 3100, { days: 31 }), bill('2026-09', 2900, { days: 29 })], 0.126);
    expect(s.last12Kwh).toBeNull();
    expect(s.annualizedMethod).toBe('kwh-dia');
    expect(s.annualizedKwh).toBeCloseTo(36_500, 6);
    expect(s.co2Tonnes).toBeCloseTo((36_500 * 0.126) / 1000, 9);
  });

  it('con 24 facturas compara los últimos 12 meses con los 12 anteriores', () => {
    const bills = Array.from({ length: 24 }, (_, i) => bill(nextPeriod('2024-10', i), i < 12 ? 1000 : 900));
    const s = annualSummary(bills);
    expect([s.last12Kwh, s.previous12Kwh]).toEqual([10_800, 12_000]);
    expect(s.change).toBeCloseTo(-0.1, 9);
    expect(s.rolling).toHaveLength(13);
    expect(s.byYear.map((y) => [y.year, y.months])).toEqual([
      [2024, 3],
      [2025, 12],
      [2026, 9],
    ]);
  });
});

describe('balance y flujo de energía', () => {
  it('reparte lo facturado entre usos finales y deja visible lo no identificado', () => {
    // 1 kW × 10 h × 20 días × 12 meses = 2.400 kWh/año por cada kW
    const flujo = energyFlow([equipo('iluminacion', 1, 'a1'), equipo('climatizacion', 2, 'a2')], [area('a1'), area('a2')], 10_000);
    expect(flujo.estimatedKwh).toBe(7200);
    expect(flujo.totalKwh).toBe(10_000);
    expect(flujo.links.find((l) => l.target === 'resto')?.kwh).toBe(2800);
    expect(flujo.nodes.filter((n) => n.kind === 'area')).toHaveLength(2);
    expect(energyFlow([equipo('iluminacion', 1)], [], null).nodes.some((n) => n.kind === 'area')).toBe(false);
  });

  it('calcula la intensidad energética de cada espacio', () => {
    const [primero] = areaIntensity([equipo('iluminacion', 1, 'a1')], [area('a1', { lengthM: 8, widthM: 6 })]);
    expect(primero.kwh).toBe(2400);
    expect(primero.intensity).toBeCloseTo(50, 9);
  });
});

describe('línea base energética', () => {
  it('reproduce una relación lineal exacta con los días hábiles', () => {
    const bills = [18, 20, 21, 12, 10, 22].map((dias, i) => bill(nextPeriod('2026-01', i), 1000 + 500 * dias, { workingDays: dias }));
    const r = fitBaseline(bills, ['workingDays']);
    expect(r.model.coefficients[0]).toBeCloseTo(1000, 6);
    expect(r.model.coefficients[1]).toBeCloseTo(500, 6);
    expect(r.model.r2).toBeCloseTo(1, 9);
    expect(r.quality).toEqual({ r2: true, cvRmse: true, nmbe: true });
    expect(r.rows[0].predicted).toBeCloseTo(r.rows[0].actual, 6);
  });
});
