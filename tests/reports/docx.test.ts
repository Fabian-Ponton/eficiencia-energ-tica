import 'fake-indexeddb/auto';
import { Packer } from 'docx';
import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import { createSampleProject } from '@/db/sampleProject';
import { createDb } from '@/db/schema';
import type { Photo } from '@/domain/types';
import { loadReportData } from '@/reports/data';
import { buildAuditDocument, type AuditAssets } from '@/reports/docx/audit';
import { auditFigures } from '@/reports/figures';
import { buildAuditModel } from '@/reports/model';

/** PNG de 1 × 1 píxel. A cada imagen se le agrega un byte distinto al final para que no se confundan. */
const PIXEL = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='), (c) => c.charCodeAt(0));

describe('informe Word de auditoría', () => {
  it('arma un .docx con portada, índice, secciones numeradas, figuras, tablas y fotos', async () => {
    const db = createDb('pontia-prueba-docx');
    const ejemplo = await createSampleProject(db);
    const model = buildAuditModel(await loadReportData(db, ejemplo.id, new Date(2026, 8, 12)));
    const figures = auditFigures(model);
    const photo = (id: string, entityType: Photo['entityType'], entityId: string, caption: string, tail: number): AuditAssets['photos'][number] => ({
      photo: { id, projectId: ejemplo.id, createdAt: 0, updatedAt: 0, entityType, entityId, kind: 'estado-fisico', takenAt: '2026-09-10T10:00', blob: new Blob([]) },
      data: Uint8Array.from([...PIXEL, tail]),
      width: 1,
      height: 1,
      type: 'png',
      caption,
    });
    const [hallazgo] = model.data.findings;
    const assets: AuditAssets = {
      figures: new Map(figures.map((f, i) => [f.id, { data: Uint8Array.from([...PIXEL, i]), width: f.width, height: f.height }])),
      photos: [photo('foto-equipo', 'equipo', 'x', 'Placa del aire del aula 601', 200), photo('foto-hallazgo', 'hallazgo', hallazgo.id, 'Luminarias T8 del aula 601', 201)],
    };

    const buffer = await Packer.toBuffer(buildAuditDocument(model, figures, assets));
    const zip = await JSZip.loadAsync(buffer);
    const xml = (await zip.file('word/document.xml')?.async('string')) ?? '';
    const text = xml.replace(/<[^>]+>/g, '');

    expect(text).toContain('INFORME DE AUDITORÍA ENERGÉTICA');
    expect(text).toContain('Bloque 6 · Aulas y laboratorios (ejemplo)');
    for (const section of [
      '1. Resumen ejecutivo',
      '4. Comportamiento del consumo',
      '5. Balance energético y usos significativos',
      '7. Dimensionamiento y capacidad',
      '8. Mediciones puntuales',
      '9. Diagnóstico',
      '10. Oportunidades de ahorro',
      '11. Conclusiones y recomendaciones',
    ]) {
      expect(text).toContain(section);
    }
    expect(text).toContain('186.400');
    expect(text).toContain(`Figura ${figures.length}.`);
    expect(text).toContain('Tabla 1.');
    expect(text).toContain('Transformador T1: carga crítica');
    expect(text).toContain('Iluminación fluorescente T8 de baja eficiencia');
    expect(text).toContain('M1 · Cambio a iluminación LED (206 luminarias)');
    // La foto del hallazgo va con él; las demás siguen la numeración en el anexo
    const annex = text.indexOf('Anexo fotográfico');
    const findingPhoto = text.indexOf('Foto 1. Luminarias T8 del aula 601');
    expect(findingPhoto).toBeGreaterThan(-1);
    expect(findingPhoto).toBeLessThan(annex);
    expect(text.indexOf('Foto 2. Placa del aire del aula 601')).toBeGreaterThan(annex);
    // Campo del índice con los títulos de nivel 1 y 2 y enlaces (el orden de los modificadores y el escape de las comillas varían)
    const toc = /<w:instrText[^>]*>([^<]*TOC[^<]*)<\/w:instrText>/.exec(xml)?.[1] ?? '';
    expect(toc).toMatch(/\\o (&quot;|")1-2(&quot;|")/);
    expect(toc).toContain('\\h');
    // Una imagen por figura y por foto (JSZip también lista la carpeta; se cuentan solo los archivos)
    expect(Object.values(zip.files).filter((entry) => !entry.dir && entry.name.startsWith('word/media/'))).toHaveLength(figures.length + 2);
    // La portada usa su propio encabezado y pie vacíos
    expect(xml).toContain('w:titlePg');
    db.close();
  });

  it('la caracterización de la entidad sale en la tabla 1; si falta, el informe queda como borrador', async () => {
    const db = createDb('pontia-prueba-docx-entidad');
    const ejemplo = await createSampleProject(db);
    const leer = async () => {
      const model = buildAuditModel(await loadReportData(db, ejemplo.id, new Date(2026, 8, 12)));
      const buffer = await Packer.toBuffer(buildAuditDocument(model, [], { figures: new Map(), photos: [] }));
      const xml = (await (await JSZip.loadAsync(buffer)).file('word/document.xml')?.async('string')) ?? '';
      return xml.replace(/<[^>]+>/g, '');
    };

    // El ejemplo no trae edad, actividad, entorno ni tenencia: el informe lo dice y no inventa nada
    const incompleto = await leer();
    expect(incompleto).toContain('ESTADO');
    expect(incompleto).toContain('Borrador · faltan datos de la caracterización de la entidad');
    expect(incompleto).toContain('está incompleta. Faltan:');
    expect(incompleto).toContain('entorno de la edificación');
    expect(incompleto).toContain('tenencia del edificio');
    expect(incompleto).toContain('La tenencia del edificio está por confirmar');

    await db.projects.update(ejemplo.id, {
      entity: { kind: 'publica', order: 'territorial' },
      site: { name: 'Sede Riohacha', upmeCode: 'SEDE-01' },
      operatingHours: 'Lunes a viernes, 07:00 – 21:00',
      address: 'Calle 1 # 2-3',
      building: { builtYear: 1998, floors: 2, activity: 'Docencia y prácticas de laboratorio', surroundings: 'Campus urbano', tenure: 'arrendada' },
      scope: { boundary: 'El edificio de laboratorios y su acometida.', fnce: 'potencial' },
    });
    const completo = await leer();
    expect(completo).not.toContain('Borrador');
    expect(completo).toContain('Pública · orden territorial');
    expect(completo).toContain('Sede Riohacha · código SEDE-01');
    expect(completo).toContain('1998 (28 años) · 2 pisos');
    expect(completo).toContain('Docencia y prácticas de laboratorio');
    // Edificio arrendado: la restricción de la Res. 40412 queda escrita en el informe
    expect(completo).toContain('Edificio en arrendamiento');
    expect(completo).toContain('solo se pueden implementar medidas asociadas a buenas prácticas de operación');
    expect(completo).toContain('Frontera de la auditoría');
    expect(completo).toContain('El edificio de laboratorios y su acometida.');
    db.close();
  });
});
