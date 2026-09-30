import { describe, expect, it } from 'vitest';
import { createProjectRecord } from '@/db/projects';
import { characterization, checkCompliance, groupStatus, missingSentence, nextAuditDate, pgeeChecklist } from '@/domain/compliance';
import type { Project } from '@/domain/types';

const nuevo = (extra: Partial<Project> = {}): Project => ({ ...createProjectRecord({ name: 'Laboratorios' }), ...extra });

const completo = (): Project =>
  nuevo({
    client: 'Universidad de ejemplo',
    city: 'Riohacha',
    address: 'Calle 1 # 2-3',
    operatingHours: 'Lunes a viernes, 07:00 – 21:00',
    building: { builtYear: 1998, floors: 2, activity: 'Docencia y prácticas de laboratorio', surroundings: 'Zona urbana, campus rodeado de vías', tenure: 'propia' },
  });

describe('art. 4(a) de la Res. 40412: caracterización de la entidad', () => {
  it('un proyecto nuevo tiene todo por completar, sin bloquear nada', () => {
    const estado = groupStatus(characterization(nuevo()));
    expect(estado.total).toBe(7);
    expect(estado.done).toBe(0);
    expect(estado.complete).toBe(false);
    expect(estado.missing.map((i) => i.id)).toEqual(['entidad', 'ubicacion', 'entorno', 'edad', 'actividad', 'horario', 'tenencia']);
  });

  it('marca completo cuando están los parámetros que cita el artículo', () => {
    const estado = groupStatus(characterization(completo()));
    expect(estado).toMatchObject({ done: 7, total: 7, complete: true });
    expect(estado.missing).toEqual([]);
    // Lo recomendado no impide estar completo
    expect(estado.suggested.map((i) => i.id)).toEqual(expect.arrayContaining(['tipo-entidad', 'sede', 'area', 'poblacion', 'responsable']));
  });

  it('la ubicación pide ciudad y dirección, y un texto en blanco no cuenta', () => {
    const sinDireccion = groupStatus(characterization({ ...completo(), address: '   ' }));
    expect(sinDireccion.missing.map((i) => i.id)).toEqual(['ubicacion']);
    expect(groupStatus(characterization({ ...completo(), client: '' })).missing.map((i) => i.id)).toEqual(['entidad']);
  });

  it('la edad exige un año positivo y la tenencia exige elegir una', () => {
    const sinAnio = completo();
    sinAnio.building = { ...sinAnio.building, builtYear: 0, tenure: undefined };
    expect(groupStatus(characterization(sinAnio)).missing.map((i) => i.id)).toEqual(['edad', 'tenencia']);
  });

  it('la población cuenta con los usuarios o con estudiantes o personal', () => {
    const item = (p: Partial<Project>) => characterization({ ...completo(), ...p }).items.find((i) => i.id === 'poblacion')!;
    expect(item({}).ok).toBe(false);
    expect(item({ users: 900 }).ok).toBe(true);
    expect(item({ population: { students: 800 } }).ok).toBe(true);
    expect(item({ population: { floating: 30 } }).ok).toBe(false);
  });

  it('todos los grupos apuntan al paso donde se completan', () => {
    const grupos = checkCompliance({ project: nuevo() });
    expect(grupos.map((g) => g.id)).toEqual(['art4-a', 'art4-par3']);
    expect(grupos[0]).toMatchObject({ step: 'datos', reference: 'Res. 40412/2024, art. 4(a)' });
    expect(grupos[1]).toMatchObject({ step: 'pgee', reference: 'Res. 40412/2024, art. 4 par. 3 · Ley 1715, art. 30' });
  });

  it('el informe borrador dice qué falta de la caracterización', () => {
    expect(missingSentence([characterization(completo())])).toBe('');
    const frase = missingSentence([characterization(nuevo({ client: 'Universidad de ejemplo' }))]);
    expect(frase).toBe(
      'Faltan: ubicación (ciudad y dirección), entorno de la edificación, edad de la edificación, proceso o actividad desempeñada, horario de funcionamiento, tenencia del edificio.',
    );
  });
});

