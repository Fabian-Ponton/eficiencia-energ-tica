import { describe, expect, it } from 'vitest';
import { createProjectRecord } from '@/db/projects';
import { autoStatus, buildCollection, COLLECTION_ITEMS, collectionResolved, effectiveStatus, isResolved, summarizeCollection, type CollectionInput } from '@/domain/collection';
import type { Area, CollectionItem, Equipment, MaintenanceRecord, OccupancyRecord, Project } from '@/domain/types';

const base = { projectId: 'p', createdAt: 0, updatedAt: 0 };
const area = (id: string, extra: Partial<Area> = {}): Area => ({ ...base, id, name: id, lengthM: 8, widthM: 6, ...extra });
const equipo = (id: string, extra: Partial<Equipment> = {}): Equipment => ({
  ...base,
  id,
  name: id,
  category: 'laboratorio',
  powerKw: 1,
  quantity: 1,
  hoursPerDay: 8,
  operatingDaysPerMonth: 22,
  useFactor: 1,
  condition: 'bueno',
  ...extra,
});
const guardado = (key: string, extra: Partial<CollectionItem> = {}): CollectionItem => ({ ...base, id: `c-${key}`, key, label: key, status: 'pendiente', ...extra });
const vacio = (extra: Partial<CollectionInput> = {}): CollectionInput => ({
  project: createProjectRecord({ name: 'Laboratorios' }),
  areas: [],
  equipment: [],
  occupancy: [],
  maintenance: [],
  electricBills: 0,
  measurementRecords: 0,
  photos: 0,
  findings: 0,
  stored: [],
  ...extra,
});
const estado = (key: string, input: CollectionInput) => autoStatus(key, input).status;
const horario = (areaId: string): OccupancyRecord => ({ ...base, id: `o-${areaId}`, areaId, term: '2026-1', activity: 'x', day: 'L-V', start: '07:00', end: '11:00', hours: 4 });
const mantenimiento = (equipmentId: string): MaintenanceRecord => ({ ...base, id: `m-${equipmentId}`, equipmentId, type: 'preventivo' });

