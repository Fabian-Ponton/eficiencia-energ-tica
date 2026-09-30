import 'fake-indexeddb/auto';
import { Packer } from 'docx';
import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import { updateProject } from '@/db/projects';
import { saveRecord } from '@/db/records';
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
    // La línea base sale con el método de la UPME: modelo, periodo, banda de ±10 %, tabla mensual y datos a reportar
    expect(text).toContain('Línea base de consumo energético (Res. UPME 016 de 2024)');
    expect(text).toContain('Periodo base: 24 meses');
    expect(text).toContain('Resultado de la regresión de la línea base (nivel de confianza del 95 %).');
    expect(text).toContain('Información de la línea base para reportar a la UPME.');
    expect(text).toContain('Cantidad de datos iniciales');
    expect(text).toContain('Regresión de la línea base (ISO 50006), complemento');
    // Oportunidades: FNCER sin decidir, potencial por clase, VPN y TIR, y priorización con sus criterios
    expect(text).toContain('Potencial de FNCER');
    expect(text).toContain('Potencial de FNCER (solar fotovoltaica, dato de referencia): la cubierta disponible de');
    expect(text).toContain('Potencial de ahorro por clase (art. 4, literal d, de la Resolución 40412 de 2024).');
    expect(text).toContain('Evaluación económica de las medidas (retorno simple, valor presente neto y tasa interna de retorno).');
    expect(text).toContain('La prioridad se sugiere por el retorno simple');
    expect(text).toContain('Priorización de las medidas, con su responsable y plazo.');
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

  it('la línea base con el modelo de valor absoluto trae la tabla mensual con la banda de ±10 % y el ajuste declarado', async () => {
    const db = createDb('pontia-prueba-docx-lben');
    const ejemplo = await createSampleProject(db);
    await updateProject(db, ejemplo.id, { baseline: { model: 'valor-absoluto', note: 'El ejemplo solo tiene dos años de facturas' } });
    await saveRecord(db, 'baselineAdjustments', { id: 'aj', projectId: ejemplo.id, carrier: 'electricidad', kind: 'no-rutinario', date: '2026-06-01', cause: 'Aires fuera de servicio', months: ['2025-05', '2025-06'], applied: true });
    const model = buildAuditModel(await loadReportData(db, ejemplo.id, new Date(2026, 8, 12)));
    expect(model.upme?.kind).toBe('valor-absoluto');
    const figures = auditFigures(model);
    const assets: AuditAssets = { figures: new Map(figures.map((f, i) => [f.id, { data: Uint8Array.from([...PIXEL, i]), width: f.width, height: f.height }])), photos: [] };
    const zip = await JSZip.loadAsync(await Packer.toBuffer(buildAuditDocument(model, figures, assets)));
    const text = ((await zip.file('word/document.xml')?.async('string')) ?? '').replace(/<[^>]+>/g, '');
    expect(text).toContain('Modelo seleccionado: valor absoluto de energía');
    expect(text).toContain('Línea base mensual (kWh/mes) y potencial de ahorro por mejor desempeño.');
    expect(text).toContain('LÍMITE INFERIOR');
    expect(text).toContain('Ajustes y actualizaciones de la línea base.');
    expect(text).toContain('Aires fuera de servicio');
    // Con menos de 36 meses y una justificación escrita, el informe la cita
    expect(text).toContain('El ejemplo solo tiene dos años de facturas');
    db.close();
  });

  it('con el edificio en arriendo y la FNCER excluida, el informe dice qué medidas no pueden entrar al plan y por qué se excluye', async () => {
    const db = createDb('pontia-prueba-docx-tenencia');
    const ejemplo = await createSampleProject(db);
    await updateProject(db, ejemplo.id, {
      building: { tenure: 'arrendada' },
      entity: { kind: 'publica' },
      scope: { fnce: 'excluida', fnceNote: 'la cubierta pertenece al arrendador' },
    });
    const model = buildAuditModel(await loadReportData(db, ejemplo.id, new Date(2026, 8, 12)));
    const figures = auditFigures(model);
    const assets: AuditAssets = { figures: new Map(figures.map((f, i) => [f.id, { data: Uint8Array.from([...PIXEL, i]), width: f.width, height: f.height }])), photos: [] };
    const zip = await JSZip.loadAsync(await Packer.toBuffer(buildAuditDocument(model, figures, assets)));
    const text = ((await zip.file('word/document.xml')?.async('string')) ?? '').replace(/<[^>]+>/g, '');
    expect(text).toContain('quedan por fuera del alcance de esta auditoría: la cubierta pertenece al arrendador');
    expect(text).toContain('Edificio en arrendamiento: según el parágrafo 3 del artículo 3 de la Resolución 40412 de 2024');
    // Solo las buenas prácticas de operación (M4, el programa de apagado) pueden entrar al plan
    expect(text).toContain('no pueden entrar al plan y se reportan solo como potencial: M1, M2, M3 y M5');
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
