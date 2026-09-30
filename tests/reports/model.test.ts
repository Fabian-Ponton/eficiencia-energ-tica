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

  it('la carga base de noche descuenta los equipos continuos y los que no se pueden apagar', async () => {
    const db = createDb('pontia-prueba-informe-carga-base');
    const ejemplo = await createSampleProject(db);
    const data = await loadReportData(db, ejemplo.id, new Date(2026, 8, 12));
    // Siete días con 12 kW toda la noche y 30 kW de 8 a 18 h: la carga base es el 40 % de la demanda máxima
    const readings = Array.from({ length: 7 * 24 }, (_, i) => {
      const start = new Date(2026, 8, 7 + Math.floor(i / 24), i % 24);
      return { start, kw: start.getHours() >= 8 && start.getHours() < 18 ? 30 : 12 };
    });
    const conCargaBase = { ...data, mainSeries: { series: { ...data.mainSeries!.series, intervalMinutes: 60 }, readings } };
    const titulos = (d: typeof conCargaBase) => buildAuditModel(d).findings.map((f) => f.title);
    expect(titulos(conCargaBase)).toContain('Carga base alta fuera del horario');

    // Con 9 kW de equipos que no se pueden apagar, solo quedan 3 kW evitables (10 %): deja de ser un hallazgo y pasa a ser una nota
    const laboratorio = { ...data.equipment[0], id: 'ultra', name: 'Ultracongelador', category: 'refrigeracion' as const, powerKw: 3, quantity: 3, useFactor: 1, nonInterruptible: true, regime: 'continuo' as const };
    const justificada = { ...conCargaBase, equipment: [...data.equipment, laboratorio] };
    const modelo = buildAuditModel(justificada);
    expect(modelo.findings.map((f) => f.title)).not.toContain('Carga base alta fuera del horario');
    const nota = modelo.findings.find((f) => f.title === 'Carga base explicada por equipos continuos');
    expect(nota?.tone).toBe('info');
    expect(nota?.detail).toContain('9,0 kW corresponden a equipos que funcionan las 24 horas o no se pueden apagar');

    // Con solo la mitad justificada, sigue siendo hallazgo y dice cuánto es evitable
    const parcial = buildAuditModel({ ...conCargaBase, equipment: [...data.equipment, { ...laboratorio, quantity: 1 }] }).findings.find((f) => f.title === 'Carga base alta fuera del horario');
    expect(parcial?.detail).toContain('Unos 3,0 kW son de equipos continuos');
    expect(parcial?.detail).toContain('los 9,0 kW restantes');
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
      'linea-base-upme',
      'linea-base',
      'climatizacion',
      'iluminacion',
      'unifilar',
      'matriz-priorizacion',
    ]);
    const diagram = figures.find((f) => f.id === 'unifilar');
    expect(diagram?.width).toBeGreaterThan(600);
    // La matriz del informe muestra todas las medidas evaluadas, también las que no están en el plan
    const matrix = figures.find((f) => f.id === 'matriz-priorizacion');
    expect(JSON.stringify(matrix?.option)).toContain('M5');
    db.close();
  });

  it('rechaza un proyecto que no existe', async () => {
    const db = createDb('pontia-prueba-informe-vacio');
    await expect(loadReportData(db, 'no-existe')).rejects.toThrow('no existe');
    db.close();
  });
});
