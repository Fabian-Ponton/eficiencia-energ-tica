import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { backupFileName, describeBackup, exportProjectZip, openBackup, restoreBackup } from '@/db/backup';
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
