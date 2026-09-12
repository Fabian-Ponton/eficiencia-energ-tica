import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { addProject, summarizeProject } from '@/db/projects';
import { compact, discardPhotos, restoreRecords, saveRecord, softDeleteRecords } from '@/db/records';
import { createDb } from '@/db/schema';

const stepDone = async (db: ReturnType<typeof createDb>, projectId: string, step: string) => {
  const project = await db.projects.get(projectId);
  const summary = await summarizeProject(db, project!);
  return summary.progress[0].steps.find((s) => s.id === step)?.done;
};

describe('registros del levantamiento', () => {
  it('compact quita campos vacíos y recorta textos', () => {
    expect(compact({ a: '  hola ', b: '', c: null, d: undefined, e: 0, f: false })).toEqual({ a: 'hola', e: 0, f: false });
  });

  it('guarda y edita un área, y marca el proyecto como modificado', async () => {
    const db = createDb('pontia-prueba-registros');
    const project = await addProject(db, { name: 'Prueba' });
    const t = project.updatedAt;
    const area = await saveRecord(db, 'areas', { id: 'a1', projectId: project.id, name: ' Aula 101 ', lengthM: 8, widthM: 6, heightM: 3 }, t + 1000);
    expect(area.name).toBe('Aula 101');
    expect(area.createdAt).toBe(t + 1000);
    expect((await db.projects.get(project.id))?.updatedAt).toBe(t + 1000);

    const edited = await saveRecord(db, 'areas', { ...area, name: 'Aula 102' }, t + 2000);
    expect(edited.createdAt).toBe(t + 1000);
    expect(edited.updatedAt).toBe(t + 2000);
    expect(await stepDone(db, project.id, 'areas')).toBe(true);
    db.close();
  });

  it('al eliminar oculta también las fotos y deshacer las recupera', async () => {
    const db = createDb('pontia-prueba-eliminar');
    const project = await addProject(db, { name: 'Prueba' });
    await saveRecord(db, 'equipment', {
      id: 'e1',
      projectId: project.id,
      name: 'Nevera',
      category: 'refrigeracion',
      powerKw: 0.2,
      quantity: 1,
      hoursPerDay: 24,
      operatingDaysPerMonth: 30,
      useFactor: 0.5,
      condition: 'bueno',
    });
    const photo = { projectId: project.id, entityType: 'equipo' as const, entityId: 'e1', kind: 'placa' as const, takenAt: '2026-09-10T10:00', blob: new Blob(['x']) };
    await saveRecord(db, 'photos', { ...photo, id: 'f1' });
    // Una foto que el auditor ya había eliminado antes no debe volver al deshacer
    await saveRecord(db, 'photos', { ...photo, id: 'f2' });
    await softDeleteRecords(db, 'photos', ['f2'], 100);

    await softDeleteRecords(db, 'equipment', ['e1']);
    expect(await stepDone(db, project.id, 'inventario')).toBe(false);
    expect((await db.photos.get('f1'))?.deletedAt).toBeDefined();

    await restoreRecords(db, 'equipment', ['e1']);
    expect(await stepDone(db, project.id, 'inventario')).toBe(true);
    expect((await db.photos.get('f1'))?.deletedAt).toBeUndefined();
    expect((await db.photos.get('f2'))?.deletedAt).toBe(100);
    db.close();
  });

  it('descarta las fotos de un registro que no se guardó', async () => {
    const db = createDb('pontia-prueba-descartar');
    const project = await addProject(db, { name: 'Prueba' });
    await saveRecord(db, 'photos', { id: 'f1', projectId: project.id, entityType: 'area', entityId: 'nueva', kind: 'vista-general', takenAt: '2026-09-10T10:00', blob: new Blob(['x']) });
    expect(await discardPhotos(db, 'area', 'nueva')).toBe(1);
    expect(await db.photos.count()).toBe(0);
    db.close();
  });
});