describe('control de recolección (Formato 13)', () => {
  it('trae los doce renglones del formato en su orden', () => {
    expect(COLLECTION_ITEMS.map((i) => i.key)).toEqual(['general', 'planos', 'areas', 'inventario', 'aires', 'iluminacion', 'horarios', 'mediciones', 'facturas', 'mantenimiento', 'fotos', 'hallazgos']);
  });

  it('un proyecto vacío lo tiene todo pendiente y ningún renglón resuelto', () => {
    const filas = buildCollection(vacio());
    expect(filas).toHaveLength(12);
    expect(filas.every((f) => f.status === 'pendiente')).toBe(true);
    expect(collectionResolved(filas)).toBe(false);
    expect(summarizeCollection(filas)).toMatchObject({ resolved: 0, total: 12, unavailable: 0 });
  });

  it('las facturas se dan por obtenidas con doce o más, y con menos quedan en curso', () => {
    expect(estado('facturas', vacio({ electricBills: 0 }))).toBe('pendiente');
    expect(autoStatus('facturas', vacio({ electricBills: 7 }))).toEqual({ status: 'en-curso', detail: '7 de 12 facturas' });
    expect(estado('facturas', vacio({ electricBills: 12 }))).toBe('obtenido');
    expect(estado('facturas', vacio({ electricBills: 24 }))).toBe('obtenido');
  });

  it('los aires y las luminarias piden su capacidad y su tecnología', () => {
    const aires = [equipo('a1', { category: 'climatizacion', capacityBtuH: 24000 }), equipo('a2', { category: 'climatizacion' })];
    expect(autoStatus('aires', vacio({ equipment: aires }))).toEqual({ status: 'en-curso', detail: '1 de 2 aires con capacidad' });
    expect(estado('aires', vacio({ equipment: [aires[0]] }))).toBe('obtenido');
    expect(estado('aires', vacio({ equipment: [equipo('x')] }))).toBe('pendiente');
    expect(estado('iluminacion', vacio({ equipment: [equipo('l1', { category: 'iluminacion', lampType: 'LED' })] }))).toBe('obtenido');
    expect(estado('iluminacion', vacio({ equipment: [equipo('l2', { category: 'iluminacion' })] }))).toBe('en-curso');
  });

  it('los horarios y el mantenimiento se miden contra los espacios y los equipos registrados', () => {
    const espacios = [area('a'), area('b')];
    expect(autoStatus('horarios', vacio({ areas: espacios, occupancy: [horario('a')] }))).toEqual({ status: 'en-curso', detail: '1 de 2 espacios con horario' });
    expect(estado('horarios', vacio({ areas: [espacios[0]], occupancy: [horario('a')] }))).toBe('obtenido');
    expect(autoStatus('mantenimiento', vacio({ equipment: [equipo('e1'), equipo('e2')], maintenance: [mantenimiento('e1')] }))).toEqual({
      status: 'en-curso',
      detail: '1 de 2 equipos con mantenimiento',
    });
    expect(estado('mantenimiento', vacio({ equipment: [equipo('e1')], maintenance: [mantenimiento('e1')] }))).toBe('obtenido');
  });

  it('la información general sigue al art. 4(a)', () => {
    const proyecto: Project = {
      ...createProjectRecord({ name: 'Lab' }),
      client: 'Universidad',
      city: 'Riohacha',
      address: 'Calle 1',
      operatingHours: '7–21',
      building: { builtYear: 2000, activity: 'Docencia', surroundings: 'Urbano', tenure: 'propia' },
    };
    expect(estado('general', vacio({ project: proyecto }))).toBe('obtenido');
    expect(estado('general', vacio({ project: { ...proyecto, address: undefined } }))).toBe('en-curso');
    expect(estado('general', vacio())).toBe('pendiente');
  });

  it('el estado manual solo adelanta: «obtenido» marca los planos y «no disponible» siempre gana', () => {
    expect(effectiveStatus('pendiente', guardado('planos', { status: 'obtenido' }))).toBe('obtenido');
    expect(effectiveStatus('obtenido', guardado('x', { status: 'pendiente' }))).toBe('obtenido');
    expect(effectiveStatus('en-curso', guardado('x', { status: 'pendiente' }))).toBe('en-curso');
    expect(effectiveStatus('obtenido', guardado('x', { status: 'no-disponible' }))).toBe('no-disponible');
    expect(isResolved('no-disponible')).toBe(true);
    expect(isResolved('en-curso')).toBe(false);
  });

  it('con todo obtenido o no disponible la recolección está completa, y los renglones propios no cuentan', () => {
    const todo = vacio({
      project: {
        ...createProjectRecord({ name: 'Lab' }),
        client: 'U',
        city: 'R',
        address: 'C',
        operatingHours: 'h',
        building: { builtYear: 2000, activity: 'a', surroundings: 's', tenure: 'propia' },
      },
      areas: [area('a')],
      equipment: [equipo('e1'), equipo('aa', { category: 'climatizacion', capacityBtuH: 1 }), equipo('ll', { category: 'iluminacion', lampType: 'LED' })],
      occupancy: [horario('a')],
      maintenance: ['e1', 'aa', 'll'].map(mantenimiento),
      electricBills: 12,
      measurementRecords: 1,
      photos: 3,
      findings: 1,
      stored: [guardado('planos', { status: 'no-disponible' }), guardado('otro-1', { label: 'Contrato de suministro' })],
    });
    const filas = buildCollection(todo);
    expect(filas).toHaveLength(13);
    expect(filas.find((f) => f.key === 'planos')?.status).toBe('no-disponible');
    expect(filas.find((f) => f.key === 'otro-1')).toMatchObject({ custom: true, status: 'pendiente', label: 'Contrato de suministro' });
    expect(collectionResolved(filas)).toBe(true);
    expect(summarizeCollection(filas)).toMatchObject({ resolved: 12, total: 12, unavailable: 1, pending: [] });
  });
});
