import 'fake-indexeddb/auto';
import { Packer } from 'docx';
import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import { summarizeProject } from '@/db/projects';
import { createSampleLab } from '@/db/sampleLab';
import { createSampleProject } from '@/db/sampleProject';
import { createDb, type PontiaDb } from '@/db/schema';
import { verifyArt4 } from '@/domain/art4';
import { isLabType } from '@/domain/catalogs';
import { savingsTypeOf } from '@/domain/measures';
import { checkCompliance, groupStatus } from '@/domain/compliance';
import { computeProgress } from '@/domain/progress';
import { retieSaveProblem } from '@/domain/retie';
import { upmeReadiness } from '@/domain/upmeReport';
import { art4Input, labRows, regimeSummary } from '@/reports/auditParts';
import { loadReportData } from '@/reports/data';
import { buildAuditDocument, type AuditAssets } from '@/reports/docx/audit';
import { buildImplementationDocument } from '@/reports/docx/implementation';
import { buildPgeeDocument } from '@/reports/docx/pgee';
import { auditFigures } from '@/reports/figures';
import { implementationFigures } from '@/reports/implementationFigures';
import { buildAuditModel } from '@/reports/model';
import { pgeeFigures } from '@/reports/pgeeFigures';
import { reportRoute } from '@/reports/route';
import { buildUpmePackage, upmeTables } from '@/reports/upme/package';

const PIXEL = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='), (c) => c.charCodeAt(0));
const TODAY = new Date(2026, 8, 30);

async function crear(nombre: string) {
  const db = createDb(nombre);
  const lab = await createSampleLab(db, Date.UTC(2026, 8, 15));
  const data = await loadReportData(db, lab.id, TODAY);
  const model = buildAuditModel(data);
  const route = reportRoute(model, { pgee: data.pgee, measures: data.measures, tasks: data.tasks });
  return { db, lab, data, model, route };
}

const textoDe = async (doc: Awaited<ReturnType<typeof Packer.toBuffer>> | ReturnType<typeof buildAuditDocument>) => {
  const buffer = doc instanceof Uint8Array || Buffer.isBuffer(doc as never) ? (doc as Uint8Array) : await Packer.toBuffer(doc as never);
  const zip = await JSZip.loadAsync(buffer);
  return ((await zip.file('word/document.xml')?.async('string')) ?? '').replace(/<[^>]+>/g, '');
};

/** Los identificadores son UUID al azar: un segmento de 8 o 12 cifras seguidas se confundiría con una cédula. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Todos los textos que el ejemplo guarda, para revisar que no traiga datos personales. */
async function textosDelEjemplo(db: PontiaDb, projectId: string): Promise<string[]> {
  const out: string[] = [];
  const visit = (value: unknown, key = '') => {
    if (typeof value === 'string') {
      if (!UUID.test(value) && !['id', 'projectId', 'seriesId', 'equipmentId', 'areaId', 'panelId', 'parentId', 'measureId', 'entityId', 'taskId', 'createdAt', 'updatedAt'].includes(key)) out.push(`${key}: ${value}`);
    } else if (Array.isArray(value)) value.forEach((v) => visit(v, key));
    else if (value && typeof value === 'object' && !(value instanceof Blob)) for (const [k, v] of Object.entries(value)) visit(v, k);
  };
  for (const table of ['projects', 'areas', 'equipment', 'electrical', 'measurements', 'findings', 'safetyFindings', 'occupancy', 'maintenance', 'baselineAdjustments', 'measures', 'pgee', 'tasks'] as const) {
    const rows = table === 'projects' ? await db.projects.where('id').equals(projectId).toArray() : await (db[table] as never as { where: (k: string) => { equals: (v: string) => { toArray: () => Promise<unknown[]> } } }).where('projectId').equals(projectId).toArray();
    visit(rows, table);
  }
  return out;
}

