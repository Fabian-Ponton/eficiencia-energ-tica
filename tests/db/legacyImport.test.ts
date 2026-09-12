import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import {
  dataUrlToBlob,
  guessCategory,
  importLegacyIntoDb,
  LEGACY_STORAGE_KEY,
  mapLegacyData,
  readLegacyLocalStorage,
  type LegacyData,
} from '@/db/legacyImport';
import { createDb } from '@/db/schema';

const PIXEL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

const v16: LegacyData = {
  project: { name: 'Auditoría Energética – Bloque 6', institution: 'Universidad de La Guajira', city: 'Riohacha', area: 3000, users: 900, hours: '06:00 – 22:00' },
  areas: [{ n: 'Aula 601', m: 48, p: 35, h: 9, o: 'Ventanas al norte' }],
  equipment: [
    { n: 'Aire acondicionado', p: 1.65, c: 2, h: 9, days: 22, s: 'Regular' },
    { n: 'Lámpara T8', p: 0.064, c: 8, h: 10, days: 22, s: 'Bueno' },
  ],
  measurements: [{ v: 208, a: 96, k: 30.5, f: 0.88, date: '2026-03-12T10:45', type: 'Medido' }],
  bills: [
    { m: '2026-08', k: 17_100, c: 14_535_000, r: 850 },
    { m: '2026-09', k: 16_600, c: 14_110_000, r: 850 },
  ],
  pgee: [{ goal: 'Reducir el consumo energético', target: 15, action: 'Cambiar a LED', owner: 'Mantenimiento', date: '2026-12-15', state: 'En ejecución' }],
  photos: [
    { equipmentIndex: 1, code: 'LT-601-01', area: 'Aula 601', type: 'Placa de características', caption: 'Placa', data: PIXEL, date: '5/9/2026, 10:42:13 a. m.' },
    { equipmentIndex: 7, type: 'Vista general', data: PIXEL },
  ],
};

const ids = (): (() => string) => {
  let n = 0;
  return () => `id-${++n}`;
};

describe('importación de PONTIA 1.6', () => {
  it('convierte los datos al modelo nuevo', () => {
    const r = mapLegacyData(v16, { now: 1_000, newId: ids() });
    expect(r.project.name).toBe('Auditoría Energética – Bloque 6');
    expect(r.project.economics.tariffCopPerKwh).toBeCloseTo(850, 6);
    expect(r.equipment.map((e) => e.category)).toEqual(['climatizacion', 'iluminacion']);
    expect(r.equipment[0].condition).toBe('regular');
    expect(r.measurements[0]).toMatchObject({ dataType: 'medido', kw: 30.5, pf: 0.88, currentA: [96], voltageV: [208] });
    expect(r.bills.map((b) => b.period)).toEqual(['2026-08', '2026-09']);
    expect(r.tasks[0]).toMatchObject({ name: 'Cambiar a LED', status: 'en-ejecucion', responsible: 'Mantenimiento' });
    expect(r.pgee.objectives).toEqual([{ description: 'Reducir el consumo energético', targetPercent: 15 }]);
  });

  it('vincula cada foto con su equipo por identificador y no por posición', () => {
    const r = mapLegacyData(v16, { now: 1_000, newId: ids() });
    expect(r.photos[0]).toMatchObject({ entityType: 'equipo', entityId: r.equipment[1].id, kind: 'placa', code: 'LT-601-01' });
    expect(r.photos[0].blob.type).toBe('image/png');
    expect(r.photos[1].entityType).toBe('proyecto');
    expect(r.warnings).toHaveLength(1);
  });

  it('lee la fecha en formato colombiano de las fotos', () => {
    const r = mapLegacyData(v16, { now: 1_000, newId: ids() });
    const d = new Date(r.photos[0].takenAt);
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes()]).toEqual([2026, 8, 5, 10, 42]);
  });

  it('sugiere el uso final por el nombre del equipo', () => {
    expect(guessCategory('Nevera de la cafetería')).toBe('refrigeracion');
    expect(guessCategory('Computador de escritorio')).toBe('ti');
    expect(guessCategory('Bomba de agua 3 HP')).toBe('motores');
    expect(guessCategory('Cafetera')).toBe('cocina');
    expect(guessCategory('Caja fuerte')).toBe('otros');
  });

  it('decodifica las imágenes base64', () => {
    expect(dataUrlToBlob(PIXEL)?.size).toBeGreaterThan(60);
    expect(dataUrlToBlob('no es una imagen')).toBeNull();
  });

  it('lee el respaldo que quedó en el navegador', () => {
    const storage = { getItem: (k: string) => (k === LEGACY_STORAGE_KEY ? JSON.stringify(v16) : null) };
    expect(readLegacyLocalStorage(storage)?.project?.city).toBe('Riohacha');
    expect(readLegacyLocalStorage({ getItem: () => '{roto' })).toBeNull();
  });

  it('guarda el proyecto importado en la base local', async () => {
    const db = createDb('pontia-prueba-importacion');
    const r = await importLegacyIntoDb(db, { ...v16, photos: [] });
    expect(await db.projects.count()).toBe(1);
    expect(await db.equipment.where('projectId').equals(r.project.id).count()).toBe(2);
    expect(await db.bills.where('projectId').equals(r.project.id).count()).toBe(2);
    db.close();
  });
});
