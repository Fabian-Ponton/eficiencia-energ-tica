import { describe, expect, it } from 'vitest';
import { art4Counts, verifyArt4, type Art4Input } from '@/domain/art4';
import { auditorChecklist } from '@/domain/auditor';
import { characterization, pgeeChecklist } from '@/domain/compliance';
import { createProjectRecord } from '@/db/projects';
import type { AuditorProfile, Project } from '@/domain/types';

const proyectoCompleto = (): Project => ({
  ...createProjectRecord({ name: 'Laboratorios' }),
  client: 'Universidad de ejemplo',
  city: 'Riohacha',
  address: 'Calle 1 # 2-3',
  areaM2: 1200,
  users: 300,
  operatingHours: 'Lunes a viernes, 07:00 – 21:00',
  entity: { kind: 'publica', order: 'territorial' },
  site: { name: 'Sede Riohacha', upmeCode: 'SEDE-01' },
  building: { builtYear: 1998, floors: 2, activity: 'Docencia y prácticas', surroundings: 'Campus urbano', tenure: 'propia' },
});

const perfil: AuditorProfile = {
  kind: 'natural-externa',
  name: 'Auditor de ejemplo',
  identityDocs: true,
  training: [{ id: 't', kind: 'certificacion', institution: 'Organismo de ejemplo', program: 'Auditor de sistemas de gestión de la energía', backed: true }],
  experience: [{ id: 'e', sector: 'oficial', description: 'Auditoría de un edificio público', certifier: 'Entidad de ejemplo', certifiedAt: '2025-11-20', backed: true }],
};

const rutaCompleta = { energyManager: { name: 'Jefatura de Planeación' }, annualRoute: [{ year: 2027, measureCodes: ['M1'], targetPct: 15 }] };

/** Entrada de un proyecto con todo registrado: cada prueba cambia solo lo que quiere probar. */
const completa = (extra: Partial<Art4Input> = {}): Art4Input => ({
  characterization: characterization(proyectoCompleto()),
  significantUses: 3,
  billMonths: 24,
  billsWithCost: 24,
  baselineMonths: 24,
  equipmentCount: 498,
  censusDeviation: 0.04,
  measures: { total: 4, evaluated: 4, prioritized: 4 },
  fnce: { excluded: false, quantified: true },
  indicators: true,
  hasManager: true,
  pgee: pgeeChecklist({ pgee: rutaCompleta, firstYear: { year: 2027, plannedPct: 20.8, meets: true } }),
  auditor: auditorChecklist(perfil),
  ...extra,
});

const fila = (input: Art4Input, id: string) => verifyArt4(input).find((r) => r.id === id)!;