describe('ejemplo «Laboratorios · Sede Riohacha»', () => {
  it('trae cinco laboratorios de tipos distintos, equipos de 24 horas, gas natural y horarios por periodo académico', async () => {
    const { db, data, model } = await crear('pontia-prueba-lab-datos');
    expect(data.project).toMatchObject({ name: 'Laboratorios · Sede Riohacha (ejemplo)', code: 'LAB-01', entity: { kind: 'publica' }, building: { tenure: 'propia' } });
    const labs = labRows(model);
    // Los espacios salen ordenados por nombre: cómputo, electrónica, microbiología, química y taller
    expect(labs.map((l) => l.area.spaceType)).toEqual(['lab-computo', 'lab-electronica', 'lab-biologia', 'lab-quimica', 'lab-mecanica']);
    expect(new Set(labs.map((l) => l.area.spaceType)).size).toBe(5);
    expect(labs.every((l) => isLabType(l.area.spaceType) && l.units > 0)).toBe(true);
    // Equipos que no se pueden apagar y de 24 horas
    const regimes = regimeSummary(data.equipment);
    expect(regimes.rows.map((r) => r.regime)).toEqual(['horario', 'continuo', 'ciclos', 'respaldo']);
    expect(regimes.nonInterruptibleUnits).toBe(7);
    expect(regimes.rows.find((r) => r.regime === 'continuo')?.units).toBe(11);
    // Gas natural: 12 facturas y los equipos que lo usan, aparte de lo eléctrico
    expect(data.otherBills).toHaveLength(12);
    expect(data.otherBills.every((b) => b.carrier === 'gas-natural' && b.unit === 'm3')).toBe(true);
    // Los equipos salen de la base en el orden de su identificador (aleatorio): se comparan ordenados
    expect(data.otherEquipment.map((e) => e.name).sort()).toEqual(['Baño de agua a gas', 'Mechero Bunsen']);
    expect(data.equipment.every((e) => !e.carrier)).toBe(true);
    // Horarios de uso de dos periodos académicos
    expect([...new Set(data.occupancy.map((o) => o.term))].sort()).toEqual(['2026-1', '2026-2']);
    expect(new Set(data.occupancy.map((o) => o.areaId)).size).toBe(5);
    db.close();
  });

  it('la facturación cubre 36 meses, el censo explica lo facturado con un margen de ±10 % y la línea base es estadística con un ajuste declarado', async () => {
    const { db, data, model } = await crear('pontia-prueba-lab-consumo');
    expect(data.bills).toHaveLength(36);
    expect(data.bills[0].period).toBe('2023-10');
    expect(data.bills.at(-1)?.period).toBe('2026-09');
    expect(Math.abs(model.deviation ?? 1)).toBeLessThan(0.1);
    expect(model.billedAnnualKwh).toBe(164_339);
    expect(model.upme).toMatchObject({ kind: 'estadistico', months: 36 });
    expect(data.baselineAdjustments).toHaveLength(1);
    expect(data.baselineAdjustments[0]).toMatchObject({ kind: 'no-rutinario', applied: true, months: ['2024-06', '2024-07'] });
    // Las variables de la línea base y de los indicadores de actividad vienen en todas las facturas
    expect(data.bills.every((b) => b.workingDays && b.occupancyPct && b.avgTemperatureC && b.populationServed && b.practiceHours)).toBe(true);
    // Hay registro de analizador de una semana completa
    expect(model.daily).not.toBeNull();
    db.close();
  });

  it('las medidas cubren las clases de potencial, incluido el apagado con sus exclusiones, y la ruta anual supera el 15 % el primer año', async () => {
    const { db, data, model, route } = await crear('pontia-prueba-lab-plan');
    expect(data.measures.map((m) => [m.code, savingsTypeOf(m), m.selected])).toEqual([
      ['M1', 'cambio-tecnologico', true],
      ['M2', 'cambio-tecnologico', true],
      ['M3', 'bpo', true],
      ['M4', 'bpo', true],
      ['M5', 'sustitucion-energetico', false],
    ]);
    const apagado = data.measures.find((m) => m.code === 'M3')!;
    expect(apagado.title).toMatch(/^Programa de apagado y control de horarios/);
    expect(apagado.description).toContain('Se excluyen los ultracongeladores, las neveras, los servidores y las incubadoras.');
    // Plan: BPO y cambio tecnológico; la sustitución queda como potencial y las FNCER como dato de referencia
    expect(model.plan.byType.map((t) => t.type)).toEqual(['bpo', 'cambio-tecnologico']);
    expect(model.fnce.kind).toBe('potencial');
    expect(model.fnce.text).toContain('840 m²');
    // Ruta anual: 2027 con tres medidas por encima del mínimo legal y 2028 con la reposición de los aires
    expect(route.rows.map((r) => [r.year, r.measureCodes])).toEqual([
      [2027, ['M1', 'M3', 'M4']],
      [2028, ['M2']],
    ]);
    expect(route.firstYear).toMatchObject({ year: 2027, meets: true });
    expect(route.firstYear!.plannedPct).toBeGreaterThan(15);
    expect(data.pgee?.energyManager).toMatchObject({ role: 'Gestor energético', appointmentDoc: 'Resolución de ejemplo (sin número)' });
    expect(data.pgee?.annualRoute).toHaveLength(2);
    db.close();
  });

  it('la seguridad eléctrica trae hallazgos abiertos, uno de alto riesgo con su antecedente y uno cerrado, y las tareas de obra llevan la verificación del RETIE', async () => {
    const { db, data, model } = await crear('pontia-prueba-lab-seguridad');
    expect(model.safety.summary).toMatchObject({ total: 4, open: 3, closed: 1, highRisk: 1, attention: 2 });
    const alto = data.safetyFindings.find((f) => f.highRisk)!;
    expect(alto).toMatchObject({ riskFactor: 'contacto-directo', confirmed: true });
    expect(alto.precedent).toBeTruthy();
    expect(alto.evaluator).toContain('(ejemplo)');
    // Situaciones de los datos por valorar: el circuito de las neveras, el tablero de electrónica y su desbalance
    expect(model.safety.suggestions.length).toBe(3);
    // Tareas con obra: la de iluminación en revisión con su declaración de diseño y la de aires pendiente
    const obras = data.tasks.filter((t) => t.works);
    expect(obras.map((t) => [t.retie?.status, t.executor?.registry?.body])).toEqual([
      ['en-revision', 'CONTE'],
      ['pendiente', 'CONTE'],
    ]);
    expect(obras[0].retie?.documents[0]).toMatchObject({ kind: 'declaracion-diseno', result: 'cumple' });
    // Ninguna obra está marcada como implementada sin su verificación
    expect(obras.every((t) => t.status !== 'implementada' || !retieSaveProblem(t))).toBe(true);
    db.close();
  });

  it('no trae datos personales: sin cédulas, correos ni números de matrícula, y los responsables son roles o llevan «(ejemplo)»', async () => {
    const { db, lab, data } = await crear('pontia-prueba-lab-privacidad');
    const textos = await textosDelEjemplo(db, lab.id);
    expect(textos.length).toBeGreaterThan(200);
    // Ni números largos que parezcan una cédula o un teléfono ni correos electrónicos
    expect(textos.filter((t) => /\b\d{7,}\b/.test(t.replace(/^[^:]+: /, '').replace(/900\.000\.000-0/, '')))).toEqual([]);
    expect(textos.filter((t) => t.includes('@'))).toEqual([]);
    // Las matrículas de los ejecutores no traen número
    for (const t of data.tasks) expect(t.executor?.registry?.number).toBeUndefined();
    // Quienes ejecutan y designan son empresas o dependencias de ejemplo
    const ejecutores = data.tasks.map((t) => t.executor?.name).filter(Boolean) as string[];
    expect(ejecutores.every((n) => n.includes('(ejemplo)'))).toBe(true);
    expect(data.pgee?.energyManager?.name).toContain('(ejemplo)');
    db.close();
  });
});

