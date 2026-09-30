import { describe, expect, it } from 'vitest';
import { auditorChecklist, auditorKindLabel, DEMAND_SECTORS, emptyAuditor, hasAuditorData, isCertifiedExperience, registryLines, registryReminderDate, sectorLabel } from '@/domain/auditor';
import { groupStatus, lowerFirst } from '@/domain/compliance';
import type { AuditorProfile } from '@/domain/types';

const completo = (): AuditorProfile => ({
  kind: 'natural-externa',
  name: 'Auditor de ejemplo',
  identityDocs: true,
  training: [{ id: 't1', kind: 'certificacion', institution: 'Organismo certificador de ejemplo', program: 'Auditor de sistemas de gestión de la energía', hours: 40, date: '2024-05-10', backed: true }],
  experience: [{ id: 'e1', sector: 'oficial', description: 'Auditoría energética de un edificio público', year: 2025, certifier: 'Entidad de ejemplo', certifiedAt: '2025-11-20', backed: true }],
});

describe('verificación del art. 6 de la Res. 40412 (auditor)', () => {
  it('un perfil vacío tiene pendiente todo lo obligatorio, sin bloquear nada', () => {
    const estado = groupStatus(auditorChecklist(undefined));
    expect(estado).toMatchObject({ done: 0, total: 5, complete: false });
    expect(estado.missing.map((i) => i.id)).toEqual(['tipo', 'nombre', 'identidad', 'formacion', 'experiencia']);
    expect(estado.suggested.map((i) => i.id)).toEqual(['matricula']);
    expect(auditorChecklist(undefined)).toMatchObject({ id: 'art6', step: 'auditor', reference: 'Res. 40412/2024, art. 6' });
  });

  it('con tipo, nombre, documentos reunidos, formación con soporte y experiencia certificada por un tercero, queda completo', () => {
    const estado = groupStatus(auditorChecklist(completo()));
    expect(estado).toMatchObject({ done: 5, total: 5, complete: true });
    // La matrícula es recomendada: no impide estar completo
    expect(estado.suggested.map((i) => i.id)).toEqual(['matricula']);
  });

  it('la formación cuenta solo con soporte reunido, programa e institución', () => {
    const sinSoporte = completo();
    sinSoporte.training[0].backed = false;
    expect(groupStatus(auditorChecklist(sinSoporte)).missing.map((i) => i.id)).toEqual(['formacion']);
    const sinPrograma = completo();
    sinPrograma.training[0].program = '  ';
    expect(groupStatus(auditorChecklist(sinPrograma)).missing.map((i) => i.id)).toEqual(['formacion']);
  });

  it('la experiencia exige el certificado de un tercero: quién, cuándo y el documento reunido', () => {
    const cambia = (extra: Partial<AuditorProfile['experience'][number]>) => {
      const p = completo();
      p.experience[0] = { ...p.experience[0], ...extra };
      return p;
    };
    expect(isCertifiedExperience(completo().experience[0])).toBe(true);
    for (const extra of [{ certifier: '' }, { certifiedAt: undefined }, { backed: false }, { description: ' ' }]) {
      expect(groupStatus(auditorChecklist(cambia(extra))).missing.map((i) => i.id), JSON.stringify(extra)).toEqual(['experiencia']);
    }
  });

  it('una matrícula con número, del COPNIA o del CONTE, cumple lo recomendado', () => {
    const p = { ...completo(), conte: { number: 'T-123', categories: ['TE-1'] } };
    expect(groupStatus(auditorChecklist(p)).suggested).toEqual([]);
    expect(groupStatus(auditorChecklist({ ...completo(), copnia: { number: '  ' } })).suggested.map((i) => i.id)).toEqual(['matricula']);
  });
});

describe('perfil del auditor en el informe', () => {
  it('sin nada registrado no hay nada que imprimir', () => {
    expect(hasAuditorData(undefined)).toBe(false);
    expect(hasAuditorData(emptyAuditor())).toBe(false);
    expect(hasAuditorData({ ...emptyAuditor(), name: 'Auditor de ejemplo' })).toBe(true);
    expect(hasAuditorData({ ...emptyAuditor(), copnia: { number: '123' } })).toBe(true);
  });

  it('las matrículas salen con su detalle; el número se oculta si el auditor lo prefiere', () => {
    const p: AuditorProfile = {
      ...emptyAuditor(),
      copnia: { number: 'CO-999', profession: 'Ingeniería eléctrica', status: 'vigente' },
      conte: { number: 'CT-000', categories: ['TE-1', 'TE-4'], status: 'sin-verificar' },
    };
    expect(registryLines(p)).toEqual([
      'Matrícula profesional (COPNIA): Ingeniería eléctrica · Vigente · N.º CO-999',
      'Matrícula técnica (CONTE): TE-1, TE-4 · Sin verificar · N.º CT-000',
    ]);
    expect(registryLines({ ...p, hideRegistryNumbers: true })).toEqual(['Matrícula profesional (COPNIA): Ingeniería eléctrica · Vigente', 'Matrícula técnica (CONTE): TE-1, TE-4 · Sin verificar']);
    // Solo el número, oculto: dice que hay matrícula sin imprimirla
    expect(registryLines({ ...emptyAuditor(), copnia: { number: 'CO-1' }, hideRegistryNumbers: true })).toEqual(['Matrícula profesional (COPNIA): registrada']);
    expect(registryLines(emptyAuditor())).toEqual([]);
  });

  it('el recordatorio interno suma los meses a la última consulta; no es un plazo de la ley', () => {
    const p: AuditorProfile = { ...emptyAuditor(), reminderMonths: 12, copnia: { verifiedAt: '2026-03-31' }, conte: { verifiedAt: '2026-09-30' } };
    expect(registryReminderDate(p)).toBe('2027-09-30');
    // Un fin de mes que no existe en el mes de destino baja al último día
    expect(registryReminderDate({ ...emptyAuditor(), reminderMonths: 1, copnia: { verifiedAt: '2026-01-31' } })).toBe('2026-02-28');
    expect(registryReminderDate({ ...p, reminderMonths: undefined })).toBeUndefined();
    expect(registryReminderDate({ ...emptyAuditor(), reminderMonths: 6 })).toBeUndefined();
  });

  it('el detalle de lo que falta baja solo la primera letra: las siglas quedan como están', () => {
    expect(lowerFirst('Cédula, RUT o certificado de existencia')).toBe('cédula, RUT o certificado de existencia');
    expect(lowerFirst('')).toBe('');
  });

  it('nombres legibles del tipo de auditor y del sector', () => {
    expect(auditorKindLabel('juridica')).toBe('Persona jurídica');
    expect(auditorKindLabel(undefined)).toBe('');
    expect(DEMAND_SECTORS.map((s) => s.id)).toEqual(['oficial', 'industria', 'residencial', 'transporte', 'servicios']);
    expect(sectorLabel('servicios')).toBe('Servicios');
  });
});
