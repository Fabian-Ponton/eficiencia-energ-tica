import { describe, expect, it } from 'vitest';
import { baselineByMonth, followUp, followUpYears } from '@/domain/followUp';
import type { Bill } from '@/domain/types';
import type { UpmeBaseline } from '@/domain/upmeBaseline';

const factura = (period: string, kwh: number, days = 30): Bill => ({ id: period, projectId: 'p', createdAt: 0, updatedAt: 0, period, kwh, costCop: kwh * 850, days });
const anio = (year: number, values: number[]): Bill[] => values.map((kwh, i) => factura(`${year}-${String(i + 1).padStart(2, '0')}`, kwh));
const doce = (kwh: number) => Array.from({ length: 12 }, () => kwh);

/** LBEn mínima: solo lo que lee el seguimiento. */
const lbenAbsoluta = (kwh: number) => ({ kind: 'valor-absoluto', monthly: { months: Array.from({ length: 12 }, (_, i) => ({ month: i + 1, baseline: kwh })) } }) as unknown as UpmeBaseline;

describe('años de seguimiento', () => {
  it('son los años con facturas desde el primero de la ruta, el más reciente primero', () => {
    const facturas = [...anio(2026, doce(10_000)), ...anio(2027, [9000, 9000]), ...anio(2028, [8000])];
    expect(followUpYears(facturas, 2027)).toEqual([2028, 2027]);
    expect(followUpYears(facturas, 2029)).toEqual([]);
    expect(followUpYears([], 2027)).toEqual([]);
  });
});

describe('ahorro real frente al año anterior (la meta legal del 15 %)', () => {
  const previo = anio(2026, doce(10_000));

  it('compara solo los meses que tienen factura en los dos años', () => {
    const r = followUp({ bills: [...previo, ...anio(2027, [8000, 8000, 8000])], year: 2027, targetPct: 15, referenceKwh: 120_000 });
    expect(r).toMatchObject({ year: 2027, covered: 3, complete: false, comparedMonths: 3, actualKwh: 24_000, previousKwh: 30_000, savingKwh: 6000 });
    expect(r.savingPct).toBeCloseTo(0.2, 10);
    expect(r.months.map((m) => [m.period, m.actualKwh, m.previousKwh])).toEqual([
      ['2027-01', 8000, 10_000],
      ['2027-02', 8000, 10_000],
      ['2027-03', 8000, 10_000],
    ]);
  });

  it('va en ruta con el 20 % y por debajo con el 13,75 %; dice cuánto falta para la meta anual', () => {
    const enRuta = followUp({ bills: [...previo, ...anio(2027, [8000, 8000, 8000])], year: 2027, targetPct: 15, referenceKwh: 120_000 });
    expect(enRuta.status).toBe('en-ruta');
    // La meta anual es el 15 % de 120.000 kWh = 18.000; ya se ahorraron 6.000
    expect(enRuta.targetKwh).toBe(18_000);
    expect(enRuta.remainingKwh).toBe(12_000);

    const atrasado = followUp({ bills: [...previo, ...anio(2027, [8000, 8000, 8000, 10_500])], year: 2027, targetPct: 15, referenceKwh: 120_000 });
    expect(atrasado.status).toBe('atrasado');
    expect(atrasado.savingPct).toBeCloseTo(5500 / 40_000, 10);
    expect(atrasado.remainingKwh).toBe(12_500);
    // Faltan 12.500 kWh sobre los 80.000 que se consumieron en los ocho meses que quedan del año anterior
    expect(atrasado.requiredPct).toBeCloseTo(12_500 / 80_000, 10);
  });

  it('con los doce meses, la meta se cumple o no se alcanza', () => {
    expect(followUp({ bills: [...previo, ...anio(2027, doce(8500))], year: 2027, targetPct: 15, referenceKwh: 120_000 }).status).toBe('cumplida');
    const noAlcanzada = followUp({ bills: [...previo, ...anio(2027, doce(9500))], year: 2027, targetPct: 15, referenceKwh: 120_000 });
    expect(noAlcanzada.status).toBe('no-alcanzada');
    expect(noAlcanzada.complete).toBe(true);
    expect(noAlcanzada.savingPct).toBeCloseTo(0.05, 10);
    expect(noAlcanzada.remainingKwh).toBe(12_000);
    expect(noAlcanzada.requiredPct).toBeNull();
  });

  it('exactamente el porcentaje de la meta cuenta como cumplido', () => {
    expect(followUp({ bills: [...previo, ...anio(2027, [8500])], year: 2027, targetPct: 15, referenceKwh: 120_000 }).status).toBe('en-ruta');
  });

  it('sin facturas del año, sin año anterior o sin meta no hay veredicto', () => {
    expect(followUp({ bills: previo, year: 2027, targetPct: 15, referenceKwh: 120_000 })).toMatchObject({ status: 'sin-datos', covered: 0, savingPct: null });
    const sinPrevio = followUp({ bills: anio(2027, [8000, 8000]), year: 2027, targetPct: 15, referenceKwh: 100_000 });
    expect(sinPrevio).toMatchObject({ status: 'sin-comparacion', comparedMonths: 0, savingPct: null });
    // Sin el año anterior completo, la meta anual se toma del consumo de referencia
    expect(sinPrevio.targetKwh).toBe(15_000);
    expect(followUp({ bills: [...previo, ...anio(2027, [8000])], year: 2027, targetPct: null, referenceKwh: 120_000 })).toMatchObject({ status: 'sin-meta', targetKwh: null, remainingKwh: null });
  });

  it('un mes que consume más que el año anterior resta del ahorro', () => {
    const r = followUp({ bills: [...previo, ...anio(2027, [12_000, 8000])], year: 2027, targetPct: 15, referenceKwh: 120_000 });
    expect(r.savingKwh).toBe(0);
    expect(r.savingPct).toBe(0);
    expect(r.status).toBe('atrasado');
    // Lo ahorrado en negativo no baja lo que falta por debajo de la meta completa
    expect(r.remainingKwh).toBe(18_000);
  });

  it('un mes sin el mismo mes del año anterior queda en el año pero no se compara', () => {
    const r = followUp({ bills: [...anio(2026, [10_000, 10_000]), ...anio(2027, [8000, 8000, 8000])], year: 2027, targetPct: 15, referenceKwh: 120_000 });
    expect(r.covered).toBe(3);
    expect(r.comparedMonths).toBe(2);
    expect(r.months[2].previousKwh).toBeNull();
  });
});

