import 'fake-indexeddb/auto';
import { Packer } from 'docx';
import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import { addProject } from '@/db/projects';
import { saveRecord } from '@/db/records';
import { createSampleProject } from '@/db/sampleProject';
import { createDb, type PontiaDb } from '@/db/schema';
import { saveAuditorProfile } from '@/db/settings';
import { verifyArt4 } from '@/domain/art4';
import type { AuditorProfile, Photo } from '@/domain/types';
import { art4Input, dataLimits, followProposal, labInventory, labRows, regimeSummary } from '@/reports/auditParts';
import { loadReportData } from '@/reports/data';
import { buildAuditDocument, type AuditAssets } from '@/reports/docx/audit';
import { auditFigures } from '@/reports/figures';
import { buildAuditModel } from '@/reports/model';
import { reportRoute } from '@/reports/route';

const PIXEL = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='), (c) => c.charCodeAt(0));

const perfil: AuditorProfile = {
  kind: 'natural-externa',
  name: 'Auditor de ejemplo',
  identityDocs: true,
  training: [{ id: 't', kind: 'certificacion', institution: 'Organismo de ejemplo', program: 'Auditor de sistemas de gestión de la energía', backed: true }],
  experience: [{ id: 'e', sector: 'oficial', description: 'Auditoría de un edificio público', certifier: 'Entidad de ejemplo', certifiedAt: '2025-11-20', backed: true }],
};

/** El ejemplo con dos laboratorios más (química y microbiología), equipos continuos y de ciclos, y horarios de uso en uno de ellos. */
async function conLaboratorios(db: PontiaDb, projectId: string) {
  const now = Date.now();
  const stamp = (id: string) => ({ id, projectId, createdAt: now, updatedAt: now });
  await saveRecord(db, 'areas', { ...stamp('lab-q'), name: 'Laboratorio de química', spaceType: 'lab-quimica', lengthM: 10, widthM: 8, heightM: 3, occupants: 24, hoursPerDay: 8 });
  await saveRecord(db, 'areas', { ...stamp('lab-b'), name: 'Laboratorio de microbiología', spaceType: 'lab-biologia', lengthM: 9, widthM: 6, heightM: 3, occupants: 16, hoursPerDay: 10 });
  const equipo = (id: string, areaId: string, name: string, powerKw: number, quantity: number, hoursPerDay: number, extra = {}) => ({
    ...stamp(id),
    areaId,
    name,
    category: 'laboratorio' as const,
    powerKw,
    quantity,
    hoursPerDay,
    operatingDaysPerMonth: 22,
    useFactor: 0.8,
    condition: 'bueno' as const,
    ...extra,
  });
  await saveRecord(db, 'equipment', equipo('e1', 'lab-q', 'Campana de extracción', 0.75, 3, 8));
  await saveRecord(db, 'equipment', equipo('e2', 'lab-q', 'Ultracongelador de −80 °C', 0.9, 2, 24, { regime: 'continuo', nonInterruptible: true, brand: 'Marca ejemplo', model: 'UF-80', voltageV: 208, currentA: 6.5 }));
  await saveRecord(db, 'equipment', equipo('e3', 'lab-b', 'Incubadora', 0.4, 4, 24, { regime: 'continuo' }));
  await saveRecord(db, 'equipment', equipo('e4', 'lab-b', 'Autoclave', 3.5, 1, 3, { regime: 'ciclos' }));
  await saveRecord(db, 'occupancy', { ...stamp('o1'), areaId: 'lab-q', term: '2026-2', activity: 'Práctica de química general', day: 'L-V', start: '07:00', end: '15:00', hours: 8, avgOccupants: 20, usesAc: true, usesLighting: true });
}

async function preparar(nombre: string, prepare?: (db: PontiaDb, projectId: string) => Promise<void>) {
  const db = createDb(nombre);
  const ejemplo = await createSampleProject(db);
  await prepare?.(db, ejemplo.id);
  const model = buildAuditModel(await loadReportData(db, ejemplo.id, new Date(2026, 8, 12)));
  return { db, ejemplo, model };
}

const textoDe = async (model: ReturnType<typeof buildAuditModel>, photos: AuditAssets['photos'] = []) => {
  const figures = auditFigures(model);
  const assets: AuditAssets = { figures: new Map(figures.map((f, i) => [f.id, { data: Uint8Array.from([...PIXEL, i]), width: f.width, height: f.height }])), photos };
  const zip = await JSZip.loadAsync(await Packer.toBuffer(buildAuditDocument(model, figures, assets)));
  const xml = (await zip.file('word/document.xml')?.async('string')) ?? '';
  return { text: xml.replace(/<[^>]+>/g, ''), figures };
};

