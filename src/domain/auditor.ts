import type { ChecklistGroup } from './compliance';
import type { AuditorKind, AuditorProfile, DemandSector, ProfessionalRegistry } from './types';

/**
 * Datos del auditor y verificación del art. 6 de la Res. MME 40412 de 2024: la auditoría puede hacerla una persona jurídica, una persona
 * natural externa o personal propio de la entidad, «que cuenten con certificación o diploma nacional o internacional en materia de
 * Sistemas de Gestión de Energía, Auditorías Energéticas o afines y con experiencia de al menos una (1) auditoría energética realizada en
 * alguno de los sectores de demanda». Para una persona jurídica, esos requisitos se acreditan con el personal vinculado (par. 1). La
 * entidad verifica (par. 2): a) cédula, RUT o certificado de existencia y representación legal; b) nombre o razón social; c) documento
 * de la formación; d) certificado de un tercero que acredite la experiencia.
 *
 * PONTIA solo registra y avisa: la experiencia certificada por un tercero no la puede cumplir la aplicación. Nunca guarda la cédula.
 */

export const AUDITOR_KINDS: readonly { id: AuditorKind; label: string; hint: string }[] = [
  { id: 'natural-externa', label: 'Persona natural externa', hint: 'Contratada por la entidad.' },
  { id: 'personal-propio', label: 'Personal de la entidad', hint: 'Funcionario o contratista vinculado a la administración pública auditada.' },
  { id: 'juridica', label: 'Persona jurídica', hint: 'Una empresa; la formación y la experiencia se acreditan con el personal vinculado (art. 6, par. 1).' },
];
export const auditorKindLabel = (id: AuditorKind | undefined) => AUDITOR_KINDS.find((k) => k.id === id)?.label ?? '';

export const DEMAND_SECTORS: readonly { id: DemandSector; label: string }[] = [
  { id: 'oficial', label: 'Oficial' },
  { id: 'industria', label: 'Industria' },
  { id: 'residencial', label: 'Residencial' },
  { id: 'transporte', label: 'Transporte' },
  { id: 'servicios', label: 'Servicios' },
];
export const sectorLabel = (id: DemandSector) => DEMAND_SECTORS.find((s) => s.id === id)?.label ?? id;

/** Clases de la matrícula técnica del CONTE (RETIE, art. 3.3.2: TE-1, TE-4 y TE-6 en esquemas constructivos). */
export const CONTE_CATEGORIES = ['TE-1', 'TE-2', 'TE-3', 'TE-4', 'TE-5', 'TE-6'] as const;

export const REGISTRY_STATUS_LABEL = { vigente: 'Vigente', suspendida: 'Suspendida', 'sin-verificar': 'Sin verificar' } as const;

export const emptyAuditor = (): AuditorProfile => ({ training: [], experience: [] });

const filled = (value: string | undefined) => Boolean(value?.trim());

/** Una experiencia cuenta si está certificada por un tercero, con su fecha y su soporte reunido. */
export const isCertifiedExperience = (e: AuditorProfile['experience'][number]) => filled(e.certifier) && Boolean(e.certifiedAt) && e.backed && filled(e.description);

/** Lista de verificación del art. 6: lo obligatorio es lo que la entidad debe comprobar del auditor. */
export function auditorChecklist(profile?: AuditorProfile): ChecklistGroup {
  const p = profile ?? emptyAuditor();
  return {
    id: 'art6',
    reference: 'Res. 40412/2024, art. 6',
    title: 'Auditor energético',
    step: 'auditor',
    items: [
      { id: 'tipo', label: 'Tipo de auditor', ok: Boolean(p.kind), level: 'obligatorio' },
      { id: 'nombre', label: 'Nombre completo o razón social', ok: filled(p.name), level: 'obligatorio' },
      { id: 'identidad', label: 'Cédula, RUT o certificado de existencia y representación legal reunido', ok: p.identityDocs === true, level: 'obligatorio' },
      { id: 'formacion', label: 'Diploma o certificación en gestión de la energía o auditorías, con su soporte', ok: p.training.some((t) => t.backed && filled(t.program) && filled(t.institution)), level: 'obligatorio' },
      { id: 'experiencia', label: 'Experiencia de al menos una auditoría certificada por un tercero', ok: p.experience.some(isCertifiedExperience), level: 'obligatorio' },
      { id: 'matricula', label: 'Matrícula profesional (COPNIA) o técnica (CONTE)', ok: filled(p.copnia?.number) || filled(p.conte?.number), level: 'recomendado' },
    ],
  };
}

const registryLine = (label: string, r: ProfessionalRegistry | undefined, hideNumber: boolean): string | null => {
  if (!r || (!filled(r.number) && !filled(r.profession) && !r.categories?.length)) return null;
  const detail = [r.profession, r.categories?.join(', '), r.status ? REGISTRY_STATUS_LABEL[r.status] : undefined, r.number && !hideNumber ? `N.º ${r.number}` : undefined].filter(Boolean).join(' · ');
  return `${label}: ${detail || (r.number ? 'registrada' : '')}`.trim();
};

/** Líneas de las matrículas para el informe; el número se oculta si el auditor lo prefiere. */
export function registryLines(profile: AuditorProfile): string[] {
  return [registryLine('Matrícula profesional (COPNIA)', profile.copnia, Boolean(profile.hideRegistryNumbers)), registryLine('Matrícula técnica (CONTE)', profile.conte, Boolean(profile.hideRegistryNumbers))].filter((l): l is string => Boolean(l));
}

/** ¿Tiene el perfil algo que imprimir? */
export const hasAuditorData = (profile?: AuditorProfile): boolean =>
  Boolean(profile && (filled(profile.name) || profile.kind || profile.training.length || profile.experience.length || profile.copnia?.number || profile.conte?.number));

/**
 * Recordatorio interno para volver a consultar las matrículas. No es un plazo legal: la ley no fija vigencia a la consulta y el CONTE indica que
 * la matrícula es vitalicia salvo suspensión. Devuelve la fecha (AAAA-MM-DD) o `undefined` si no hay recordatorio o consulta previa.
 */
export function registryReminderDate(profile: AuditorProfile): string | undefined {
  const months = profile.reminderMonths;
  const last = [profile.copnia?.verifiedAt, profile.conte?.verifiedAt].filter((d): d is string => Boolean(d)).sort().at(-1);
  if (!months || months <= 0 || !last || !/^\d{4}-\d{2}-\d{2}$/.test(last)) return undefined;
  const [year, month, day] = last.split('-').map(Number);
  const total = year * 12 + (month - 1) + months;
  const targetYear = Math.floor(total / 12);
  const targetMonth = (total % 12) + 1;
  const lastDay = new Date(targetYear, targetMonth, 0).getDate();
  return `${targetYear}-${String(targetMonth).padStart(2, '0')}-${String(Math.min(day, lastDay)).padStart(2, '0')}`;
}
