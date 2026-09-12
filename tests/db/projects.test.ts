import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { addProject, lastTwelveMonthsKwh, listProjects, restoreProject, softDeleteProject, summarizeProject } from '@/db/projects';
import { createSampleProject } from '@/db/sampleProject';
import { createDb } from '@/db/schema';

describe('proyectos en la base local', () => {
  it('crea, oculta y restaura proyectos', async () => {
    const db = createDb('pontia-prueba-proyectos');
    const a = await addProject(db, { name: '  Biblioteca central  ', city: 'Riohacha', client: '' });
    await addProject(db, { name: 'Edificio administrativo' });
    expect(a.name).toBe('Biblioteca central');
    expect(a.client).toBeUndefined();
    expect(await listProjects(db)).toHaveLength(2);
    await softDeleteProject(db, a.id);
    expect((await listProjects(db)).map((p) => p.name)).toEqual(['Edificio administrativo']);
    await restoreProject(db, a.id);
    expect(await listProjects(db)).toHaveLength(2);
    db.close();
  });

  it('el proyecto de ejemplo tiene dos años de facturas y un censo de carga coherente', async () => {
    const db = createDb('pontia-prueba-ejemplo');
    const ejemplo = await createSampleProject(db);
    const resumen = await summarizeProject(db, ejemplo);
    expect(resumen.billedAnnualKwh).toBe(186_400);
    expect(resumen.equipmentCount).toBeGreaterThan(400);
    expect(resumen.estimatedAnnualKwh / 186_400).toBeGreaterThan(0.9);
    expect(resumen.estimatedAnnualKwh / 186_400).toBeLessThan(1.1);
    expect(resumen.progress[0].done).toBe(4);
    db.close();
  });

  it('solo reporta consumo anual con al menos 12 facturas', () => {
    expect(lastTwelveMonthsKwh([])).toBeNull();
  });
});