describe('datos de los laboratorios y los regímenes de uso', () => {
  it('cada laboratorio suma sus equipos, su potencia y los equipos de 24 horas; los indicadores salen ordenados por intensidad', async () => {
    const { db, model } = await preparar('pontia-prueba-labs-datos', conLaboratorios);
    const labs = labRows(model);
    expect(labs.map((l) => [l.area.name, l.units, Math.round(l.installedKw * 10) / 10, l.continuousUnits])).toEqual([
      ['Laboratorio de física', 21, 8.6, 0],
      ['Laboratorio de microbiología', 5, 5.1, 4],
      ['Laboratorio de química', 5, 4.1, 2],
    ]);
    expect(labs[1].typeLabel).toBe('Laboratorio de biología y microbiología');
    expect(labs[2].kwhPerM2Year).toBeCloseTo(161.6, 1);
    // Solo los laboratorios con equipos entran al anexo del inventario
    expect(labInventory(model).map((l) => l.area.name)).toEqual(['Laboratorio de física', 'Laboratorio de microbiología', 'Laboratorio de química']);
    db.close();
  });

  it('el censo por régimen separa lo continuo, lo de ciclos y lo que no se puede apagar', async () => {
    const { db, model } = await preparar('pontia-prueba-labs-regimen', conLaboratorios);
    const r = regimeSummary(model.data.equipment);
    expect(r.rows.map((x) => [x.regime, x.units])).toEqual([
      ['horario', 501],
      ['continuo', 6],
      ['ciclos', 1],
    ]);
    expect(r.nonInterruptibleUnits).toBe(2);
    expect(r.rows.reduce((total, x) => total + x.share, 0)).toBeCloseTo(1, 10);
    // Sin equipos no hay filas
    expect(regimeSummary([]).rows).toEqual([]);
    db.close();
  });

  it('las limitaciones dicen qué faltó: el ejemplo tiene 24 meses de facturas y ningún horario de uso; con horarios en un laboratorio ya no lo dice', async () => {
    const base = await preparar('pontia-prueba-labs-limites-a');
    expect(dataLimits(base.model)).toEqual([
      'El periodo base de la línea base tiene 24 meses; la Res. UPME 016 de 2024 recomienda tres años o justificar el periodo.',
      'No se registraron los horarios de uso de los laboratorios: no se calculan los indicadores por hora de uso ni por persona.',
    ]);
    base.db.close();
    const con = await preparar('pontia-prueba-labs-limites-b', conLaboratorios);
    const limits = dataLimits(con.model);
    expect(limits).toContain('El censo de carga difiere 16,8 % del consumo facturado: el balance por uso final es una estimación.');
    expect(limits.some((l) => l.startsWith('No se registraron los horarios'))).toBe(false);
    con.db.close();
  });

  it('un proyecto en blanco lista todo lo que falta', async () => {
    const db = createDb('pontia-prueba-labs-blanco');
    const proyecto = await addProject(db, { name: 'Proyecto en blanco' });
    const model = buildAuditModel(await loadReportData(db, proyecto.id, new Date(2026, 8, 12)));
    expect(dataLimits(model)).toEqual([
      'No hay facturas de electricidad: el comportamiento mensual, la línea base y el costo anual quedan pendientes.',
      'No hay espacios registrados: la verificación de la climatización y la iluminación por espacio queda pendiente.',
      'No hay equipos en el censo de carga: el balance por uso final, el dimensionamiento y las medidas por equipo quedan pendientes.',
      'No se cargó un registro de analizador o del operador de red: la curva de carga diaria se estima con los horarios del censo.',
      'No hay mediciones puntuales de tensión, corriente ni potencia.',
    ]);
    const { text } = await textoDe(model);
    expect(text).toContain('No hay espacios ni equipos registrados: el dimensionamiento de los sistemas queda pendiente.');
    expect(text).toContain('La línea base necesita las facturas de 12 meses: queda pendiente.');
    // Sin nada que evaluar, la numeración no deja saltos: no hay mediciones, diagnóstico, seguridad ni oportunidades
    expect(text).toContain('9. Conclusiones y recomendaciones');
    db.close();
  });

  it('el seguimiento propuesto ofrece los indicadores que los datos permiten, con el de laboratorios cuando hay', async () => {
    const con = await preparar('pontia-prueba-labs-seguimiento', conLaboratorios);
    expect(followProposal(con.model).map((r) => [r.indicator, r.frequency])).toEqual([
      ['Consumo frente a la línea base', 'Mensual'],
      ['Ahorro frente al año anterior', 'Mensual'],
      ['Intensidad energética (kWh/m²·año)', 'Anual'],
      ['Consumo por usuario (kWh/usuario·año)', 'Anual'],
      ['Consumo por laboratorio (kWh/m²·año)', 'Semestral'],
    ]);
    con.db.close();
    const db = createDb('pontia-prueba-labs-seguimiento-vacio');
    const proyecto = await addProject(db, { name: 'Proyecto en blanco' });
    const vacio = buildAuditModel(await loadReportData(db, proyecto.id, new Date(2026, 8, 12)));
    expect(followProposal(vacio).map((r) => r.indicator)).toEqual(['Ahorro frente al año anterior']);
    db.close();
  });
});

