import 'fake-indexeddb/auto';
import { Packer } from 'docx';
import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import { updateProject } from '@/db/projects';
import { saveRecord } from '@/db/records';
import { createSampleProject } from '@/db/sampleProject';
import { createDb } from '@/db/schema';
import { saveAuditorProfile } from '@/db/settings';
import type { AuditorProfile } from '@/domain/types';
import { toCsv } from '@/reports/csv';
import { loadReportData } from '@/reports/data';
import { buildAuditDocument } from '@/reports/docx/audit';
import { buildPgeeDocument } from '@/reports/docx/pgee';
import { buildAuditModel } from '@/reports/model';
import { pgeeFigures } from '@/reports/pgeeFigures';
import { reportRoute } from '@/reports/route';
import { buildUpmeAnnexes, buildUpmePackage, upmeTables } from '@/reports/upme/package';

const PIXEL = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='), (c) => c.charCodeAt(0));
const csvLines = (table: { rows: unknown[]; columns: unknown[] }) => toCsv(table.rows as never[], table.columns as never[]).replace('﻿', '').split('\r\n');

const auditor: AuditorProfile = {
  kind: 'natural-externa',
  name: 'Auditor de ejemplo',
  identityDocs: true,
  training: [{ id: 't', kind: 'certificacion', institution: 'Organismo certificador de ejemplo', program: 'Auditor de sistemas de gestión de la energía', hours: 40, date: '2024-05-10', backed: true }],
  experience: [{ id: 'e', sector: 'oficial', description: 'Auditoría de un edificio público', year: 2025, certifier: 'Entidad de ejemplo', certifiedAt: '2025-11-20', backed: true }],
  copnia: { number: 'CO-99999', profession: 'Ingeniería eléctrica', status: 'vigente' },
  conte: { number: 'CT-88888', categories: ['TE-1'] },
};

async function contexto(nombre: string) {
  const db = createDb(nombre);
  const ejemplo = await createSampleProject(db);
  const data = await loadReportData(db, ejemplo.id, new Date(2026, 8, 12));
  const model = buildAuditModel(data);
  const route = reportRoute(model, { pgee: data.pgee, measures: data.measures, tasks: data.tasks });
  return { db, ejemplo, data, model, route };
}

describe('paquete de datos para el SUU (art. 237 de la Ley 2294)', () => {
  it('trae los datos de edificación y las hojas equivalentes a las plantillas 1 a 5, más las metas por año', async () => {
    const { db, model, route } = await contexto('pontia-prueba-upme-hojas');
    const tables = upmeTables(model, { cycle: { year: 2026, caseNumber: 'C-123' }, route });
    expect(tables.map((t) => t.id)).toEqual(['leame', 'edificacion', 'plantilla-1', 'plantilla-4', 'lben-resumen', 'plantilla-5', 'metas']);
    const filas = Object.fromEntries(tables.map((t) => [t.id, t.rows.length]));
    expect(filas).toMatchObject({ 'plantilla-1': 24, 'plantilla-5': 4, metas: 2 });

    // Léame: sede, ciclo y que PONTIA no envía nada
    const leame = csvLines(tables[0]).join('\n');
    expect(leame).toContain('Ciclo 2026 · caso C-123');
    expect(leame).toContain('PONTIA no envía nada al SUU');
    expect(leame).toContain('Las plantillas oficiales solo están en el SUU');

    // Plantilla 1: consumo y costo por mes, con la normalización a 30 días
    const [encabezado, primera] = csvLines(tables.find((t) => t.id === 'plantilla-1')!);
    expect(encabezado).toBe('Periodo;Energético;Cantidad facturada;Unidad;Energía (kWh);Costo (COP);Días facturados;Consumo normalizado a 30 días (kWh)');
    expect(primera.startsWith('2024-10;Electricidad;17900,0;kWh;17900,0;15215000;31;17322,6')).toBe(true);

    // Plantilla 5: las cuatro medidas del plan con su clase de potencial y las columnas por diligenciar
    const [medidasEncabezado, m1, , m3] = csvLines(tables.find((t) => t.id === 'plantilla-5')!);
    expect(medidasEncabezado.startsWith('Acción;Clase de potencial;Energético;Ahorro (kWh/año);')).toBe(true);
    expect(medidasEncabezado.endsWith(';Equipo;Marca o modelo;Referencia;Cantidad;Unidad;Valor unitario (COP);Fabricante;Proveedor;Función')).toBe(true);
    expect(m1.startsWith('M1 · Cambio a iluminación LED (206 luminarias);')).toBe(true);
    // La solar del ejemplo es FNCER, como la deja la calculadora
    expect(m3).toContain(';FNCER;Electricidad;');

    // Metas: el primer año ya supera el 15 % de la ley
    const [metasEncabezado, y2027] = csvLines(tables.find((t) => t.id === 'metas')!);
    expect(metasEncabezado).toBe('Año;Energético;Meta de ahorro (%);Meta de ahorro (kWh/año);Ahorro previsto (kWh/año);Medidas que entran;Presupuesto (COP);Mecanismo de financiación');
    expect(y2027).toBe('2027;Electricidad;20,8;38771;38941;M1, M3, M4;78600000;"Gastos de funcionamiento; Proyecto de inversión; Ahorros reinvertidos"');
    db.close();
  });

  it('el Excel y el zip de anexos salen con los nombres de la UPME', async () => {
    const { db, model, route } = await contexto('pontia-prueba-upme-archivos');
    const paquete = await buildUpmePackage(model, { cycle: { year: 2026, caseNumber: 'C-123' }, route });
    expect(paquete.fileName).toBe('ART237_2026_C-123_Paquete de datos.xlsx');
    const { default: ExcelJS } = await import('exceljs');
    const libro = new ExcelJS.Workbook();
    await libro.xlsx.load(await paquete.blob.arrayBuffer());
    expect(libro.worksheets.map((h) => h.name)).toEqual(['Léame', 'Datos de edificación', 'Plantilla 1 Consumos', 'Plantilla 4 LBEn estadístico', 'Resumen de la línea base', 'Plantilla 5 Medidas', 'Metas por año']);

    const anexos = await buildUpmeAnnexes(model, { cycle: { year: 2026 }, route });
    expect(anexos.fileName).toBe('ART237_2026_XXX_Anexos Auditorías.zip');
    const zip = await JSZip.loadAsync(anexos.blob);
    expect(Object.keys(zip.files).sort()).toEqual(['ART237_2026_XXX_Paquete de datos.xlsx', 'Formatos de recolección - BL-06.xlsx', 'LEEME.txt']);
    expect(await zip.file('LEEME.txt')?.async('string')).toContain('PONTIA no envía nada al SUU');
    db.close();
  }, 60_000);
});

