import 'fake-indexeddb/auto';
import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import { BACKUP_VERSION, backupFileName, describeBackup, exportProjectZip, openBackup, restoreBackup } from '@/db/backup';
import { saveRecord } from '@/db/records';
import { createSampleProject } from '@/db/sampleProject';
import { createDb } from '@/db/schema';

describe('respaldo .zip del proyecto', () => {
  it('pasa un proyecto con fotos a otro equipo y crea copias sin romper los vínculos', async () => {
    const origen = createDb('pontia-respaldo-origen');
    const proyecto = await createSampleProject(origen);
    const equipo = (await origen.equipment.where('projectId').equals(proyecto.id).first())!;
    const area = (await origen.areas.where('projectId').equals(proyecto.id).first())!;
    await origen.equipment.update(equipo.id, { areaId: area.id });
    const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);
    await saveRecord(origen, 'photos', {
      id: 'foto-1',
      projectId: proyecto.id,
      entityType: 'equipo',
      entityId: equipo.id,
      kind: 'placa',
      takenAt: '2026-09-10T10:00',
      blob: new Blob([bytes], { type: 'image/jpeg' }),
      thumb: new Blob([bytes], { type: 'image/jpeg' }),
    });

    const zip = await exportProjectZip(origen, proyecto.id);
    const destino = createDb('pontia-respaldo-destino');
    const abierto = await openBackup(zip);
    const info = await describeBackup(destino, abierto);
    expect(info.existing).toBeUndefined();
    expect(info.counts).toMatchObject({ areas: 7, bills: 24, photos: 1 });

    const nuevo = await restoreBackup(destino, abierto);
    expect(nuevo.outcome).toBe('nuevo');
    expect(nuevo.project.id).toBe(proyecto.id);
    for (const tabla of ['equipment', 'electrical', 'measurements', 'meterReadings'] as const) {
      expect(await destino[tabla].where('projectId').equals(proyecto.id).count()).toBe(await origen[tabla].where('projectId').equals(proyecto.id).count());
    }
    const foto = (await destino.photos.get('foto-1'))!;
    expect(new Uint8Array(await foto.blob.arrayBuffer())).toEqual(bytes);
    expect(foto.blob.type).toBe('image/jpeg');
    expect(foto.thumb).toBeDefined();

    // Segunda importación en el mismo equipo: copia con identificadores nuevos
    const copia = await restoreBackup(destino, await openBackup(zip));
    expect(copia.outcome).toBe('copia');
    expect(copia.project.id).not.toBe(proyecto.id);
    expect(copia.project.name).toMatch(/\(copia\)$/);
    const equiposCopia = await destino.equipment.where('projectId').equals(copia.project.id).toArray();
    const areasCopia = await destino.areas.where('projectId').equals(copia.project.id).toArray();
    const tablerosCopia = await destino.electrical.where('projectId').equals(copia.project.id).toArray();
    expect(areasCopia.map((a) => a.id)).toContain(equiposCopia.find((e) => e.areaId)?.areaId);
    expect(tablerosCopia.map((t) => t.id)).toContain(equiposCopia.find((e) => e.panelId)?.panelId);
    const fotoCopia = (await destino.photos.where('projectId').equals(copia.project.id).first())!;
    expect(equiposCopia.map((e) => e.id)).toContain(fotoCopia.entityId);
    origen.close();
    destino.close();
  });

  it('reemplazar cambia la versión local por la del respaldo', async () => {
    const db = createDb('pontia-respaldo-reemplazo');
    const proyecto = await createSampleProject(db);
    const zip = await exportProjectZip(db, proyecto.id);
    await saveRecord(db, 'areas', { id: 'area-local', projectId: proyecto.id, name: 'Área creada después del respaldo' });
    const resultado = await restoreBackup(db, await openBackup(zip), 'reemplazar');
    expect(resultado.outcome).toBe('reemplazado');
    expect(await db.areas.get('area-local')).toBeUndefined();
    expect(await db.areas.where('projectId').equals(proyecto.id).count()).toBe(7);
    expect(await db.projects.count()).toBe(1);
    db.close();
  });

  it('rechaza archivos que no son respaldos y arma nombres de archivo seguros', async () => {
    await expect(openBackup(new Blob(['hola']))).rejects.toThrow('.zip');
    expect(backupFileName({ name: 'Biblioteca Central · Riohacha' }, new Date(2026, 8, 11))).toBe('PONTIA_Biblioteca-Central-Riohacha_2026-09-11.zip');
    expect(backupFileName({ name: 'x', code: 'BL-06' }, new Date(2026, 8, 11))).toBe('PONTIA_BL-06_2026-09-11.zip');
  });
});

const NUEVAS = ['occupancy', 'maintenance', 'collection', 'safetyFindings', 'baselineAdjustments', 'upmeCycles'] as const;

