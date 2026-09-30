import { describe, expect, it } from 'vitest';
import { excessHoursByEquipment, planSummary, savingsTypeOf, shutdownExclusion, shutdownMeasure } from '@/domain/measures';
import type { Equipment, Measure } from '@/domain/types';

const equipo = (id: string, extra: Partial<Equipment> = {}): Equipment =>
  ({ id, projectId: 'p', createdAt: 0, updatedAt: 0, name: id, category: 'ti-oficina', powerKw: 0.2, quantity: 10, hoursPerDay: 10, operatingDaysPerMonth: 20, useFactor: 1, condition: 'bueno', ...extra }) as Equipment;
const medida = (code: string, extra: Partial<Measure> = {}): Measure =>
  ({ id: code, projectId: 'p', createdAt: 0, updatedAt: 0, code, title: code, category: 'iluminacion', kind: 'baja-inversion', savingsKwhYear: 1000, savingsCopYear: 850_000, investmentCop: 2_000_000, annualCostCop: 0, lifetimeYears: 10, selected: true, findingIds: [], ...extra }) as Measure;

describe('clase de potencial de una medida (art. 4d)', () => {
  it('si el auditor no la elige, se infiere del tipo: operativa es buenas prácticas y el resto cambio tecnológico', () => {
    expect(savingsTypeOf({ kind: 'operativa' })).toBe('bpo');
    expect(savingsTypeOf({ kind: 'baja-inversion' })).toBe('cambio-tecnologico');
    expect(savingsTypeOf({ kind: 'alta-inversion' })).toBe('cambio-tecnologico');
    expect(savingsTypeOf({ kind: 'alta-inversion', savingsType: 'fncer' })).toBe('fncer');
    expect(savingsTypeOf({ kind: 'operativa', savingsType: 'pasiva' })).toBe('pasiva');
  });
});

describe('programa de apagado y control de horarios', () => {
  it('ahorra las horas pedidas en los equipos que se pueden apagar y deja fuera los que no', () => {
    const equipos = [
      equipo('computadores'),
      equipo('nevera', { category: 'refrigeracion', nonInterruptible: true, nonInterruptibleReason: 'conserva muestras', hoursPerDay: 24 }),
      equipo('autoclave', { category: 'laboratorio', regime: 'continuo', hoursPerDay: 24 }),
      equipo('planta', { category: 'otros', regime: 'respaldo' }),
      equipo('proyector', { powerKw: 0.3, quantity: 2, hoursPerDay: 2 }),
    ];
    const r = shutdownMeasure({ equipment: equipos, hoursSavedPerDay: 3, tariff: 900 });
    // Computadores: 0,2 kW × 10 × 3 h × 20 días × 12 = 1.440 kWh; proyectores: solo tienen 2 h, ahorran 2 h: 0,3 × 2 × 2 × 20 × 12 = 288 kWh
    expect(r.candidates.map((c) => [c.equipment.id, c.hoursSaved])).toEqual([
      ['computadores', 3],
      ['proyector', 2],
    ]);
    expect(r.savingsKwhYear).toBeCloseTo(1440 + 288, 6);
    expect(r.savingsCopYear).toBeCloseTo((1440 + 288) * 900, 4);
    expect(r.excluded.map((x) => [x.equipment.id, x.reason])).toEqual([
      ['nevera', 'no-interrumpible'],
      ['autoclave', 'continuo'],
      ['planta', 'respaldo'],
    ]);
    // Es una medida operativa de buenas prácticas, sin inversión por omisión
    expect(r.kind).toBe('operativa');
    expect(r.savingsType).toBe('bpo');
    expect(r.investmentCop).toBe(0);
    expect(r.title).toContain('12 equipos');
  });

  it('el cumplimiento esperado, los usos finales elegidos y la inversión se aplican', () => {
    const equipos = [equipo('computadores'), equipo('luces', { category: 'iluminacion', powerKw: 0.05, quantity: 40, hoursPerDay: 12 })];
    const solo = shutdownMeasure({ equipment: equipos, categories: ['iluminacion'], hoursSavedPerDay: 2, compliance: 0.5, tariff: 800, investmentCop: 1_500_000 });
    expect(solo.candidates).toHaveLength(1);
    // 0,05 kW × 40 × 2 h × 20 × 12 = 960 kWh, a la mitad: 480
    expect(solo.savingsKwhYear).toBeCloseTo(480, 6);
    expect(solo.category).toBe('iluminacion');
    expect(solo.investmentCop).toBe(1_500_000);
    // Sin nada que apagar, la medida no ahorra
    expect(shutdownMeasure({ equipment: [equipo('nevera', { nonInterruptible: true })], hoursSavedPerDay: 3, tariff: 800 }).savingsKwhYear).toBe(0);
  });

  it('un equipo sin horas de uso también queda fuera', () => {
    expect(shutdownExclusion({ hoursPerDay: 0 })).toBe('sin-horas');
    expect(shutdownExclusion({ hoursPerDay: 5 })).toBeNull();
    expect(shutdownExclusion({ hoursPerDay: 5, nonInterruptible: true, regime: 'continuo' })).toBe('no-interrumpible');
  });

  it('las horas de más de cada equipo salen de comparar su uso con el horario de su espacio', () => {
    const equipos = [
      equipo('a', { areaId: 'lab', hoursPerDay: 10 }),
      equipo('b', { areaId: 'lab', hoursPerDay: 5 }),
      equipo('c', { areaId: 'aula', hoursPerDay: 8 }),
      equipo('d', { areaId: 'lab', hoursPerDay: 12, nonInterruptible: true }),
      equipo('e', { hoursPerDay: 9 }),
    ];
    const exceso = excessHoursByEquipment(equipos, new Map([['lab', 6], ['aula', 8]]));
    // a: 10 − 6 = 4; b usa menos de lo que se usa el laboratorio; c coincide; d no se puede apagar; e no tiene espacio
    expect(exceso.map((r) => [r.equipment.id, r.excessHours])).toEqual([['a', 4]]);
  });
});

