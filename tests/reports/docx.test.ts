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
      '2. Alcance, frontera y limitaciones',
      '3. Caracterización de la entidad y del edificio',
      '4. Metodología',
      '5. Uso de la energía: históricos y comportamiento',
      '6. Usos significativos y balance energético',
      '7. Línea base e indicadores de desempeño',
      '8. Sistemas y equipos de consumo final',
      '9. Mediciones puntuales',
      '10. Diagnóstico energético',
      '11. Seguridad eléctrica y SST',
      '12. Potencial de ahorro y oportunidades',
      '13. Conclusiones y recomendaciones',
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
    expect(text).toContain('Potencial de ahorro por clase (art. 4, aspecto (d), de la Resolución 40412 de 2024).');
    expect(text).toContain('Evaluación económica de las medidas (retorno simple, valor presente neto y tasa interna de retorno).');
    expect(text).toContain('La prioridad se sugiere por el retorno simple');
    expect(text).toContain('Priorización de las medidas, con su responsable y plazo.');
    expect(text).toContain('Transformador T1: carga crítica');
    expect(text).toContain('Iluminación fluorescente T8 de baja eficiencia');
    expect(text).toContain('M1 · Cambio a iluminación LED (206 luminarias)');
    // La foto del hallazgo va con él; las demás siguen la numeración en el anexo
    const annex = text.indexOf('Registro fotográfico');
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

  it('la seguridad eléctrica tiene su propio capítulo con la matriz del RETIE y avisa lo que pide atención; no entra en las conclusiones de ahorro', async () => {
    const db = createDb('pontia-prueba-docx-seguridad');
    const ejemplo = await createSampleProject(db);
    await saveRecord(db, 'safetyFindings', {
      id: 's-tablero',
      projectId: ejemplo.id,
      foundAt: '2026-09-10',
      riskFactor: 'contacto-directo',
      real: true,
      consequences: { personas: 4 },
      consequence: 4,
      frequency: 'c',
      confirmed: true,
      highRisk: true,
      imminent: false,
      precedent: 'Contacto con partes energizadas en un tablero abierto de una sede comparable',
      evaluator: 'Ingeniero electricista del área de mantenimiento',
      description: 'El tablero de un laboratorio no tiene tapa y hay partes energizadas al alcance',
      immediateAction: 'Señalizar y restringir el acceso hasta instalar la tapa',
      recommendedAction: 'Instalar tapa y etiquetar el tablero',
      control: 'ingenieria',
      responsible: 'Jefe de mantenimiento',
      dueDate: '2026-10-15',
      status: 'abierto',
      auto: false,
    });
    await saveRecord(db, 'safetyFindings', {
      id: 's-cerrado',
      projectId: ejemplo.id,
      foundAt: '2026-09-11',
      riskFactor: 'cortocircuito',
      real: false,
      consequences: { economicas: 2 },
      consequence: 2,
      frequency: 'd',
      highRisk: false,
      imminent: false,
      description: 'Protección sin la capacidad de corte adecuada en el tablero auxiliar',
      status: 'cerrado',
      auto: false,
    });
    const model = buildAuditModel(await loadReportData(db, ejemplo.id, new Date(2026, 8, 12)));
    // Del más urgente al menos urgente: el de alto riesgo va primero
    expect(model.data.safetyFindings.map((f) => f.id)).toEqual(['s-tablero', 's-cerrado']);
    expect(model.safety.summary).toMatchObject({ total: 2, open: 1, closed: 1, highRisk: 1, attention: 1 });

    const figures = auditFigures(model);
    expect(figures.map((f) => f.id)).toContain('matriz-riesgos');
    const assets: AuditAssets = { figures: new Map(figures.map((f, i) => [f.id, { data: Uint8Array.from([...PIXEL, i]), width: f.width, height: f.height }])), photos: [] };
    const zip = await JSZip.loadAsync(await Packer.toBuffer(buildAuditDocument(model, figures, assets)));
    const text = ((await zip.file('word/document.xml')?.async('string')) ?? '').replace(/<[^>]+>/g, '');

    // Aviso en el resumen ejecutivo, sin importar el ahorro
    expect(text).toContain('1 hallazgo de seguridad eléctrica pide atención inmediata');
    // Capítulo propio: qué norma, la matriz, la tabla y el detalle de lo que pide atención
    expect(text).toContain('11. Seguridad eléctrica');
    expect(text).toContain('art. 1.5.1.4.1');
    expect(text).toContain('no reemplaza el dictamen de inspección del RETIE');
    expect(text).toContain('1 de alto riesgo');
    expect(text).toContain('Matriz de riesgos de origen eléctrico');
    expect(text).toContain('Hallazgos de seguridad eléctrica, del más urgente al menos urgente.');
    expect(text).toContain('S1 · Contacto directo');
    expect(text).toContain('Decisión del RETIE.');
    expect(text).toContain('Señalizar y restringir el acceso hasta instalar la tapa');
    expect(text).toContain('Contacto con partes energizadas en un tablero abierto de una sede comparable');
    // Lo cerrado consta en la tabla del capítulo, con su estado, pero no se detalla como pendiente
    expect(text).toContain('S2');
    expect(text).toContain('Cerrado');
    expect(text).not.toContain('Protección sin la capacidad de corte adecuada');
    expect(text).toContain('Los hallazgos de seguridad eléctrica no se incluyen en el potencial de ahorro ni en la priorización de las medidas.');
    // Las conclusiones de ahorro no repiten la sobrecarga ni el desbalance
    const conclusiones = text.slice(text.indexOf('13. Conclusiones y recomendaciones'));
    expect(conclusiones).not.toContain('Transformador T1: carga crítica');
    db.close();
  });

  it('sin hallazgos ni situaciones de seguridad, el informe no abre el capítulo y la numeración no salta', async () => {
    const db = createDb('pontia-prueba-docx-sin-seguridad');
    const ejemplo = await createSampleProject(db);
    // Sin sobrecarga ni desbalance en los datos y sin hallazgos registrados
    const base = buildAuditModel(await loadReportData(db, ejemplo.id, new Date(2026, 8, 12)));
    const sinSituaciones = { ...base, safety: { summary: base.safety.summary, suggestions: [] } };
    const zip = await JSZip.loadAsync(await Packer.toBuffer(buildAuditDocument(sinSituaciones, [], { figures: new Map(), photos: [] })));
    const text = ((await zip.file('word/document.xml')?.async('string')) ?? '').replace(/<[^>]+>/g, '');
    expect(text).not.toContain('Seguridad eléctrica');
    expect(text).toContain('12. Conclusiones y recomendaciones');

    // Si el auditor revisó y no encontró nada, el capítulo lo dice
    const revisada = { ...sinSituaciones, data: { ...sinSituaciones.data, project: { ...sinSituaciones.data.project, safetyReviewed: true } } };
    const zipRevisada = await JSZip.loadAsync(await Packer.toBuffer(buildAuditDocument(revisada, [], { figures: new Map(), photos: [] })));
    const textRevisada = ((await zipRevisada.file('word/document.xml')?.async('string')) ?? '').replace(/<[^>]+>/g, '');
    expect(textRevisada).toContain('11. Seguridad eléctrica y SST');
    expect(textRevisada).toContain('El auditor revisó la seguridad eléctrica de la instalación y no registró hallazgos.');
    expect(textRevisada).toContain('13. Conclusiones y recomendaciones');
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