describe('ahorro real frente a la línea base', () => {
  it('normaliza el consumo a 30 días y compara con la LBEn del mes', () => {
    const previo = anio(2026, doce(10_000));
    // El mes de 31 días consumió 9.300 kWh: normalizado a 30 días son 9.000, un 10 % menos que la LBEn de 10.000
    const r = followUp({ bills: [...previo, factura('2027-01', 9300, 31), factura('2027-02', 9000, 30)], year: 2027, targetPct: 15, referenceKwh: 120_000, baseline: lbenAbsoluta(10_000) });
    expect(r.months[0].actual30Kwh).toBeCloseTo(9000, 10);
    expect(r.baselineMonths).toBe(2);
    expect(r.baselineSavingPct).toBeCloseTo(0.1, 10);
  });

  it('sin línea base o con el modelo estadístico no hay comparación mensual', () => {
    const previo = anio(2026, doce(10_000));
    const bills = [...previo, ...anio(2027, [9000])];
    expect(followUp({ bills, year: 2027, targetPct: 15, referenceKwh: 120_000 })).toMatchObject({ baselineMonths: 0, baselineSavingPct: null });
    const estadistico = { kind: 'estadistico' } as unknown as UpmeBaseline;
    expect(followUp({ bills, year: 2027, targetPct: 15, referenceKwh: 120_000, baseline: estadistico }).baselineSavingPct).toBeNull();
  });

  it('el modelo de cociente entrega su LBEn en kWh por mes', () => {
    const cociente = { kind: 'cociente', ratio: { baselineKwh: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, null] } } as unknown as UpmeBaseline;
    expect(baselineByMonth(cociente)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, null]);
    expect(baselineByMonth(lbenAbsoluta(10_000))).toEqual(doce(10_000));
    expect(baselineByMonth(null)).toEqual(Array.from({ length: 12 }, () => null));
  });
});