describe('resumen del plan de medidas', () => {
  it('suma solo las medidas del plan y las separa por clase de potencial', () => {
    const medidas = [
      medida('M1', { category: 'iluminacion', savingsKwhYear: 10_000, savingsCopYear: 8_500_000, investmentCop: 30_000_000 }),
      medida('M2', { category: 'otros', kind: 'operativa', savingsKwhYear: 5_000, savingsCopYear: 4_250_000, investmentCop: 0 }),
      medida('M3', { category: 'otros', kind: 'alta-inversion', savingsType: 'fncer', savingsKwhYear: 18_000, savingsCopYear: 15_300_000, investmentCop: 46_000_000, annualCostCop: 460_000 }),
      medida('M4', { selected: false, savingsKwhYear: 99_999 }),
    ];
    const s = planSummary(medidas, 186_400);
    expect(s.count).toBe(3);
    expect(s.kwh).toBe(33_000);
    expect(s.investment).toBe(76_000_000);
    expect(s.netCop).toBe(8_500_000 + 4_250_000 + 15_300_000 - 460_000);
    expect(s.paybackYears).toBeCloseTo(76_000_000 / s.netCop, 6);
    expect(s.byType.map((t) => [t.type, t.count, t.kwh])).toEqual([
      ['bpo', 1, 5_000],
      ['cambio-tecnologico', 1, 10_000],
      ['fncer', 1, 18_000],
    ]);
  });

  it('avisa del solapamiento cuando dos medidas tocan el mismo uso final o cuando hay LED y aires, y da una referencia combinada', () => {
    const dos = planSummary([medida('M1', { category: 'iluminacion', savingsKwhYear: 10_000 }), medida('M2', { category: 'iluminacion', savingsKwhYear: 10_000 })], 100_000);
    expect(dos.interaction?.categories).toEqual(['iluminacion']);
    // Cada una ahorra 10 %: aplicadas una tras otra dan 19 %, no 20 %
    expect(dos.interaction?.combinedKwh).toBeCloseTo(19_000, 6);
    expect(dos.kwh).toBe(20_000);

    const ledYAires = planSummary([medida('M1', { category: 'iluminacion' }), medida('M2', { category: 'climatizacion' })], 100_000);
    expect(ledYAires.interaction?.categories.sort()).toEqual(['climatizacion', 'iluminacion']);

    // Medidas de usos distintos, o una sola: no hay aviso
    expect(planSummary([medida('M1', { category: 'iluminacion' }), medida('M2', { category: 'refrigeracion' })], 100_000).interaction).toBeNull();
    expect(planSummary([medida('M1')], 100_000).interaction).toBeNull();
    // Sin consumo de referencia no hay cifra combinada, pero sí el aviso
    expect(planSummary([medida('M1'), medida('M2')]).interaction?.combinedKwh).toBeNull();
  });

  it('sin medidas en el plan todo queda en cero y el retorno no existe', () => {
    const s = planSummary([medida('M1', { selected: false })], 1000);
    expect(s).toMatchObject({ count: 0, kwh: 0, cop: 0, investment: 0, byType: [], interaction: null });
    expect(s.paybackYears).toBe(Number.POSITIVE_INFINITY);
  });
});
