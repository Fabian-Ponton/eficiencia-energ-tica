import 'fake-indexeddb/auto';
import { Packer, type Document } from 'docx';
import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import { saveRecord } from '@/db/records';
import { createSampleProject } from '@/db/sampleProject';
import { createDb } from '@/db/schema';
import type { Measure } from '@/domain/types';
import { loadReportData } from '@/reports/data';
import { buildPgeeDocument } from '@/reports/docx/pgee';
import { buildAuditModel } from '@/reports/model';
import { pgeeFigures } from '@/reports/pgeeFigures';

const PIXEL = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='), (c) => c.charCodeAt(0));

/** Texto del cuerpo del documento, sin etiquetas. */
async function documentText(doc: Document): Promise<string> {
  const zip = await JSZip.loadAsync(await Packer.toBuffer(doc));
  return ((await zip.file('word/document.xml')?.async('string')) ?? '').replace(/<[^>]+>/g, '');
}

const assetsFor = (figures: ReturnType<typeof pgeeFigures>) => ({ figures: new Map(figures.map((f) => [f.id, { data: PIXEL, width: f.width, height: f.height }])) });

describe('PGEE en Word', () => {
  it('arma el plan con la estructura de la ISO 50001 y solo las medidas incluidas', async () => {
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
    for (const section of ['1. Política energética', '3. Equipo de gestión de la energía', '4. Revisión energética', '5. Objetivos y metas energéticas', '6. Planes de acción', '9. Seguimiento, medición y verificación']) {
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
    db.close();
  });
});