describe('respaldo con las tablas del cumplimiento normativo', () => {
  it('lleva las tablas nuevas y, al copiar, reasigna sus vínculos con equipos, espacios y tareas', async () => {
    const origen = createDb('pontia-respaldo-nuevas-origen');
    const proyecto = await createSampleProject(origen);
    const equipo = (await origen.equipment.where('projectId').equals(proyecto.id).first())!;
    const area = (await origen.areas.where('projectId').equals(proyecto.id).first())!;
    const tarea = (await origen.tasks.where('projectId').equals(proyecto.id).first())!;
    const base = { projectId: proyecto.id };
    await saveRecord(origen, 'maintenance', { ...base, id: 'mto-1', equipmentId: equipo.id, type: 'preventivo', lastAt: '2026-05-10' });
    await saveRecord(origen, 'occupancy', { ...base, id: 'ocu-1', areaId: area.id, term: '2026-1', activity: 'Práctica', day: 'L-V', start: '07:00', end: '11:00', hours: 4 });
    await saveRecord(origen, 'collection', { ...base, id: 'ctl-1', key: 'general', label: 'Información general', status: 'obtenido' });
    await saveRecord(origen, 'safetyFindings', {
      ...base,
      id: 'seg-1',
      foundAt: '2026-09-10',
      entityType: 'equipo',
      entityId: equipo.id,
      riskFactor: 'sobrecarga',
      real: false,
      consequence: 3,
      frequency: 'c',
      highRisk: false,
      imminent: false,
      description: 'Circuito sin rotular',
      status: 'abierto',
      auto: false,
      taskId: tarea.id,
    });
    await saveRecord(origen, 'baselineAdjustments', { ...base, id: 'adj-1', carrier: 'electricidad', kind: 'no-rutinario', date: '2026-09-01', cause: 'Remodelación de un piso' });
    await saveRecord(origen, 'upmeCycles', { ...base, id: 'upme-1', year: 2026 });

    const zip = await exportProjectZip(origen, proyecto.id);
    const destino = createDb('pontia-respaldo-nuevas-destino');
    const nuevo = await restoreBackup(destino, await openBackup(zip));
    expect(nuevo.outcome).toBe('nuevo');
    for (const tabla of NUEVAS) expect(await destino[tabla].where('projectId').equals(proyecto.id).count()).toBe(1);

    // Copia: identificadores nuevos, pero cada vínculo apunta al registro copiado
    const copia = await restoreBackup(destino, await openBackup(zip));
    expect(copia.outcome).toBe('copia');
    const en = (tabla: 'equipment' | 'areas' | 'tasks') => destino[tabla].where('projectId').equals(copia.project.id).toArray();
    const mantenimiento = (await destino.maintenance.where('projectId').equals(copia.project.id).toArray())[0];
    const ocupacion = (await destino.occupancy.where('projectId').equals(copia.project.id).toArray())[0];
    const seguridad = (await destino.safetyFindings.where('projectId').equals(copia.project.id).toArray())[0];
    expect((await en('equipment')).map((e) => e.id)).toContain(mantenimiento.equipmentId);
    expect(mantenimiento.equipmentId).not.toBe(equipo.id);
    expect((await en('areas')).map((a) => a.id)).toContain(ocupacion.areaId);
    expect((await en('equipment')).map((e) => e.id)).toContain(seguridad.entityId);
    expect((await en('tasks')).map((t) => t.id)).toContain(seguridad.taskId);
    origen.close();
    destino.close();
  });

  it('abre un respaldo hecho con la versión 1, que no trae las tablas nuevas', async () => {
    const origen = createDb('pontia-respaldo-v1-origen');
    const proyecto = await createSampleProject(origen);
    const zip = await JSZip.loadAsync(await (await exportProjectZip(origen, proyecto.id)).arrayBuffer());
    const manifest = JSON.parse(await zip.file('proyecto.json')!.async('string'));
    manifest.version = 1;
    for (const tabla of NUEVAS) delete manifest.tables[tabla];
    zip.file('proyecto.json', JSON.stringify(manifest));

    const destino = createDb('pontia-respaldo-v1-destino');
    const resultado = await restoreBackup(destino, await openBackup(await zip.generateAsync({ type: 'arraybuffer' })));
    expect(resultado.outcome).toBe('nuevo');
    expect(await destino.areas.where('projectId').equals(proyecto.id).count()).toBe(7);
    for (const tabla of NUEVAS) expect(await destino[tabla].count()).toBe(0);
    origen.close();
    destino.close();
  });

  it('rechaza un respaldo de una versión más nueva que la de la app', async () => {
    const origen = createDb('pontia-respaldo-futuro');
    const proyecto = await createSampleProject(origen);
    const zip = await JSZip.loadAsync(await (await exportProjectZip(origen, proyecto.id)).arrayBuffer());
    const manifest = JSON.parse(await zip.file('proyecto.json')!.async('string'));
    manifest.version = BACKUP_VERSION + 1;
    zip.file('proyecto.json', JSON.stringify(manifest));
    await expect(openBackup(await zip.generateAsync({ type: 'arraybuffer' }))).rejects.toThrow('versión más nueva');
    origen.close();
  });
});
