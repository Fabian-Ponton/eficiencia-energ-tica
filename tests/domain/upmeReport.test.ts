import { describe, expect, it } from 'vitest';
import { createProjectRecord } from '@/db/projects';
import { auditAlert, nextAudit, upmeFileName, upmeReadiness } from '@/domain/upmeReport';
import type { AuditorProfile, Measure, Project } from '@/domain/types';
import type { UpmeBaseline } from '@/domain/upmeBaseline';

const proyecto = (extra: Partial<Project> = {}): Project => ({
  ...createProjectRecord({ name: 'Laboratorios' }),
  client: 'Universidad de ejemplo',
  nit: '900.000.000-0',
  city: 'Riohacha',
  address: 'Calle 1 # 2-3',
  operatingHours: 'Lunes a viernes, 07:00 – 21:00',
  building: { builtYear: 1998, floors: 2, activity: 'Docencia y prácticas', surroundings: 'Campus urbano', tenure: 'propia' },
  site: { name: 'Sede Riohacha', upmeCode: 'SEDE-01' },
  audit: { date: '2026-09-29' },
  ...extra,
});

const auditor: AuditorProfile = {
  kind: 'personal-propio',
  name: 'Auditor de ejemplo',
  identityDocs: true,
  training: [{ id: 't', kind: 'diploma', institution: 'Universidad', program: 'Gestión de la energía', backed: true }],
  experience: [{ id: 'e', sector: 'oficial', description: 'Auditoría de un edificio público', certifier: 'Entidad', certifiedAt: '2025-10-01', backed: true }],
};

const medida = { id: 'm', selected: true } as Measure;
const pgee = { energyManager: { name: 'Jefatura de Planeación' }, annualRoute: [{ year: 2027, measureCodes: ['M1'], targetPct: 15 }] };
const listo = () => ({ project: proyecto(), auditor, pgee, firstYear: { year: 2027, plannedPct: 21, meets: true }, upme: { months: 36 } as UpmeBaseline, measures: [medida], cycle: { caseNumber: 'C-1' } });

describe('¿listo para reportar a la UPME?', () => {
  it('con todo registrado no falta nada', () => {
    const r = upmeReadiness(listo());
    expect(r).toMatchObject({ ready: true, done: 7, total: 7 });
    expect(r.missing).toEqual([]);
    expect(r.items.every((i) => i.ok)).toBe(true);
  });

  it('un proyecto nuevo dice exactamente qué falta y dónde se completa', () => {
    const r = upmeReadiness({ project: createProjectRecord({ name: 'Nuevo' }), firstYear: null, upme: null, measures: [] });
    expect(r.ready).toBe(false);
    expect(r.done).toBe(0);
    expect(r.missing.map((i) => [i.id, i.step])).toEqual([
      ['caracterizacion', 'datos'],
      ['sede', 'datos'],
      ['fecha', 'datos'],
      ['linea-base', 'facturacion'],
      ['oportunidades', 'oportunidades'],
      ['pgee', 'pgee'],
      ['auditor', 'auditor'],
    ]);
    expect(r.items.find((i) => i.id === 'sede')?.detail).toBe('Falta el código único de la sede y el NIT de la entidad.');
    expect(r.items.find((i) => i.id === 'linea-base')?.detail).toBe('No hay facturas para calcularla.');
    expect(r.items.find((i) => i.id === 'caracterizacion')?.detail).toContain('ubicación (ciudad y dirección)');
  });

  it('la sede pide el código y el NIT; con uno solo dice cuál falta', () => {
    const sinCodigo = upmeReadiness({ ...listo(), project: proyecto({ site: { name: 'Sede Riohacha' } }) });
    expect(sinCodigo.items.find((i) => i.id === 'sede')?.detail).toBe('Falta el código único de la sede.');
    const sinNit = upmeReadiness({ ...listo(), project: proyecto({ nit: undefined }) });
    expect(sinNit.items.find((i) => i.id === 'sede')?.detail).toBe('Falta el NIT de la entidad.');
  });

  it('la línea base necesita 12 meses; menos de 36 pide la justificación, pero solo es recomendado', () => {
    const corta = upmeReadiness({ ...listo(), upme: { months: 8 } as UpmeBaseline });
    expect(corta.ready).toBe(false);
    expect(corta.items.find((i) => i.id === 'linea-base')?.detail).toBe('Hay 8 meses de facturas.');

    const dosAnios = upmeReadiness({ ...listo(), upme: { months: 24 } as UpmeBaseline });
    expect(dosAnios.ready).toBe(true);
    expect(dosAnios.items.find((i) => i.id === 'periodo')).toMatchObject({ ok: false, level: 'recomendado', detail: 'El periodo base tiene 24 meses: la resolución recomienda tres años.' });
    // Con la justificación escrita, se da por atendido
    const justificada = upmeReadiness({ ...listo(), project: proyecto({ baseline: { note: 'El edificio se puso en servicio hace dos años' } }), upme: { months: 24 } as UpmeBaseline });
    expect(justificada.items.find((i) => i.id === 'periodo')?.ok).toBe(true);
  });

  it('el PGEE y el auditor cuentan con lo que les falta', () => {
    const r = upmeReadiness({ ...listo(), pgee: { energyManager: { name: 'Jefatura' } }, firstYear: { year: 2027, plannedPct: 10, meets: false }, auditor: { ...auditor, identityDocs: false } });
    expect(r.ready).toBe(false);
    expect(r.items.find((i) => i.id === 'pgee')?.detail).toBe('Faltan: ruta de cumplimiento anual de ahorro, ahorro previsto de al menos 15 % el primer año.');
    expect(r.items.find((i) => i.id === 'auditor')?.detail).toBe('Faltan: cédula, RUT o certificado de existencia y representación legal reunido.');
  });

  it('el número de caso es recomendado y no impide reportar', () => {
    const r = upmeReadiness({ ...listo(), cycle: { caseNumber: '  ' } });
    expect(r.ready).toBe(true);
    expect(r.items.find((i) => i.id === 'caso')).toMatchObject({ ok: false, level: 'recomendado', step: 'reporte-upme' });
  });
});