describe('verificación del artículo 4 con los datos del proyecto', () => {
  it('el ejemplo cumple casi todo; falta la caracterización de la entidad y el perfil del auditor', async () => {
    const { db, ejemplo, model } = await preparar('pontia-prueba-art4-ejemplo');
    const route = reportRoute(model, { pgee: model.data.pgee, measures: model.data.measures, tasks: model.data.tasks });
    const rows = verifyArt4(art4Input(model, route));
    expect(Object.fromEntries(rows.map((r) => [r.id, r.status]))).toEqual({ a: 'parcial', b: 'cumple', c: 'cumple', d: 'cumple', e: 'cumple', f: 'cumple', g: 'cumple', par2: 'cumple', par3: 'cumple', art6: 'pendiente' });
    // Los equipos se cuentan por unidades, como dice la metodología
    expect(rows.find((r) => r.id === 'c')?.evidence).toBe('498 equipos registrados; el censo difiere 4,3 % del consumo facturado');
    // Con el perfil del auditor completo, el artículo 6 cumple
    await saveAuditorProfile(db, perfil);
    const conPerfil = buildAuditModel(await loadReportData(db, ejemplo.id, new Date(2026, 8, 12)));
    expect(verifyArt4(art4Input(conPerfil, route)).find((r) => r.id === 'art6')?.status).toBe('cumple');
    db.close();
  });
});

