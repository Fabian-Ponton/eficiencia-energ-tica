import { describe, expect, it } from 'vitest';
import { baselineSummary, computeUpmeBaseline } from '@/domain/upmeBaseline';
import type { BaselineAdjustment } from '@/domain/types';
import { CONSUMO, CONSUMO_ANEXO4_AÑO2, facturasAnexo, periodo } from './fixtures/upme016';

const ajuste = (months: string[], applied = true): BaselineAdjustment => ({
  id: 'aj-1',
  projectId: 'anexo',
  createdAt: 0,
  updatedAt: 0,
  carrier: 'electricidad',
  kind: 'no-rutinario',
  date: '2025-11-01',
  cause: 'Aires acondicionados fuera de servicio por reparación',
  months,
  applied,
});

const proyecto = { areaM2: 2458, sector: 'Alcaldía municipal', building: { floors: 5 } };

describe('línea base de un proyecto', () => {
  it('con solo el consumo usa el valor absoluto y reproduce el resumen del Anexo 1', () => {
    const baseline = computeUpmeBaseline({ bills: facturasAnexo(), project: proyecto })!;
    expect(baseline.kind).toBe('valor-absoluto');
    expect(baseline.recommended).toBe('valor-absoluto');
    expect(baseline.available).toEqual(['valor-absoluto']);
    expect(baseline.months).toBe(36);
    expect(baseline.from).toBe('2023-01');
    expect(baseline.to).toBe('2025-12');
    expect(baseline.headline.baselineKwhYear as number).toBeCloseTo(11_388.44 * 12, 0);
    expect(baseline.headline.savingPct as number).toBeCloseTo(0.041, 3);
    expect(baseline.headline.savingKwhYear as number).toBeCloseTo(467.6 * 12, -1);
    // 36 meses, todos con días y dentro de la banda: sin avisos
    expect(baseline.warnings).toEqual([]);
    expect(baseline.attributes.find((a) => a.attribute === 'Cantidad de datos iniciales')?.description).toBe('36');
    expect(baseline.attributes.find((a) => a.attribute === 'Uso/destino del edificio')?.description).toBe('Alcaldía municipal');
    expect(baselineSummary(baseline)).toContain('36 meses');
  });

  it('con personas por mes recomienda el cociente y ofrece el estadístico', () => {
    const bills = facturasAnexo({ personas: true });
    const recomendado = computeUpmeBaseline({ bills })!;
    expect(recomendado.kind).toBe('cociente');
    expect(recomendado.ratioVariable).toBe('personas');
    expect(recomendado.available).toEqual(['valor-absoluto', 'cociente', 'estadistico']);
    expect(recomendado.ratio?.ratioUnit).toBe('kWh/persona');
    expect(recomendado.headline.savingKwhYear as number).toBeGreaterThan(0);
    // El auditor puede volver al valor absoluto
    expect(computeUpmeBaseline({ bills, config: { model: 'valor-absoluto' } })!.kind).toBe('valor-absoluto');
  });

  it('con el modelo estadístico descarta los grados-día y reproduce el potencial de 3,44 % del Anexo 3', () => {
    const baseline = computeUpmeBaseline({ bills: facturasAnexo({ personas: true, gde: true }), config: { model: 'estadistico' } })!;
    expect(baseline.kind).toBe('estadistico');
    expect(baseline.recommended).toBe('estadistico');
    expect(baseline.statistical?.variables).toEqual(['personas']);
    expect(baseline.headline.savingPct as number).toBeCloseTo(0.0344, 3);
    expect(baseline.warnings.some((w) => w.text.includes('Grados-día de enfriamiento') && w.text.includes('descartó'))).toBe(true);
    expect(baseline.warnings.some((w) => w.text.includes('R² de 0,25'))).toBe(true);
    expect(baseline.attributes.find((a) => a.attribute === 'Modelo de LBEn seleccionado')?.description).toBe('Modelo estadístico (regresión lineal)');
    expect(baseline.attributes.find((a) => a.attribute === 'Variable relevante')?.description).toBe('Personas atendidas por mes');
  });

  it('un periodo base de menos de 36 meses pide la justificación', () => {
    const bills = facturasAnexo().slice(0, 12);
    const sinNota = computeUpmeBaseline({ bills })!;
    expect(sinNota.warnings[0]).toMatchObject({ tone: 'warning' });
    expect(sinNota.warnings[0].text).toContain('12 meses');
    const conNota = computeUpmeBaseline({ bills, config: { note: 'El medidor se cambió en enero de 2025' } })!;
    expect(conNota.warnings[0]).toMatchObject({ tone: 'info' });
    expect(conNota.warnings[0].text).toContain('El medidor se cambió');
  });

  it('el periodo base se puede recortar con el primer y el último mes', () => {
    const baseline = computeUpmeBaseline({ bills: facturasAnexo(), config: { from: '2024-01', to: '2025-12' } })!;
    expect(baseline.months).toBe(24);
    expect(baseline.from).toBe('2024-01');
    expect(computeUpmeBaseline({ bills: facturasAnexo(), config: { from: '2030-01' } })).toBeNull();
    expect(computeUpmeBaseline({ bills: [] })).toBeNull();
  });

  it('avisa de los datos fuera de la banda y, con el ajuste no rutinario declarado, los corrige como el Anexo 4', () => {
    const consumo = { 1: CONSUMO[1], 2: CONSUMO_ANEXO4_AÑO2, 3: CONSUMO[3] };
    const bills = facturasAnexo({ consumo });
    const sin = computeUpmeBaseline({ bills })!;
    expect(sin.warnings.some((w) => w.text.includes('fuera de la banda') && w.text.includes('se eliminaron'))).toBe(true);
    expect(sin.monthly!.finalCount).toBeLessThan(36);

    const mesesAfectados = [5, 6, 7, 8, 9].map((m) => periodo(2, m));
    const con = computeUpmeBaseline({ bills, adjustments: [ajuste(mesesAfectados)] })!;
    expect(con.appliedAdjustments).toHaveLength(1);
    expect(con.monthly!.finalCount).toBe(36);
    expect(con.monthly!.adjustments[0].proportion).toBeCloseTo(0.2175, 4);
    expect(con.headline.savingPct as number).toBeGreaterThan(0.04);
    expect(con.headline.savingPct as number).toBeLessThan(0.044);
    expect(con.warnings.some((w) => w.text.includes('Ajuste no rutinario de 5 meses de 2024'))).toBe(true);
    expect(con.warnings.some((w) => w.text.includes('fuera de la banda'))).toBe(false);

    // Un ajuste que no se marcó como aplicado no cambia el cálculo
    const sinAplicar = computeUpmeBaseline({ bills, adjustments: [ajuste(mesesAfectados, false)] })!;
    expect(sinAplicar.appliedAdjustments).toHaveLength(0);
    expect(sinAplicar.monthly!.finalCount).toBe(sin.monthly!.finalCount);
  });

  it('conservar los datos fuera de la banda los deja en el cálculo', () => {
    const consumo = { 1: CONSUMO[1], 2: CONSUMO_ANEXO4_AÑO2, 3: CONSUMO[3] };
    const conservado = computeUpmeBaseline({ bills: facturasAnexo({ consumo }), config: { keepOutliers: true } })!;
    expect(conservado.monthly!.finalCount).toBe(36);
    expect(conservado.warnings.some((w) => w.text.includes('se conservaron'))).toBe(true);
    // Sin ajuste el potencial queda sobrestimado (Anexo 4: 9,35 %)
    expect(conservado.headline.savingPct as number).toBeGreaterThan(0.09);
  });

  it('un ajuste de otro energético o borrado no se aplica', () => {
    const bills = facturasAnexo({ consumo: { 1: CONSUMO[1], 2: CONSUMO_ANEXO4_AÑO2, 3: CONSUMO[3] } });
    const meses = [5, 6, 7, 8, 9].map((m) => periodo(2, m));
    expect(computeUpmeBaseline({ bills, adjustments: [{ ...ajuste(meses), carrier: 'gas-natural' }] })!.appliedAdjustments).toHaveLength(0);
    expect(computeUpmeBaseline({ bills, adjustments: [{ ...ajuste(meses), deletedAt: 5 }] })!.appliedAdjustments).toHaveLength(0);
  });

  it('las facturas sin días no se normalizan y el aviso lo dice; faltan meses y se avisa', () => {
    // Sin octubre, noviembre ni diciembre y con tres facturas sin sus días
    const bills = facturasAnexo()
      .filter((b) => Number(b.period.slice(5)) <= 9)
      .map((b, i) => (i < 3 ? { ...b, days: undefined } : b));
    const baseline = computeUpmeBaseline({ bills, config: { note: 'Solo hay 27 facturas' } })!;
    expect(baseline.warnings.some((w) => w.text.includes('3 facturas no traen los días facturados'))).toBe(true);
    expect(baseline.warnings.some((w) => w.text.startsWith('Faltan datos de octubre, noviembre y diciembre'))).toBe(true);
    expect(baseline.monthly!.complete).toBe(false);
  });
});