describe('nombres de los archivos del reporte (Circular UPME 089 de 2025)', () => {
  it('ART237, el año, el número de caso y el tipo de archivo', () => {
    expect(upmeFileName('informe', { year: 2026, caseNumber: 'C-123' })).toBe('ART237_2026_C-123_Informe de Auditoría.docx');
    expect(upmeFileName('anexos', { year: 2026, caseNumber: 'C-123' })).toBe('ART237_2026_C-123_Anexos Auditorías.zip');
    expect(upmeFileName('paquete', { year: 2027, caseNumber: 'C-123' })).toBe('ART237_2027_C-123_Paquete de datos.xlsx');
  });

  it('sin número de caso queda «XXX» y el número se limpia de caracteres que no van en un nombre de archivo', () => {
    expect(upmeFileName('informe', { year: 2026 })).toBe('ART237_2026_XXX_Informe de Auditoría.docx');
    expect(upmeFileName('informe', { year: 2026, caseNumber: '   ' })).toBe('ART237_2026_XXX_Informe de Auditoría.docx');
    expect(upmeFileName('anexos', { year: 2026, caseNumber: ' UPME 123/2026: sede 1 ' })).toBe('ART237_2026_UPME-123-2026-sede-1_Anexos Auditorías.zip');
  });
});

describe('próxima auditoría, cada cuatro años (Ley 1715, art. 30)', () => {
  it('vence cuatro años después de la auditoría y dice cuántos días faltan', () => {
    const a = nextAudit('2026-09-29', new Date(2030, 0, 1))!;
    expect(a.due).toBe('2030-09-29');
    expect(a.days).toBe(271);
    expect(a).toMatchObject({ overdue: false, soon: false });
  });

  it('avisa cuando faltan seis meses o menos y cuando ya venció', () => {
    expect(nextAudit('2026-09-29', new Date(2030, 5, 1))).toMatchObject({ days: 120, soon: true, overdue: false });
    const vencida = nextAudit('2026-09-29', new Date(2031, 0, 1))!;
    expect(vencida.overdue).toBe(true);
    expect(vencida.days).toBeLessThan(0);
    expect(vencida.soon).toBe(false);
    // El mismo día del vencimiento todavía no está vencida
    expect(nextAudit('2026-09-29', new Date(2030, 8, 29))).toMatchObject({ days: 0, overdue: false, soon: true });
  });

  it('el aviso del inicio y de la lista solo sale cerca del vencimiento y no para entidades privadas', () => {
    const publica = { audit: { date: '2026-09-29' }, entity: { kind: 'publica' as const } };
    // Faltan más de seis meses: no hay aviso
    expect(auditAlert(publica, new Date(2030, 0, 1))).toBeNull();
    expect(auditAlert(publica, new Date(2030, 5, 1))).toMatchObject({ due: '2030-09-29', days: 120, soon: true });
    expect(auditAlert(publica, new Date(2031, 0, 1))).toMatchObject({ overdue: true });
    // Sin tipo de entidad todavía se avisa; una entidad privada no tiene esta obligación
    expect(auditAlert({ audit: { date: '2026-09-29' } }, new Date(2030, 5, 1))).not.toBeNull();
    expect(auditAlert({ ...publica, entity: { kind: 'privada' } }, new Date(2031, 0, 1))).toBeNull();
    expect(auditAlert({ entity: { kind: 'publica' } }, new Date(2031, 0, 1))).toBeNull();
  });

  it('sin fecha, o con una fecha que no existe, no hay próxima auditoría', () => {
    expect(nextAudit(undefined, new Date(2030, 0, 1))).toBeNull();
    expect(nextAudit('2026-02-30', new Date(2030, 0, 1))).toBeNull();
  });
});