describe('datos del auditor en el informe de auditoría', () => {
  const texto = async (model: ReturnType<typeof buildAuditModel>) => {
    const zip = await JSZip.loadAsync(await Packer.toBuffer(buildAuditDocument(model, [], { figures: new Map(), photos: [] })));
    return ((await zip.file('word/document.xml')?.async('string')) ?? '').replace(/<[^>]+>/g, '');
  };

  it('sin perfil no hay anexo del auditor', async () => {
    const { db, model } = await contexto('pontia-prueba-auditor-sin');
    expect(await texto(model)).not.toContain('Datos del auditor');
    db.close();
  });

  it('con perfil, el anexo trae tipo, formación, experiencia certificada, matrículas y la verificación del art. 6; nunca la cédula', async () => {
    const { db, ejemplo } = await contexto('pontia-prueba-auditor-con');
    await saveAuditorProfile(db, auditor);
    const model = buildAuditModel(await loadReportData(db, ejemplo.id, new Date(2026, 8, 12)));
    const text = await texto(model);
    expect(text).toContain('Anexo A. Datos del auditor');
    expect(text).toContain('Datos del auditor energético.');
    expect(text).toContain('Persona natural externa');
    expect(text).toContain('Auditor de ejemplo');
    expect(text).toContain('Certificación: Auditor de sistemas de gestión de la energía, Organismo certificador de ejemplo, 40 h (2024)');
    expect(text).toContain('Oficial: Auditoría de un edificio público (2025); certificada por Entidad de ejemplo el 20 nov 2025');
    expect(text).toContain('Matrícula profesional (COPNIA): Ingeniería eléctrica · Vigente · N.º CO-99999');
    expect(text).toContain('Matrícula técnica (CONTE): TE-1 · N.º CT-88888');
    expect(text).toContain('Reunido por la entidad contratante para su verificación');
    expect(text).toContain('Cumple los requisitos registrados');
    db.close();
  });

  it('el auditor puede ocultar los números de matrícula y un perfil incompleto avisa qué falta', async () => {
    const { db, ejemplo } = await contexto('pontia-prueba-auditor-oculto');
    await saveAuditorProfile(db, { ...auditor, hideRegistryNumbers: true, identityDocs: false, experience: [] });
    const model = buildAuditModel(await loadReportData(db, ejemplo.id, new Date(2026, 8, 12)));
    const text = await texto(model);
    expect(text).toContain('Matrícula profesional (COPNIA): Ingeniería eléctrica · Vigente');
    expect(text).not.toContain('CO-99999');
    expect(text).not.toContain('CT-88888');
    expect(text).toContain('Pendiente');
    expect(text).toContain('Faltan: cédula, RUT o certificado de existencia y representación legal reunido; experiencia de al menos una auditoría certificada por un tercero');
    expect(text).toContain('El perfil del auditor está incompleto');
    db.close();
  });

  it('el perfil del auditor no se guarda con los datos del proyecto: el respaldo no lo lleva', async () => {
    const { db, ejemplo } = await contexto('pontia-prueba-auditor-respaldo');
    await saveAuditorProfile(db, auditor);
    const { exportProjectZip } = await import('@/db/backup');
    const zip = await JSZip.loadAsync(await exportProjectZip(db, ejemplo.id));
    const todo = (await Promise.all(Object.values(zip.files).filter((f) => !f.dir).map((f) => f.async('string').catch(() => '')))).join('\n');
    expect(todo).not.toContain('CO-99999');
    expect(todo).not.toContain('Auditor de ejemplo');
    db.close();
  });
});

