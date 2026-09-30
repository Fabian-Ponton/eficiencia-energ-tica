import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { describe, expect, it } from 'vitest';
import { createDb } from '@/db/schema';

/** Base tal como la dejaba la versión 1 de PONTIA: solo las tablas originales. */
async function openAsVersionOne(name: string) {
  const old = new Dexie(name);
  old.version(1).stores({
    projects: 'id, updatedAt',
    areas: 'id, projectId',
    equipment: 'id, projectId, areaId, panelId, category',
    electrical: 'id, projectId, parentId',
    measurements: 'id, projectId, takenAt',
    meterReadings: 'id, projectId, at',
    intervalSeries: 'id, projectId',
    intervalDays: '[seriesId+date], seriesId, projectId',
    bills: 'id, projectId, period',
    photos: 'id, projectId, [entityType+entityId]',
    findings: 'id, projectId',
    measures: 'id, projectId',
    pgee: 'id, projectId',
    tasks: 'id, projectId, measureId',
    settings: 'id',
  });
  await old.open();
  return old;
}

describe('esquema local versión 2', () => {
  it('abre una base de la versión 1 sin perder ningún dato y suma las tablas nuevas', async () => {
    const name = 'pontia-migracion';
    const old = await openAsVersionOne(name);
    await old.table('projects').put({ id: 'p1', createdAt: 1, updatedAt: 2, name: 'Auditoría existente', calendar: { daysPerWeek: 5, holidays: [], vacationDaysPerYear: 0 } });
    await old.table('bills').put({ id: 'b1', projectId: 'p1', createdAt: 1, updatedAt: 1, period: '2026-08', kwh: 17_100, costCop: 14_535_000 });
    await old.table('equipment').put({ id: 'e1', projectId: 'p1', createdAt: 1, updatedAt: 1, name: 'Nevera', category: 'refrigeracion', powerKw: 0.2, quantity: 1, hoursPerDay: 24, operatingDaysPerMonth: 30, useFactor: 0.5, condition: 'bueno' });
    old.close();

    const db = createDb(name);
    await db.open();
    expect(db.verno).toBe(2);
    // Lo que ya había sigue igual y sin campos inventados
    expect((await db.projects.get('p1'))?.name).toBe('Auditoría existente');
    expect(await db.bills.get('b1')).toMatchObject({ kwh: 17_100, costCop: 14_535_000 });
    const nevera = (await db.equipment.get('e1'))!;
    expect(nevera.carrier).toBeUndefined();
    expect(nevera.regime).toBeUndefined();

    // Las seis tablas nuevas existen y se pueden consultar por proyecto
    for (const table of ['occupancy', 'maintenance', 'collection', 'safetyFindings', 'baselineAdjustments', 'upmeCycles'] as const) {
      expect(await db[table].where('projectId').equals('p1').count()).toBe(0);
    }
    await db.maintenance.put({ id: 'm1', projectId: 'p1', createdAt: 1, updatedAt: 1, equipmentId: 'e1', type: 'preventivo', lastAt: '2026-05-10' });
    expect((await db.maintenance.where('equipmentId').equals('e1').toArray()).map((m) => m.id)).toEqual(['m1']);
    db.close();
  });

  it('una base nueva nace directamente en la versión 2', async () => {
    const db = createDb('pontia-migracion-nueva');
    await db.open();
    expect(db.verno).toBe(2);
    expect(db.tables.map((t) => t.name)).toEqual(expect.arrayContaining(['occupancy', 'maintenance', 'collection', 'safetyFindings', 'baselineAdjustments', 'upmeCycles']));
    db.close();
  });
});
