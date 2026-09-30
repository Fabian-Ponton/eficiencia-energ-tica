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
    for (const section of ['1. Alcance del plan', '2. Cronograma', '3. Presupuesto y financiación', '4. Flujo de caja', '5. Responsables e indicadores', '6. Ejecución y cumplimiento del RETIE', '7. Seguimiento']) {
      expect(text).toContain(section);
    }
    // Ejecutores con su registro profesional (sin números de matrícula en el ejemplo)
    expect(text).toContain('6.1 Quién ejecuta');
    expect(text).toContain('Contratista de iluminación (ejemplo)');
    expect(text).toContain('CONTE · TE-1');
    expect(text).toContain('COPNIA · Ingeniero electricista');
    // Verificación del RETIE: régimen por la fecha de inicio de obra, estado y documentos
    expect(text).toContain('6.2 Verificación del RETIE');
    expect(text).toContain('la Resolución 40284 de 2026 si inicia desde el 1 de enero de 2026, y la Resolución 90708 de 2013 si inició antes');
    expect(text).toContain('RETIE de 2026');
    expect(text).toContain('Declaración de cumplimiento del diseño DD-ejemplo (cumple)');
    expect(text).toContain('De 3 tareas con obra eléctrica: 0 cumplen, 1 en revisión, 1 pendiente, 1 por definir, 0 sin cumplir y 0 donde no aplica.');
    expect(text).toContain('No decide qué documento aplica a cada instalación ni reemplaza el dictamen de inspección.');
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

  it('una tarea implementada sin el RETIE resuelto se señala con o sin justificación', async () => {
    const db = createDb('pontia-prueba-implementacion-retie');
    const ejemplo = await createSampleProject(db);
    const data = await loadReportData(db, ejemplo.id, new Date(2026, 8, 12));
    const instalacion = data.tasks.filter((t) => t.works);
    expect(instalacion).toHaveLength(3);
    // M1 implementada con justificación; M2 implementada sin nada; M3 verificada
    const tareas = data.tasks.map((t) => {
      const code = data.measures.find((x) => x.id === t.measureId)?.code;
      if (t.works && code === 'M1') return { ...t, status: 'implementada' as const, progress: 100, retie: { ...t.retie!, applies: 'si' as const, justification: 'Se energizó con permiso provisional mientras llega el dictamen' } };
      if (t.works && code === 'M2') return { ...t, status: 'implementada' as const, progress: 100 };
      if (t.works && code === 'M3') return { ...t, retie: { ...t.retie!, status: 'cumple' as const, verifiedBy: 'Organismo de inspección acreditado', verifiedAt: '2027-09-01', documents: [{ kind: 'dictamen-inspeccion' as const, reference: 'D-1', result: 'cumple' as const }] } };
      return t;
    });
    const zip = await JSZip.loadAsync(await Packer.toBuffer(buildImplementationDocument(buildAuditModel(data), { tasks: tareas, measures: data.measures }, [], { figures: new Map() })));
    const text = ((await zip.file('word/document.xml')?.async('string')) ?? '').replace(/<[^>]+>/g, '');
    expect(text).toContain('implementada sin la verificación del RETIE en «Cumple». Justificación: Se energizó con permiso provisional mientras llega el dictamen');
    expect(text).toContain('implementada sin el RETIE resuelto ni una justificación (Define si el RETIE aplica a esta intervención de la instalación eléctrica; si no aplica, explica por qué.)');
    expect(text).toContain('verificada por Organismo de inspección acreditado el 1 sep 2027.');
    expect(text).toContain('De 3 tareas con obra eléctrica: 1 cumple, 0 en revisión, 1 pendiente, 1 por definir, 0 sin cumplir y 0 donde no aplica.');
    db.close();
  });
});
