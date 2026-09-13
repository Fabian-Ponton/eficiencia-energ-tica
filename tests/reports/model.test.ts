import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { createSampleProject } from '@/db/sampleProject';
import { createDb } from '@/db/schema';
import { loadReportData } from '@/reports/data';
import { auditFigures } from '@/reports/figures';
import { buildAuditModel } from '@/reports/model';

describe('contenido del informe de auditoría', () => {
  it('reúne los cálculos del proyecto de ejemplo y sus hallazgos', async () => {
    const db = createDb('pontia-prueba-informe');
    const ejemplo = await createSampleProject(db);
    const data = await loadReportData(db, ejemplo.id, new Date(2026, 8, 12));
    const model = buildAuditModel(data);

    expect(data.mainSeries?.series.wholeFacility).toBe(true);
    expect(model.referenceKwh).toBe(186_400);
    expect(model.kpis[0]).toMatchObject({ label: 'Consumo anual', value: '186.400', unit: 'kWh/año' });
    expect(model.significant.length).toBeGreaterThan(0);
    expect(model.cooling).toHaveLength(7);
    expect(model.lighting).toHaveLength(7);

    const titles = model.findings.map((f) => f.title);
    expect(titles).toContain('Transformador T1: carga crítica');
    expect(titles).toContain('Aires acondicionados con capacidad insuficiente');
    expect(titles).toContain('Iluminancia por debajo de la requerida');
    expect(titles).toContain('Desbalance de fases en TD-AA · Aires acondicionados');
    // Del más grave al más leve
    expect(model.findings[0].tone).toBe('critical');
    expect(model.findings.find((f) => f.title.startsWith('Aires'))?.detail).toContain('Aula 604');
    db.close();
  });

  it('prepara una figura por cada análisis disponible', async () => {
    const db = createDb('pontia-prueba-informe-figuras');
    const ejemplo = await createSampleProject(db);
    const figures = auditFigures(buildAuditModel(await loadReportData(db, ejemplo.id)));
    expect(figures.map((f) => f.id)).toEqual([
      'consumo-mensual',
      'tendencia-anual',
      'curva-de-carga',
      'mapa-de-calor',
      'pareto-usos',
      'flujo-energia',
      'linea-base',
      'climatizacion',
      'iluminacion',
      'unifilar',
    ]);
    const diagram = figures.find((f) => f.id === 'unifilar');
    expect(diagram?.width).toBeGreaterThan(600);
    db.close();
  });

  it('rechaza un proyecto que no existe', async () => {
    const db = createDb('pontia-prueba-informe-vacio');
    await expect(loadReportData(db, 'no-existe')).rejects.toThrow('no existe');
    db.close();
  });
});