describe('informe de auditoría con la estructura del art. 4', () => {
  it('abre las trece secciones en orden, con los laboratorios, los regímenes, el seguimiento y los tres anexos', async () => {
    const { db, model } = await preparar('pontia-prueba-informe-completo', async (d, id) => {
      await conLaboratorios(d, id);
      await saveAuditorProfile(d, perfil);
    });
    const { text, figures } = await textoDe(model);
    const secciones = [
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
      'Anexo A. Datos del auditor',
      'Anexo B. Inventario por laboratorio',
      'Anexo C. Verificación del artículo 4 de la Resolución 40412',
    ];
    const posiciones = secciones.map((s) => text.indexOf(s));
    expect(posiciones.every((p) => p > -1)).toBe(true);
    expect(posiciones).toEqual([...posiciones].sort((a, b) => a - b));

    // Resumen: la verificación del art. 4 con el estado de cada punto y dónde se atiende
    expect(text).toContain('Cumplimiento del artículo 4 de la Resolución 40412');
    expect(text).toContain('Aspectos mínimos de la auditoría (Resolución 40412 de 2024) y dónde se atienden.');
    expect(text).toContain('Art. 4, aspecto (b)Caracterización del uso de la energía');
    expect(text).toContain('Secciones 5, 6 y 7');
    expect(text).toContain('PGEE (documento aparte)');
    expect(text).toContain('Lo que falta en cada uno está en el Anexo C.');
    // Con el perfil del auditor registrado, el artículo 6 apunta a su anexo
    expect(text).toContain('Art. 6Auditor con formación y experienciaCumpleAnexo A');
    // La seguridad va en tarjetas, aparte de los ahorros
    expect(text).toContain('HALLAZGOS ABIERTOS');
    expect(text).toContain('ATENCIÓN INMEDIATA');
    // Alcance y limitaciones: energéticos, periodo, decisión sobre las FNCER y lo que faltó
    expect(text).toContain('Energéticos incluidos: electricidad.');
    expect(text).toContain('Facturación analizada: oct 2024 a sep 2026 (24 periodos).');
    expect(text).toContain('Las fuentes no convencionales de energía renovable se tratan como un potencial de referencia (sección 12)');
    expect(text).toContain('El censo de carga difiere 16,8 % del consumo facturado');
    // Laboratorios: caracterización, balance con su figura, indicadores, régimen e inventario
    expect(text).toContain('El proyecto tiene 3 laboratorios y talleres.');
    expect(text).toContain('Laboratorios evaluados y su equipamiento.');
    expect(text).toContain('Laboratorio de biología y microbiología');
    expect(text).toContain('El censo de carga asigna a los 3 laboratorios 38.093 kWh al año, el 17,5 % del consumo estimado.');
    expect(text).toContain('Consumo anual estimado por laboratorio');
    expect(text).toContain('Consumo anual estimado de cada laboratorio.');
    expect(text).toContain('Indicadores de desempeño energético de cada laboratorio.');
    expect(text).toContain('KWH/HORA DE USO');
    expect(text).toContain('8.4 Regímenes de uso y cargas continuas');
    expect(text).toContain('6 equipos funcionan las 24 horas, con 3,4 kW instalados: 7,9 % del consumo estimado.');
    expect(text).toContain('2 unidades no pueden apagarse y se excluyen de las medidas de apagado');
    expect(text).toContain('Equipos eléctricos según su régimen de uso.');
    expect(text).toContain('El inventario de cada laboratorio, equipo por equipo, está en el Anexo B.');
    expect(text).toContain('Inventario de Laboratorio de química.');
    expect(text).toContain('Ultracongelador de −80 °C');
    expect(text).toContain('Marca ejemplo UF-80');
    expect(text).toContain('208 / 6,5');
    // Seguimiento propuesto (aspecto f), con el gestor del PGEE
    expect(text).toContain('Propuesta de evaluación y seguimiento');
    expect(text).toContain('El gestor energético del PGEE, Jefatura de la Oficina de Planeación, hace el seguimiento de los indicadores.');
    expect(text).toContain('Consumo por laboratorio (kWh/m²·año)');
    // Todas las figuras se usan una vez, incluida la nueva
    expect(figures.map((f) => f.id)).toContain('consumo-laboratorios');
    expect(text).toContain(`Figura ${figures.length}.`);
    // La conclusión resume la verificación y dice qué falta: los laboratorios nuevos suben el censo 16,8 % sobre lo facturado y el aspecto (c) queda parcial
    expect(text).toContain('está incompleta. Faltan:'); // el borrador cita el aspecto (a)
    expect(text).toContain('Verificación de la Resolución 40412: 8 de 10 puntos se cumplen con lo registrado. Falta completar: art. 4, aspecto (a); art. 4, aspecto (c). El detalle está en el Anexo C.');
    db.close();
  });

  it('sin laboratorios ni perfil del auditor los anexos se renumeran: la verificación es el A y las fotos el B', async () => {
    const { db, model } = await preparar('pontia-prueba-informe-sin-labs', async (d, id) => {
      const labs = (await d.areas.where('projectId').equals(id).toArray()).filter((a) => a.spaceType === 'laboratorio');
      for (const lab of labs) {
        await d.areas.delete(lab.id);
        for (const e of await d.equipment.where('areaId').equals(lab.id).toArray()) await d.equipment.delete(e.id);
      }
    });
    expect(labRows(model)).toEqual([]);
    const photo: AuditAssets['photos'][number] = {
      photo: { id: 'p1', projectId: 'x', createdAt: 0, updatedAt: 0, entityType: 'equipo', entityId: 'x', kind: 'estado-fisico', takenAt: '2026-09-10T10:00', blob: new Blob([]) } as Photo,
      data: Uint8Array.from([...PIXEL, 9]),
      width: 1,
      height: 1,
      type: 'png',
      caption: 'Placa del aire del aula 601',
    };
    const { text, figures } = await textoDe(model, [photo]);
    expect(text).not.toContain('Laboratorios evaluados y su equipamiento.');
    expect(text).not.toContain('Consumo por laboratorio');
    expect(text).not.toContain('Inventario por laboratorio');
    expect(text).not.toContain('Anexo A. Datos del auditor');
    expect(text).toContain('Anexo A. Verificación del artículo 4 de la Resolución 40412');
    expect(text).toContain('Anexo B. Registro fotográfico');
    expect(text).toContain('Foto 1. Placa del aire del aula 601');
    expect(figures.map((f) => f.id)).not.toContain('consumo-laboratorios');
    // El resumen apunta al anexo A
    expect(text).toContain('Lo que falta en cada uno está en el Anexo A.');
    db.close();
  });

  it('sin mediciones, diagnóstico ni medidas la numeración no deja saltos y la verificación marca lo pendiente', async () => {
    const { db, model } = await preparar('pontia-prueba-informe-sin-secciones', async (d, id) => {
      for (const table of ['measurements', 'findings', 'measures'] as const) {
        for (const r of await d[table].where('projectId').equals(id).toArray()) await d[table].delete(r.id);
      }
    });
    const { text } = await textoDe(model);
    expect(text).not.toContain('Mediciones puntuales');
    expect(text).not.toContain('Diagnóstico energético');
    expect(text).not.toContain('Potencial de ahorro y oportunidades');
    // Quedan la seguridad (hay situaciones por valorar en los datos) y las conclusiones
    expect(text).toContain('9. Seguridad eléctrica y SST');
    expect(text).toContain('10. Conclusiones y recomendaciones');
    // Las evaluaciones que dependen de las medidas quedan pendientes y no apuntan a una sección que no existe
    expect(text).toMatch(/Art\. 4, aspecto \(e\)Evaluación de las oportunidades de mejora en eficiencia energéticaPendiente—/);
    expect(text).toContain('Las medidas de ahorro con su evaluación económica');
    db.close();
  });
});
