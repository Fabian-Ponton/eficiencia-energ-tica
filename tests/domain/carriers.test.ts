import { describe, expect, it } from 'vitest';
import { carrierOf, electricBills, electricEquipment, equivalentKwh, estimatedByCarrier, isElectric, summarizeCarriers, totalEnergy, unitLabel } from '@/domain/carriers';
import type { Bill, Equipment } from '@/domain/types';

const base = { id: 'x', projectId: 'p', createdAt: 0, updatedAt: 0 };
const luz = (period: string, kwh: number, costCop: number): Bill => ({ ...base, id: `l-${period}`, period, kwh, costCop });
const gas = (period: string, quantity: number | undefined, kwhPerUnit: number | undefined, costCop: number): Bill => ({
  ...base,
  id: `g-${period}`,
  period,
  carrier: 'gas-natural',
  quantity,
  unit: 'm3',
  kwhPerUnit,
  kwh: quantity && kwhPerUnit ? quantity * kwhPerUnit : 0,
  costCop,
});
const equipo = (extra: Partial<Equipment>): Equipment => ({
  ...base,
  name: 'Equipo',
  category: 'laboratorio',
  powerKw: 1,
  quantity: 1,
  hoursPerDay: 10,
  operatingDaysPerMonth: 20,
  useFactor: 1,
  condition: 'bueno',
  ...extra,
});

describe('varios energéticos', () => {
  it('un registro sin energético es electricidad', () => {
    expect(carrierOf({})).toBe('electricidad');
    expect(isElectric({})).toBe(true);
    expect(isElectric({ carrier: 'gas-natural' })).toBe(false);
    expect(electricBills([luz('2026-01', 100, 1), gas('2026-01', 10, 10, 1)]).map((b) => b.id)).toEqual(['l-2026-01']);
    expect(electricEquipment([equipo({}), equipo({ carrier: 'gas-natural' })])).toHaveLength(1);
  });

  it('convierte a kWh con el factor de la factura y no inventa uno cuando falta', () => {
    expect(equivalentKwh(luz('2026-01', 1200, 1))).toBe(1200);
    expect(equivalentKwh(gas('2026-01', 300, 10.5, 1))).toBe(3150);
    expect(equivalentKwh(gas('2026-01', 300, undefined, 1))).toBeNull();
    expect(equivalentKwh(gas('2026-01', undefined, 10.5, 1))).toBeNull();
    expect(equivalentKwh(gas('2026-01', 300, 0, 1))).toBeNull();
    expect(unitLabel('m3')).toBe('m³');
    expect(unitLabel(undefined)).toBe('unid.');
  });

  it('resume cada energético por separado y reparte el total en kWh equivalentes', () => {
    const facturas = [
      luz('2026-01', 9_000, 8_100_000),
      luz('2026-02', 11_000, 9_900_000),
      gas('2026-01', 100, 10, 400_000),
      gas('2026-02', 150, 10, 600_000),
    ];
    const [electricidad, gasNatural] = summarizeCarriers(facturas);
    expect(electricidad).toMatchObject({ carrier: 'electricidad', count: 2, kwh: 20_000, costCop: 18_000_000, unit: 'kWh', missingFactor: 0 });
    expect(electricidad.copPerKwh).toBeCloseTo(900, 6);
    expect(gasNatural).toMatchObject({ carrier: 'gas-natural', count: 2, quantity: 250, unit: 'm3', kwh: 2_500, costCop: 1_000_000, firstPeriod: '2026-01', lastPeriod: '2026-02' });
    expect(gasNatural.copPerKwh).toBeCloseTo(400, 6);
    // 20.000 de 22.500 kWh equivalentes
    expect(electricidad.share).toBeCloseTo(20_000 / 22_500, 6);
    expect(electricidad.share + gasNatural.share).toBeCloseTo(1, 9);
    expect(totalEnergy([electricidad, gasNatural])).toEqual({ kwh: 22_500, costCop: 19_000_000, missingFactor: 0 });
  });

  it('una factura sin factor no suma kWh, se cuenta como faltante y deja el costo por kWh sin calcular', () => {
    const [gasNatural] = summarizeCarriers([gas('2026-01', 100, 10, 400_000), gas('2026-02', 150, undefined, 600_000)]);
    expect(gasNatural.kwh).toBe(1_000);
    expect(gasNatural.missingFactor).toBe(1);
    expect(gasNatural.copPerKwh).toBeNull();
    expect(totalEnergy([gasNatural]).missingFactor).toBe(1);
  });

  it('solo cuenta las últimas 12 facturas de cada energético y omite las eliminadas', () => {
    const meses = Array.from({ length: 14 }, (_, i) => luz(`2025-${String(i + 1).padStart(2, '0')}`.replace('2025-13', '2026-01').replace('2025-14', '2026-02'), 100, 90));
    const facturas = [...meses, { ...luz('2026-03', 5_000, 1), deletedAt: 1 }];
    const [electricidad] = summarizeCarriers(facturas);
    expect(electricidad.count).toBe(12);
    expect(electricidad.kwh).toBe(1_200);
    expect(electricidad.firstPeriod).toBe('2025-03');
    expect(summarizeCarriers([])).toEqual([]);
  });

  it('un proyecto solo con electricidad se resume igual que antes', () => {
    const resumen = summarizeCarriers([luz('2026-01', 500, 450_000)]);
    expect(resumen).toHaveLength(1);
    expect(resumen[0]).toMatchObject({ carrier: 'electricidad', kwh: 500, share: 1 });
  });

  it('estima la energía anual del censo por energético (kWh térmicos para el gas)', () => {
    const totales = estimatedByCarrier([equipo({ powerKw: 2, hoursPerDay: 5 }), equipo({ carrier: 'gas-natural', powerKw: 10, hoursPerDay: 2 }), equipo({ powerKw: 1, deletedAt: 1 })]);
    // 2 kW × 5 h × 20 d × 12 meses
    expect(totales.get('electricidad')).toBe(2_400);
    expect(totales.get('gas-natural')).toBe(4_800);
    expect(totales.get('glp')).toBeUndefined();
  });
});
