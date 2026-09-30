import 'fake-indexeddb/auto';
import { Packer, type Document } from 'docx';
import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import { saveRecord } from '@/db/records';
import { createSampleProject } from '@/db/sampleProject';
import { createDb } from '@/db/schema';
import type { Measure, Pgee } from '@/domain/types';
import { loadReportData } from '@/reports/data';
import { buildPgeeDocument } from '@/reports/docx/pgee';
import { buildAuditModel } from '@/reports/model';
import { pgeeFigures } from '@/reports/pgeeFigures';
import { reportRoute } from '@/reports/route';

const PIXEL = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='), (c) => c.charCodeAt(0));

/** Texto del cuerpo del documento, sin etiquetas. */
async function documentText(doc: Document): Promise<string> {
  const zip = await JSZip.loadAsync(await Packer.toBuffer(doc));
  return ((await zip.file('word/document.xml')?.async('string')) ?? '').replace(/<[^>]+>/g, '');
}

const assetsFor = (figures: ReturnType<typeof pgeeFigures>) => ({ figures: new Map(figures.map((f) => [f.id, { data: PIXEL, width: f.width, height: f.height }])) });

describe('PGEE en Word', () => {
  it('arma el plan con las siete etapas de la guía de la UPME y solo las medidas incluidas', async () => {
    const db = createDb('pontia-prueba-pgee');
    const ejemplo = await createSampleProject(db);
    const measure = (id: string, code: string, title: string, selected: boolean, extra: Partial<Measure> = {}): Measure => ({
      id,
      projectId: ejemplo.id,
      createdAt: 0,
      updatedAt: 0,
      code,
      title,
      category: 'iluminacion',
      kind: 'baja-inversion',
      savingsKwhYear: 480,
      savingsCopYear: 408_000,
      investmentCop: 1_440_000,
      annualCostCop: 0,
      lifetimeYears: 12,
      selected,
      priority: 'alta',
      findingIds: [],
      ...extra,
    });
    const measures = [measure('m1', 'M1', 'Cambio a LED en las aulas', true), measure('m2', 'M2', 'Medida descartada de prueba', false, { priority: 'baja' })];
    for (const x of measures) await saveRecord(db, 'measures', x);
    await saveRecord(db, 'pgee', {
      id: 'g1',
      projectId: ejemplo.id,
      policy: 'La universidad se compromete con la eficiencia energética.',
      team: [{ role: 'Líder de gestión de la energía', name: 'Ana Pérez' }],
      objectives: [{ description: 'Reducir el consumo del bloque', targetPercent: 5, deadline: '2027-12-31' }],
    });

    const model = buildAuditModel(await loadReportData(db, ejemplo.id, new Date(2026, 8, 12)));
    const pgee = await db.pgee.get('g1');
    const figures = pgeeFigures(measures.filter((x) => x.selected));
    const text = await documentText(buildPgeeDocument(model, { pgee, measures, findings: [] }, figures, assetsFor(figures)));

    expect(text).toContain('PLAN DE GESTIÓN EFICIENTE DE LA ENERGÍA');
    for (const section of [
      '1. Decisión y marco legal',
      '1.1 Marco legal',
      '1.2 Política energética',
      '1.4 Gestor energético',
      '1.5 Equipo de gestión de la energía',
      '2. Diagnóstico energético',
      '2.1 Usos significativos de energía',
      '3. Formulación del plan',
      '3.1 Meta legal del primer año',
      '3.2 Objetivos y metas energéticas',
      '3.3 Ruta de cumplimiento anual',
      '4. Selección de proyectos',
      '5. Modelo financiero y contractual',
      '5.2 Modelos de financiación y contratación',
      '6. Implementación',
      '7. Monitoreo, reporte y verificación',
      '7.4 Seguimiento del ahorro real',
      '7.5 Reporte a la UPME',
    ]) {
      expect(text).toContain(section);
    }
    expect(text).toContain('La universidad se compromete con la eficiencia energética.');
    expect(text).toContain('Ana Pérez');
    expect(text).toContain('Reducir el consumo del bloque');
    // Meta del 5 % sobre los 186.400 kWh del año base
    expect(text).toContain('9.320 kWh/año');
    expect(text).toContain('M1 · Cambio a LED en las aulas');
    expect(text).not.toContain('Medida descartada de prueba');
    expect(text).toContain('Figura 1.');
    // Sin gestor designado, el documento lo pide y no inventa uno; la ruta sale como propuesta y avisa que no llega al 15 %
    expect(text).toContain('La entidad debe definir un responsable del seguimiento y la evaluación del plan');
    expect(text).toContain('la dirección debe designar al gestor y registrar el acto en PONTIA');
    expect(text).toContain('Meta legal del primer año frente a lo que prevé el plan.');
    expect(text).toContain('Ruta de cumplimiento anual de ahorro energético.');
    expect(text).toContain('Ruta propuesta por PONTIA con las fechas de las tareas y la prioridad de las medidas');
    expect(text).toContain('la ley pide al menos 15 %');
    db.close();
  });

  it('con gestor, ruta confirmada y modelos elegidos, el documento los da como decididos por la entidad', async () => {
    const db = createDb('pontia-prueba-pgee-decisiones');
    const ejemplo = await createSampleProject(db);
    const pgee: Pgee = (await db.pgee.where('projectId').equals(ejemplo.id).first())!;
    // El ejemplo trae gestor (sin persona real), ruta confirmada y tres modelos de financiación
    expect(pgee.energyManager?.role).toBe('Gestor energético');
    const data = await loadReportData(db, ejemplo.id, new Date(2026, 8, 12));
    const model = buildAuditModel(data);
    const plan = data.measures.filter((x) => x.selected);
    const figures = pgeeFigures(plan);
    const text = await documentText(buildPgeeDocument(model, { pgee, measures: data.measures, findings: data.findings, tasks: data.tasks }, figures, assetsFor(figures)));

    expect(text).toContain('El gestor energético del plan es Jefatura de la Oficina de Planeación (Gestor energético)');
    expect(text).toContain('Resolución de ejemplo (sin número)');
    expect(text).not.toContain('Falta registrar el acto y la fecha con que se designó al gestor.');
    // Marco legal con la ley, la resolución y la guía, y el plazo de la ley sin interpretar
    expect(text).toContain('Ley 1715 de 2014, art. 30 (modificado por la Ley 2294 de 2023, art. 237)');
    expect(text).toContain('Res. MME 40412 de 2024, art. 4, parágrafo 3');
    expect(text).toContain('Guía UPME de PGEE para entidades públicas (diciembre de 2020)');
    expect(text).toContain('Este documento no interpreta ese plazo');
    // Meta legal: 15 % de los 186.400 kWh del año anterior = 27.960 kWh/año, y el plan la supera el primer año
    expect(text).toContain('27.960 kWh/año');
    expect(text).toContain('Meta legal del primer año frente a lo que prevé el plan.');
    expect(text).toContain('Cumple');
    expect(text).toContain('2027 *');
    expect(text).toContain('M1, M3, M4');
    expect(text).not.toContain('Ruta propuesta por PONTIA');
    expect(text).toContain('Ruta de cumplimiento anual de ahorro');
    // Tipo de cada medida y la victoria temprana: el programa de apagado (tipo A, retorno menor de un año)
    expect(text).toContain('Tipo A (retorno menor de 1 año');
    expect(text).toContain('Victoria temprana.');
    expect(text).toContain('la candidata es M4 · Programa de apagado y control de horarios (Tipo A, 5.600 kWh/año)');
    // Modelos de financiación elegidos con su descripción, y el presupuesto de las tareas por fuente
    expect(text).toContain('La entidad considera estos caminos para pagar las medidas:');
    expect(text).toContain('Gastos de funcionamiento: Compras ordinarias de la entidad');
    expect(text).toContain('Ahorros reinvertidos: La Ley 1715 (art. 30)');
    expect(text).toContain('El instrumento jurídico de cada medida lo define la entidad');
    expect(text).toContain('Presupuesto de las tareas del plan de implementación por fuente de financiación.');
    // Implementación con el resumen del cronograma y el seguimiento con los documentos mínimos de la guía
    expect(text).toContain('El plan de implementación programa 8 tareas');
    expect(text).toContain('Indicadores de seguimiento del plan (matriz de reporte de la guía de la UPME).');
    expect(text).toContain('el acta de la reunión, con fecha, participantes y decisiones;');
    expect(text).toContain('Res. UPME 016 de 2024');
    db.close();
  });

  it('la ruta se dibuja como figura solo si hay filas, junto con la matriz de priorización', async () => {
    const db = createDb('pontia-prueba-pgee-figuras');
    const ejemplo = await createSampleProject(db);
    const data = await loadReportData(db, ejemplo.id, new Date(2026, 8, 12));
    const model = buildAuditModel(data);
    const plan = data.measures.filter((x) => x.selected);
    const ruta = reportRoute(model, { pgee: data.pgee, measures: data.measures, tasks: data.tasks });
    expect(pgeeFigures(plan, ruta).map((f) => f.id)).toEqual(['ruta-anual', 'matriz-priorizacion']);
    expect(pgeeFigures(plan).map((f) => f.id)).toEqual(['matriz-priorizacion']);
    expect(pgeeFigures([], ruta).map((f) => f.id)).toEqual(['ruta-anual']);
    db.close();
  });

  it('el proyecto de ejemplo trae un plan completo, con texto propuesto donde falta información', async () => {
    const db = createDb('pontia-prueba-pgee-ejemplo');
    const ejemplo = await createSampleProject(db);
    const data = await loadReportData(db, ejemplo.id, new Date(2026, 8, 12));
    const pgee = await db.pgee.where('projectId').equals(ejemplo.id).first();
    const plan = data.measures.filter((x) => x.selected);
    const figures = pgeeFigures(plan);
    const text = await documentText(buildPgeeDocument(buildAuditModel(data), { pgee, measures: data.measures, findings: data.findings }, figures, assetsFor(figures)));

    expect(plan.map((x) => x.code)).toEqual(['M1', 'M2', 'M3', 'M4']);
    expect(text).toContain('Vicerrectoría Administrativa y Financiera');
    expect(text).toContain('M4 · Programa de apagado y control de horarios');
    expect(text).not.toContain('Sensores de ocupación');
    // Cada medida dice qué hallazgo atiende
    expect(text).toContain('Atiende: Iluminación fluorescente T8 de baja eficiencia');
    // El seguimiento y la formación quedaron en blanco: van con el texto propuesto y la marca de aprobación
    expect(text).toContain('Texto propuesto por PONTIA');
    // Con las tareas del ejemplo, el documento las resume
    const conTareas = await documentText(buildPgeeDocument(buildAuditModel(data), { pgee, measures: data.measures, findings: data.findings, tasks: data.tasks }, figures, assetsFor(figures)));
    expect(conTareas).toContain('Avance ponderado');
    db.close();
  });
});