describe('art. 4, parágrafo 3, de la Res. 40412: PGEE con responsable y ruta anual', () => {
  const ruta = [{ year: 2027, measureCodes: ['M1'], targetPct: 15 }];
  const responsable = { name: 'Jefatura de Planeación', appointmentDoc: 'Resolución 0123 de 2026', appointmentDate: '2026-09-01' };

  it('sin PGEE faltan el responsable, la ruta y el ahorro del primer año; nada bloquea', () => {
    const estado = groupStatus(pgeeChecklist({ firstYear: null }));
    expect(estado).toMatchObject({ done: 0, total: 3, complete: false });
    expect(estado.missing.map((i) => i.id)).toEqual(['responsable', 'ruta', 'meta-legal']);
    expect(estado.suggested.map((i) => i.id)).toEqual(['designacion', 'financiacion']);
  });

  it('el responsable, la ruta guardada y el primer año en el 15 % o más completan lo obligatorio', () => {
    const grupo = pgeeChecklist({ pgee: { energyManager: responsable, annualRoute: ruta }, firstYear: { year: 2027, plannedPct: 21, meets: true } });
    expect(groupStatus(grupo)).toMatchObject({ done: 3, total: 3, complete: true });
    // Lo recomendado: el acto y la fecha ya están; falta el modelo financiero
    expect(groupStatus(grupo).suggested.map((i) => i.id)).toEqual(['financiacion']);
  });

  it('una propuesta sin confirmar no cuenta como ruta, y un primer año por debajo del 15 % no cumple', () => {
    const grupo = pgeeChecklist({ pgee: { energyManager: responsable }, firstYear: { year: 2027, plannedPct: 12, meets: false } });
    expect(groupStatus(grupo).missing.map((i) => i.id)).toEqual(['ruta', 'meta-legal']);
  });

  it('el responsable sin acto o sin fecha cumple lo obligatorio pero deja la designación como pendiente recomendada', () => {
    const grupo = pgeeChecklist({ pgee: { energyManager: { name: 'Jefatura de Planeación', appointmentDoc: 'Resolución 0123 de 2026' }, annualRoute: ruta, financing: { models: ['fenoge'] } }, firstYear: { year: 2027, plannedPct: 16, meets: true } });
    const estado = groupStatus(grupo);
    expect(estado.complete).toBe(true);
    expect(estado.suggested.map((i) => i.id)).toEqual(['designacion']);
    // Un nombre en blanco no cuenta como responsable
    expect(groupStatus(pgeeChecklist({ pgee: { energyManager: { name: '   ' } }, firstYear: null })).missing.map((i) => i.id)).toContain('responsable');
  });
});

describe('ciclo de la auditoría (Ley 1715, art. 30)', () => {
  it('la próxima auditoría vence cuatro años después', () => {
    expect(nextAuditDate('2026-09-29')).toBe('2030-09-29');
    expect(nextAuditDate('2025-12-31')).toBe('2029-12-31');
  });

  it('un 29 de febrero pasa al 28 si el año de destino no es bisiesto, y se conserva si lo es', () => {
    expect(nextAuditDate('2024-02-29')).toBe('2028-02-29');
    expect(nextAuditDate('2028-02-29')).toBe('2032-02-29');
    expect(nextAuditDate('2096-02-29')).toBe('2100-02-28');
  });

  it('rechaza fechas que no existen o están mal escritas', () => {
    expect(nextAuditDate(undefined)).toBeUndefined();
    expect(nextAuditDate('')).toBeUndefined();
    expect(nextAuditDate('29/09/2026')).toBeUndefined();
    expect(nextAuditDate('2026-02-30')).toBeUndefined();
    expect(nextAuditDate('2026-13-01')).toBeUndefined();
  });
});
