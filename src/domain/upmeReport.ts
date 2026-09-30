import { auditorChecklist } from './auditor';
import { characterization, groupStatus, lowerFirst, nextAuditDate, pgeeChecklist, type PgeeSource } from './compliance';
import type { FirstYearCheck } from './route';
import type { AuditorProfile, Measure, Project, UpmeCycle } from './types';
import type { UpmeBaseline } from './upmeBaseline';

/**
 * Reporte de la auditoría a la UPME (Ley 1715, art. 30, modificado por la Ley 2294, art. 237; Res. MME 40412, art. 5; Circular UPME 089 de 2025):
 * en el SUU, «Módulo de Medidas Art. 237», un caso por sede con su código único y las secciones de datos de edificación, caracterización de la
 * energía, línea base y oportunidades de ahorro. PONTIA no envía nada: el SUU exige el usuario de la entidad. Lo que hace es dejar todo listo
 * para diligenciarlo y decir qué falta.
 */

export interface ReadinessItem {
  id: string;
  label: string;
  ok: boolean;
  level: 'obligatorio' | 'recomendado';
  /** Qué falta o por qué está incompleto. */
  detail?: string;
  /** Paso o pantalla donde se completa: id del paso del menú, `auditor` o `reporte-upme`. */
  step: string;
}

export interface UpmeReadiness {
  items: ReadinessItem[];
  /** Lo obligatorio está completo: se puede reportar. */
  ready: boolean;
  missing: ReadinessItem[];
  done: number;
  total: number;
}

const filled = (value: string | undefined) => Boolean(value?.trim());

/** «¿Listo para reportar?»: cada renglón sale de los datos del proyecto, no se marca a mano. */
export function upmeReadiness(input: {
  project: Project;
  auditor?: AuditorProfile;
  pgee?: PgeeSource;
  firstYear: FirstYearCheck | null;
  upme: UpmeBaseline | null;
  measures: readonly Measure[];
  cycle?: Pick<UpmeCycle, 'caseNumber'>;
}): UpmeReadiness {
  const { project } = input;
  const built = groupStatus(characterization(project));
  const pgee = groupStatus(pgeeChecklist({ pgee: input.pgee, firstYear: input.firstYear }));
  const auditor = groupStatus(auditorChecklist(input.auditor));
  const plan = input.measures.filter((m) => m.selected);
  const months = input.upme?.months ?? 0;
  const sedeMissing = [!filled(project.site?.upmeCode) ? 'el código único de la sede' : '', !filled(project.nit) ? 'el NIT de la entidad' : ''].filter(Boolean);

  const items: ReadinessItem[] = [
    {
      id: 'caracterizacion',
      label: 'Datos de la edificación y de la entidad (art. 4, aspecto (a))',
      ok: built.complete,
      level: 'obligatorio',
      detail: built.missing.length ? `Faltan: ${built.missing.map((i) => lowerFirst(i.label)).join(', ')}.` : undefined,
      step: 'datos',
    },
    {
      id: 'sede',
      label: 'Sede con su código único y NIT de la entidad (un caso por sede)',
      ok: sedeMissing.length === 0,
      level: 'obligatorio',
      detail: sedeMissing.length ? `Falta ${sedeMissing.join(' y ')}.` : undefined,
      step: 'datos',
    },
    { id: 'fecha', label: 'Fecha de la auditoría (cada cuatro años)', ok: filled(project.audit?.date), level: 'obligatorio', step: 'datos' },
    {
      id: 'linea-base',
      label: 'Línea base con al menos 12 meses de facturas',
      ok: months >= 12,
      level: 'obligatorio',
      detail: months >= 12 ? undefined : months ? `Hay ${months} ${months === 1 ? 'mes' : 'meses'} de facturas.` : 'No hay facturas para calcularla.',
      step: 'facturacion',
    },
    {
      id: 'periodo',
      label: 'Periodo base de 36 meses, o su justificación por escrito',
      ok: months >= 36 || filled(project.baseline?.note),
      level: 'recomendado',
      detail: months >= 36 || filled(project.baseline?.note) ? undefined : `El periodo base tiene ${months} meses: la resolución recomienda tres años.`,
      step: 'balance',
    },
    { id: 'oportunidades', label: 'Medidas de ahorro evaluadas e incluidas en el plan', ok: plan.length > 0, level: 'obligatorio', step: 'oportunidades' },
    {
      id: 'pgee',
      label: 'PGEE con responsable, ruta anual y el 15 % del primer año',
      ok: pgee.complete,
      level: 'obligatorio',
      detail: pgee.missing.length ? `Faltan: ${pgee.missing.map((i) => lowerFirst(i.label)).join(', ')}.` : undefined,
      step: 'pgee',
    },
    {
      id: 'auditor',
      label: 'Datos del auditor (art. 6)',
      ok: auditor.complete,
      level: 'obligatorio',
      detail: auditor.missing.length ? `Faltan: ${auditor.missing.map((i) => lowerFirst(i.label)).join(', ')}.` : undefined,
      step: 'auditor',
    },
    { id: 'caso', label: 'Número de caso del SUU (para los nombres de los archivos)', ok: filled(input.cycle?.caseNumber), level: 'recomendado', step: 'reporte-upme' },
  ];
  const required = items.filter((i) => i.level === 'obligatorio');
  const missing = required.filter((i) => !i.ok);
  return { items, ready: missing.length === 0, missing, done: required.length - missing.length, total: required.length };
}

/** Nombres de los archivos del reporte: `ART237_<año>_<n.º de caso>_Informe de Auditoría` y `…_Anexos Auditorías` (Circular UPME 089 de 2025). */
export type UpmeFileKind = 'informe' | 'anexos' | 'paquete';

const CASE_UNSAFE = /[^A-Za-z0-9._-]+/g;

export function upmeFileName(kind: UpmeFileKind, cycle: { year: number; caseNumber?: string }): string {
  const caso = (cycle.caseNumber ?? '').trim().replace(CASE_UNSAFE, '-').replace(/^-+|-+$/g, '') || 'XXX';
  const base = `ART237_${cycle.year}_${caso}`;
  return kind === 'informe' ? `${base}_Informe de Auditoría.docx` : kind === 'anexos' ? `${base}_Anexos Auditorías.zip` : `${base}_Paquete de datos.xlsx`;
}

export interface NextAudit {
  /** Fecha en que vence la auditoría (AAAA-MM-DD). */
  due: string;
  /** Días hasta el vencimiento; negativo si ya venció. */
  days: number;
  overdue: boolean;
  /** Vence en los próximos seis meses. */
  soon: boolean;
}

/** Próxima auditoría (cada cuatro años) y qué tan cerca está. */
/**
 * Aviso de la próxima auditoría para el inicio del proyecto y la lista: solo si la entidad no es privada (la ley obliga a las públicas) y la
 * auditoría vence en los próximos seis meses o ya venció. Fuera de eso, no hay aviso.
 */
export function auditAlert(project: Pick<Project, 'audit' | 'entity'>, today: Date): NextAudit | null {
  if (project.entity?.kind === 'privada') return null;
  const next = nextAudit(project.audit?.date, today);
  return next && (next.soon || next.overdue) ? next : null;
}

export function nextAudit(auditDate: string | undefined, today: Date): NextAudit | null {
  const due = nextAuditDate(auditDate);
  if (!due) return null;
  const [year, month, day] = due.split('-').map(Number);
  const start = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const days = Math.round((Date.UTC(year, month - 1, day) - start) / 86_400_000);
  return { due, days, overdue: days < 0, soon: days >= 0 && days <= 183 };
}