describe('seguimiento del ahorro real en el PGEE', () => {
  const texto = async (nombre: string, meses: number[] | null) => {
    const { db, ejemplo } = await contexto(nombre);
    // Facturas de 2027: el 20 % menos que las de 2026 en los meses que se dan
    if (meses) {
      const anterior = (await db.bills.where('projectId').equals(ejemplo.id).toArray()).filter((b) => b.period.startsWith('2026-'));
      for (const b of anterior.filter((x) => meses.includes(Number(x.period.slice(5))))) {
        await saveRecord(db, 'bills', { id: crypto.randomUUID(), projectId: ejemplo.id, period: b.period.replace('2026', '2027'), kwh: Math.round(b.kwh * 0.8), costCop: Math.round(b.costCop * 0.8), days: b.days });
      }
    }
    const data = await loadReportData(db, ejemplo.id, new Date(2027, 5, 15));
    const model = buildAuditModel(data);
    const plan = data.measures.filter((x) => x.selected);
    const route = reportRoute(model, { pgee: data.pgee, measures: data.measures, tasks: data.tasks });
    const figures = pgeeFigures(plan, route);
    const doc = buildPgeeDocument(model, { pgee: data.pgee, measures: data.measures, findings: data.findings, tasks: data.tasks }, figures, { figures: new Map(figures.map((f) => [f.id, { data: PIXEL, width: f.width, height: f.height }])) });
    const zip = await JSZip.loadAsync(await Packer.toBuffer(doc));
    db.close();
    return ((await zip.file('word/document.xml')?.async('string')) ?? '').replace(/<[^>]+>/g, '');
  };

  it('sin facturas posteriores a la auditoría, el documento lo dice', async () => {
    const text = await texto('pontia-prueba-seguimiento-sin', null);
    expect(text).toContain('7.4 Seguimiento del ahorro real');
    expect(text).toContain('Aún no hay facturas desde 2027, el primer año después de la auditoría.');
  });

  it('con tres meses de 2027, compara con 2026, con la meta del año y con la línea base', async () => {
    const text = await texto('pontia-prueba-seguimiento-con', [1, 2, 3]);
    expect(text).toContain('Con las facturas de 2027 (3 meses): el consumo es 20,0 % menor que el de 2026 en los 3 meses comparables');
    // La meta del primer año de la ruta del ejemplo es 20,8 %, sin redondear a 21: el 20 % va por debajo
    expect(text).toContain('la meta del año es de 20,8 % y el ahorro va por debajo de la meta');
    expect(text).toContain('Frente a la línea base, el ahorro es de 20,9 %.');
    expect(text).toContain('Consumo facturado de 2027 frente al año anterior.');
    expect(text).toContain('Se compara el consumo facturado, sin corregir por clima, ocupación ni cambios en la operación');
  });
});

describe('avance del proyecto con el paso del reporte a la UPME', () => {
  it('el ejemplo (sin tipo de entidad) cuenta el paso; con un ciclo con número de caso queda hecho y una entidad privada no lo cuenta', async () => {
    const { db, ejemplo } = await contexto('pontia-prueba-upme-avance');
    const { summarizeProject } = await import('@/db/projects');
    const pasos = async () => (await summarizeProject(db, (await db.projects.get(ejemplo.id))!)).progress.find((p) => p.id === 'informes')!.steps;
    expect(await pasos()).toEqual([
      { id: 'informes', done: false },
      { id: 'reporte-upme', done: false },
    ]);
    await saveRecord(db, 'upmeCycles', { id: 'c1', projectId: ejemplo.id, year: 2026, caseNumber: 'C-123' });
    expect((await pasos()).find((s) => s.id === 'reporte-upme')?.done).toBe(true);
    await updateProject(db, ejemplo.id, { entity: { kind: 'privada' } });
    expect((await pasos()).map((s) => s.id)).toEqual(['informes']);
    db.close();
  });
});