describe('ejemplo de laboratorios en los informes y la verificación', () => {
  it('el informe de auditoría abre las trece secciones, con los cinco laboratorios, su inventario y la verificación del artículo 4', async () => {
    const { db, model } = await crear('pontia-prueba-lab-informe');
    const figures = auditFigures(model);
    const assets: AuditAssets = { figures: new Map(figures.map((f, i) => [f.id, { data: Uint8Array.from([...PIXEL, i]), width: f.width, height: f.height }])), photos: [] };
    const text = await textoDe(buildAuditDocument(model, figures, assets));
    for (const s of [
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
      'Anexo A. Inventario por laboratorio',
      'Anexo B. Verificación del artículo 4 de la Resolución 40412',
    ]) {
      expect(text).toContain(s);
    }
    expect(text).toContain('El proyecto tiene 5 laboratorios y talleres.');
    for (const lab of ['Laboratorio de química', 'Laboratorio de microbiología', 'Laboratorio de electrónica y eléctrica', 'Laboratorio de cómputo', 'Taller de mecánica y materiales']) {
      expect(text).toContain(`Inventario de ${lab}.`);
    }
    expect(text).toContain('5.1 Energéticos utilizados');
    expect(text).toContain('Energéticos incluidos: electricidad y gas natural.');
    expect(text).toContain('11 equipos funcionan las 24 horas');
    expect(text).toContain('7 unidades no pueden apagarse y se excluyen de las medidas de apagado');
    expect(text).toContain('Periodo base: 36 meses');
    expect(text).toContain('Modelo seleccionado: modelo estadístico');
    expect(text).toContain('El gestor energético del PGEE, Jefatura de la Oficina de Planeación (ejemplo), hace el seguimiento de los indicadores.');
    // El único punto que queda pendiente es el perfil del auditor, que vive en el equipo de quien audita
    expect(text).toContain('Verificación de la Resolución 40412: 9 de 10 puntos se cumplen con lo registrado. Falta completar: art. 6.');
    expect(figures.map((f) => f.id)).toContain('consumo-laboratorios');
    db.close();
  });

  it('la verificación del artículo 4 cumple nueve de diez puntos y el reporte a la UPME solo espera el perfil del auditor', async () => {
    const { db, lab, data, model, route } = await crear('pontia-prueba-lab-upme');
    const rows = verifyArt4(art4Input(model, route));
    expect(rows.filter((r) => r.status === 'cumple').map((r) => r.id)).toEqual(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'par2', 'par3']);
    expect(rows.find((r) => r.id === 'art6')?.status).toBe('pendiente');
    // Caracterización, PGEE y ruta: las listas de la norma están completas
    const grupos = checkCompliance({ project: data.project, pgee: data.pgee, firstYear: route.firstYear });
    expect(grupos.filter((g) => g.id !== 'art6').every((g) => groupStatus(g).complete)).toBe(true);
    const readiness = upmeReadiness({ project: data.project, pgee: data.pgee, firstYear: route.firstYear, upme: model.upme, measures: data.measures });
    expect(readiness.missing.map((i) => i.id)).toEqual(['auditor']);
    // Paquete de datos: plantilla 4 (modelo estadístico) y metas de 2027 y 2028
    const tables = upmeTables(model, { cycle: { year: 2026 }, route });
    expect(tables.map((t) => t.id)).toEqual(['leame', 'edificacion', 'plantilla-1', 'plantilla-4', 'lben-resumen', 'plantilla-5', 'metas']);
    expect(tables.find((t) => t.id === 'plantilla-1')?.rows).toHaveLength(48);
    expect(tables.find((t) => t.id === 'metas')?.rows).toHaveLength(2);
    const paquete = await buildUpmePackage(model, { cycle: { year: 2026, caseNumber: 'C-EJEMPLO' }, route });
    expect(paquete.fileName).toBe('ART237_2026_C-EJEMPLO_Paquete de datos.xlsx');
    // El avance del proyecto: levantamiento, análisis y plan con datos; el reporte a la UPME sin registrar
    const resumen = await summarizeProject(db, data.project);
    const informes = resumen.progress.find((p) => p.id === 'informes');
    expect(informes?.steps.map((s) => s.id)).toEqual(['informes', 'reporte-upme']);
    expect(computeProgress).toBeTypeOf('function');
    void lab;
    db.close();
  });

  it('el PGEE y el plan de implementación salen con el gestor, las dos etapas de la ruta y la verificación del RETIE de cada obra', async () => {
    const { db, data, model, route } = await crear('pontia-prueba-lab-pgee');
    const plan = data.measures.filter((m) => m.selected);
    const figures = pgeeFigures(plan, route);
    const pgee = await textoDe(buildPgeeDocument(model, { pgee: data.pgee, measures: data.measures, findings: data.findings, tasks: data.tasks }, figures, { figures: new Map(figures.map((f) => [f.id, { data: PIXEL, width: f.width, height: f.height }])) }));
    expect(pgee).toContain('Jefatura de la Oficina de Planeación (ejemplo)');
    // El primer año de la ruta supera el mínimo legal del 15 %
    expect(pgee).toMatch(/el primer año \(2027\) prevé un ahorro de 16[.,]\d %: alcanza el mínimo legal del 15 %/);
    expect(pgee).toContain('Ruta de cumplimiento anual');
    expect(pgee).toContain('7. Monitoreo, reporte y verificación');
    const implFigures = implementationFigures(data.tasks, data.measures, data.project.economics, '2026-09-30');
    const impl = await textoDe(buildImplementationDocument(model, { tasks: data.tasks, measures: data.measures }, implFigures, { figures: new Map(implFigures.map((f) => [f.id, { data: PIXEL, width: f.width, height: f.height }])) }));
    expect(impl).toContain('6. Ejecución y cumplimiento del RETIE');
    expect(impl).toContain('Contratista de iluminación (ejemplo)');
    expect(impl).toContain('Contratista de climatización (ejemplo)');
    db.close();
  });

  it('el ejemplo de aulas sigue igual: crear el de laboratorios no toca sus datos', async () => {
    const db = createDb('pontia-prueba-lab-aulas');
    const aulas = await createSampleProject(db);
    const antes = buildAuditModel(await loadReportData(db, aulas.id, TODAY));
    await createSampleLab(db);
    const despues = buildAuditModel(await loadReportData(db, aulas.id, TODAY));
    expect(despues.billedAnnualKwh).toBe(antes.billedAnnualKwh);
    expect(despues.estimatedAnnualKwh).toBe(antes.estimatedAnnualKwh);
    expect(await db.projects.count()).toBe(2);
    db.close();
  });
});
