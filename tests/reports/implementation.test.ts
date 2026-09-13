import 'fake-indexeddb/auto';
import { Packer } from 'docx';
import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import { createSampleProject } from '@/db/sampleProject';
import { createDb } from '@/db/schema';
import { loadReportData } from '@/reports/data';
import { buildImplementationDocument } from '@/reports/docx/implementation';
import { implementationFigures } from '@/reports/implementationFigures';
import { buildAuditModel } from '@/reports/model';

const PIXEL = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='), (c) => c.charCodeAt(0));

describe('plan de implementación en Word', () => {
  it('arma el cronograma, el presupuesto, el flujo de caja y el seguimiento del ejemplo', async () => {
    const db = createDb('pontia-prueba-implementacion');
    const ejemplo = await createSampleProject(db);
    const data = await loadReportData(db, ejemplo.id, new Date(2026, 8, 12));
    expect(data.tasks).toHaveLength(8);

    const figures = implementationFigures(data.tasks, data.measures, data.project.economics, '2026-09-12');
    expect(figures.map((f) => f.id)).toEqual(['cronograma', 'flujo-de-caja']);
    const assets = { figures: new Map(figures.map((f, i) => [f.id, { data: Uint8Array.from([...PIXEL, i]), width: f.width, height: f.height }])) };
    const zip = await JSZip.loadAsync(await Packer.toBuffer(buildImplementationDocument(buildAuditModel(data), { tasks: data.tasks, measures: data.measures }, figures, assets)));
    const text = ((await zip.file('word/document.xml')?.async('string')) ?? '').replace(/<[^>]+>/g, '');

    expect(text).toContain('PLAN DE IMPLEMENTACIÓN');
    for (const section of ['1. Alcance del plan', '2. Cronograma', '3. Presupuesto y financiación', '4. Flujo de caja', '5. Responsables e indicadores', '6. Seguimiento']) {
      expect(text).toContain(section);
    }
    // Tareas propuestas, responsables, financiación y las dos figuras
    expect(text).toContain('M3 · Diseño y contratación');
    expect(text).toContain('Servicios Generales');
    expect(text).toContain('Incentivos de la Ley 1715 de 2014');
    expect(text).toContain('Figura 2.');
    // El ejemplo arranca en septiembre de 2026 y termina en julio de 2028
    expect(text).toContain('1 sep 2026');
    expect(text).toContain('28 jul 2028');
    db.close();
  });
});