describe('verificación del art. 4 de la Res. 40412 de 2024', () => {
  it('con todo registrado cumple los siete aspectos, los dos parágrafos y el art. 6', () => {
    const rows = verifyArt4(completa());
    expect(rows.map((r) => r.id)).toEqual(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'par2', 'par3', 'art6']);
    expect(rows.every((r) => r.status === 'cumple')).toBe(true);
    expect(rows.every((r) => r.missing.length === 0)).toBe(true);
    expect(art4Counts(rows)).toEqual({ cumple: 10, parcial: 0, pendiente: 0, total: 10 });
    // Cada aspecto dice dónde queda en el informe
    expect(rows.find((r) => r.id === 'b')?.parts).toEqual(['energia', 'balance', 'linea-base']);
    expect(rows.find((r) => r.id === 'art6')?.parts).toEqual(['anexo-auditor']);
  });

  it('un proyecto nuevo tiene todo pendiente y dice qué falta en cada aspecto', () => {
    const vacio: Art4Input = {
      characterization: characterization(createProjectRecord({ name: 'Nuevo' })),
      significantUses: 0,
      billMonths: 0,
      billsWithCost: 0,
      baselineMonths: null,
      equipmentCount: 0,
      censusDeviation: null,
      measures: { total: 0, evaluated: 0, prioritized: 0 },
      fnce: { excluded: false, quantified: false },
      indicators: false,
      hasManager: false,
      pgee: pgeeChecklist({ pgee: undefined, firstYear: null }),
      auditor: auditorChecklist(undefined),
    };
    const rows = verifyArt4(vacio);
    expect(art4Counts(rows)).toEqual({ cumple: 0, parcial: 0, pendiente: 10, total: 10 });
    expect(rows.every((r) => r.missing.length > 0)).toBe(true);
    expect(fila(vacio, 'a').evidence).toBe('0 de 7 datos obligatorios registrados');
    expect(fila(vacio, 'b').missing).toEqual(['usos significativos: falta el censo de carga', 'históricos de consumo: no hay facturas', 'línea base: se calcula con 12 meses de facturas']);
    expect(fila(vacio, 'c').evidence).toBe('Sin equipos registrados');
    expect(fila(vacio, 'e').missing).toEqual(['las medidas de ahorro con su evaluación económica']);
    expect(fila(vacio, 'g').missing).toEqual(['las medidas de ahorro para priorizarlas']);
    expect(fila(vacio, 'par2').missing).toEqual(['la línea base: se calcula con 12 meses de facturas']);
    // Las listas del PGEE y del auditor pasan sus faltantes tal como están escritos, con la primera letra en minúscula
    expect(fila(vacio, 'par3').missing).toEqual(['responsable del seguimiento y evaluación del plan', 'ruta de cumplimiento anual de ahorro', 'ahorro previsto de al menos 15 % el primer año']);
    expect(fila(vacio, 'art6').missing).toContain('cédula, RUT o certificado de existencia y representación legal reunido');
  });

  it('el uso de la energía (b) es parcial con pocas facturas: dice cuántas hay y qué falta', () => {
    const r = fila(completa({ billMonths: 8, billsWithCost: 6, baselineMonths: null }), 'b');
    expect(r.status).toBe('parcial');
    expect(r.evidence).toBe('3 usos significativos · 8 facturas');
    expect(r.missing).toEqual(['históricos de consumo: hay 8 facturas y se necesitan 12 meses', 'costos asociados: 2 facturas sin el valor', 'línea base: se calcula con 12 meses de facturas']);
    // Una sola factura se dice en singular
    expect(fila(completa({ billMonths: 1, billsWithCost: 1, baselineMonths: null }), 'b').missing[0]).toBe('históricos de consumo: hay 1 factura y se necesitan 12 meses');
  });

  it('los sistemas y equipos (c) piden un censo que explique el consumo facturado, con un margen de ±10 %', () => {
    expect(fila(completa({ censusDeviation: 0.1 }), 'c').status).toBe('cumple');
    const lejos = fila(completa({ censusDeviation: -0.25 }), 'c');
    expect(lejos.status).toBe('parcial');
    expect(lejos.missing).toEqual(['el censo difiere 25,0 % del consumo facturado: revisar horas de uso, factores de uso y equipos sin registrar']);
    // Sin facturas no hay con qué comparar y el censo basta
    expect(fila(completa({ censusDeviation: null }), 'c').status).toBe('cumple');
    expect(fila(completa({ equipmentCount: 1, censusDeviation: null }), 'c').evidence).toBe('1 equipo registrado');
  });

  it('el potencial (d) necesita medidas y la decisión sobre las FNCER: potencial cuantificado o exclusión', () => {
    expect(fila(completa({ fnce: { excluded: true, quantified: false } }), 'd').status).toBe('cumple');
    const sinDecidir = fila(completa({ fnce: { excluded: false, quantified: false } }), 'd');
    expect(sinDecidir.status).toBe('parcial');
    expect(sinDecidir.evidence).toBe('4 medidas evaluadas; FNCER sin decidir');
    expect(sinDecidir.missing).toEqual(['FNCER: falta el área de cubierta o las horas solares pico para el potencial, o excluirlas con una justificación']);
    const sinMedidas = fila(completa({ measures: { total: 0, evaluated: 0, prioritized: 0 } }), 'd');
    expect(sinMedidas.status).toBe('parcial');
    expect(sinMedidas.evidence).toBe('Sin medidas; FNCER con su potencial de referencia');
  });

  it('la evaluación (e) y la priorización (g) cuentan las medidas que las tienen', () => {
    const e = fila(completa({ measures: { total: 4, evaluated: 3, prioritized: 1 } }), 'e');
    expect(e).toMatchObject({ status: 'parcial', evidence: '3 de 4 medidas con ahorro e inversión' });
    expect(e.missing).toEqual(['1 medida sin ahorro o inversión para evaluarla']);
    const g = fila(completa({ measures: { total: 4, evaluated: 4, prioritized: 1 } }), 'g');
    expect(g).toMatchObject({ status: 'parcial', evidence: '1 de 4 medidas con prioridad fijada' });
    expect(g.missing).toEqual(['3 medidas sin prioridad fijada por el auditor (el informe sugiere una por el retorno)']);
  });

  it('los indicadores (f) necesitan cálculo y alguien que haga el seguimiento', () => {
    expect(fila(completa({ hasManager: false }), 'f')).toMatchObject({ status: 'parcial', evidence: 'Indicadores calculados; sin responsable del seguimiento' });
    expect(fila(completa({ hasManager: false }), 'f').missing).toEqual(['quién hace el seguimiento: el gestor energético del PGEE']);
    expect(fila(completa({ indicators: false, hasManager: false }), 'f').status).toBe('pendiente');
    expect(fila(completa({ indicators: false }), 'f')).toMatchObject({ status: 'parcial', missing: ['indicadores: necesitan el consumo de 12 meses y el área construida o los usuarios'] });
  });

  it('la línea base de la UPME (par. 2) pide 12 meses y recomienda 36', () => {
    expect(fila(completa({ baselineMonths: 36 }), 'par2')).toMatchObject({ status: 'cumple', evidence: 'Periodo base de 36 meses' });
    expect(fila(completa({ baselineMonths: 24 }), 'par2').evidence).toBe('Periodo base de 24 meses; la resolución recomienda tres años o justificar el periodo');
    expect(fila(completa({ baselineMonths: 24 }), 'par2').status).toBe('cumple');
    expect(fila(completa({ baselineMonths: 8 }), 'par2')).toMatchObject({ status: 'parcial', missing: ['el periodo base tiene 8 meses y se necesitan 12'] });
  });

  it('el PGEE (par. 3) y el auditor (art. 6) salen de sus listas de verificación', () => {
    const sinRuta = pgeeChecklist({ pgee: { energyManager: { name: 'Jefatura' } }, firstYear: null });
    const r = fila(completa({ pgee: sinRuta }), 'par3');
    expect(r.status).toBe('parcial');
    expect(r.evidence).toBe('1 de 3 datos obligatorios registrados');
    expect(r.missing).toEqual(['ruta de cumplimiento anual de ahorro', 'ahorro previsto de al menos 15 % el primer año']);
    const sinExperiencia = fila(completa({ auditor: auditorChecklist({ ...perfil, experience: [] }) }), 'art6');
    expect(sinExperiencia.status).toBe('parcial');
    expect(sinExperiencia.missing).toEqual(['experiencia de al menos una auditoría certificada por un tercero']);
  });
});
