import type { FirstYearCheck } from './route';
import type { Pgee, Project } from './types';

/**
 * Lo que la norma pide que contenga la auditoría y el informe, verificado contra los datos del proyecto.
 * Cada módulo agrega aquí su grupo. Nada de esto bloquea el trabajo: un proyecto incompleto se puede
 * seguir llenando y se puede generar un informe borrador que dice qué falta.
 */

/** Auditoría cada cuatro años. Fuente: Ley 1715 de 2014, art. 30, modificado por la Ley 2294 de 2023, art. 237 (verificado el 2026-09-29). */
export const AUDIT_CYCLE_YEARS = 4;

export interface ChecklistItem {
  id: string;
  label: string;
  ok: boolean;
  /** `obligatorio`: lo pide la norma y cuenta para el avance. `recomendado`: mejora el informe, pero no se exige. */
  level: 'obligatorio' | 'recomendado';
}

export interface ChecklistGroup {
  id: string;
  /** Norma y literal, por ejemplo «Res. 40412/2024, art. 4(a)». */
  reference: string;
  title: string;
  /** Paso de la app donde se completa (mismo id que el menú). */
  step: string;
  items: ChecklistItem[];
}

export interface GroupStatus {
  /** Datos obligatorios completos y total de obligatorios. */
  done: number;
  total: number;
  complete: boolean;
  missing: ChecklistItem[];
  /** Recomendados que faltan: no impiden nada. */
  suggested: ChecklistItem[];
}

export function groupStatus(group: ChecklistGroup): GroupStatus {
  const required = group.items.filter((i) => i.level === 'obligatorio');
  const missing = required.filter((i) => !i.ok);
  return {
    done: required.length - missing.length,
    total: required.length,
    complete: missing.length === 0,
    missing,
    suggested: group.items.filter((i) => i.level === 'recomendado' && !i.ok),
  };
}

const filled = (value: string | undefined) => Boolean(value?.trim());
const positive = (value: number | undefined) => typeof value === 'number' && Number.isFinite(value) && value > 0;

/** Los campos del proyecto que revisa el literal (a). Permite revisar un formulario a medio guardar. */
export type CharacterizationSource = Pick<
  Project,
  'client' | 'city' | 'address' | 'operatingHours' | 'areaM2' | 'users' | 'entity' | 'site' | 'building' | 'population' | 'institutionalContact'
>;

/**
 * Res. MME 40412 de 2024, art. 4(a): caracterización de la administración pública con «ubicación y entorno, edad de la
 * edificación, proceso o actividad desempeñada, horario de funcionamiento» y si la sede es «compartida, en alquiler,
 * comodato, otros o propia». El artículo dice «parámetros tales como y no limitados a»: los obligatorios son los que cita.
 */
export function characterization(p: CharacterizationSource): ChecklistGroup {
  const b = p.building;
  const population = p.population;
  return {
    id: 'art4-a',
    reference: 'Res. 40412/2024, art. 4(a)',
    title: 'Caracterización de la entidad',
    step: 'datos',
    items: [
      { id: 'entidad', label: 'Entidad o cliente', ok: filled(p.client), level: 'obligatorio' },
      { id: 'ubicacion', label: 'Ubicación (ciudad y dirección)', ok: filled(p.city) && filled(p.address), level: 'obligatorio' },
      { id: 'entorno', label: 'Entorno de la edificación', ok: filled(b?.surroundings), level: 'obligatorio' },
      { id: 'edad', label: 'Edad de la edificación', ok: positive(b?.builtYear), level: 'obligatorio' },
      { id: 'actividad', label: 'Proceso o actividad desempeñada', ok: filled(b?.activity), level: 'obligatorio' },
      { id: 'horario', label: 'Horario de funcionamiento', ok: filled(p.operatingHours), level: 'obligatorio' },
      { id: 'tenencia', label: 'Tenencia del edificio', ok: Boolean(b?.tenure), level: 'obligatorio' },
      { id: 'tipo-entidad', label: 'Tipo de entidad (pública o privada)', ok: Boolean(p.entity?.kind), level: 'recomendado' },
      { id: 'sede', label: 'Nombre de la sede', ok: filled(p.site?.name), level: 'recomendado' },
      { id: 'pisos', label: 'Número de pisos', ok: positive(b?.floors), level: 'recomendado' },
      { id: 'area', label: 'Área construida', ok: positive(p.areaM2), level: 'recomendado' },
      { id: 'poblacion', label: 'Población fija y flotante', ok: positive(p.users) || positive(population?.students) || positive(population?.staff), level: 'recomendado' },
      { id: 'responsable', label: 'Responsable institucional', ok: filled(p.institutionalContact?.name), level: 'recomendado' },
    ],
  };
}

/** Lo del PGEE que revisa el grupo del art. 4, par. 3. */
export type PgeeSource = Pick<Pgee, 'energyManager' | 'annualRoute' | 'financing'>;

/**
 * Res. MME 40412 de 2024, art. 4, par. 3: el PGEE incluye «una ruta de cumplimiento anual de ahorro energético» y un responsable «para
 * el seguimiento y evaluación del PGEE». Ley 1715 de 2014, art. 30: en el año siguiente a la auditoría, estrategias que permitan un
 * ahorro de mínimo 15 % del consumo del año anterior. La lista dice si lo que el auditor registró lo cubre; no certifica el ahorro real.
 */
export function pgeeChecklist(input: { pgee?: PgeeSource; firstYear: FirstYearCheck | null }): ChecklistGroup {
  const manager = input.pgee?.energyManager;
  return {
    id: 'art4-par3',
    reference: 'Res. 40412/2024, art. 4 par. 3 · Ley 1715, art. 30',
    title: 'PGEE: responsable y ruta anual',
    step: 'pgee',
    items: [
      { id: 'responsable', label: 'Responsable del seguimiento y evaluación del plan', ok: filled(manager?.name), level: 'obligatorio' },
      { id: 'ruta', label: 'Ruta de cumplimiento anual de ahorro', ok: Boolean(input.pgee?.annualRoute?.length), level: 'obligatorio' },
      { id: 'meta-legal', label: 'Ahorro previsto de al menos 15 % el primer año', ok: input.firstYear?.meets === true, level: 'obligatorio' },
      { id: 'designacion', label: 'Acto y fecha de designación del responsable', ok: filled(manager?.appointmentDoc) && filled(manager?.appointmentDate), level: 'recomendado' },
      { id: 'financiacion', label: 'Modelo financiero y contractual', ok: Boolean(input.pgee?.financing?.models.length), level: 'recomendado' },
    ],
  };
}

export interface ComplianceInput {
  project: Project;
  /** PGEE del proyecto y la ruta calculada; sin ellos, el grupo del PGEE sale con todo pendiente. */
  pgee?: PgeeSource;
  firstYear?: FirstYearCheck | null;
}

/** Todos los grupos de verificación del proyecto. */
export function checkCompliance(input: ComplianceInput): ChecklistGroup[] {
  return [characterization(input.project), pgeeChecklist({ pgee: input.pgee, firstYear: input.firstYear ?? null })];
}

/** Frase para el informe borrador: «Faltan: entorno de la edificación, edad de la edificación.» Vacía si no falta nada. */
export function missingSentence(groups: readonly ChecklistGroup[]): string {
  const missing = groups.flatMap((g) => groupStatus(g).missing.map((i) => i.label.charAt(0).toLowerCase() + i.label.slice(1)));
  return missing.length ? `Faltan: ${missing.join(', ')}.` : '';
}

const pad = (n: number) => String(n).padStart(2, '0');
const isLeap = (year: number) => (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
const daysIn = (year: number, month: number) => (month === 2 ? (isLeap(year) ? 29 : 28) : [4, 6, 9, 11].includes(month) ? 30 : 31);

/** Fecha en que vence el ciclo de cuatro años a partir de una auditoría (AAAA-MM-DD). Devuelve `undefined` si la fecha no es válida. */
export function nextAuditDate(auditDate: string | undefined): string | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(auditDate ?? '');
  if (!match) return undefined;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  if (month < 1 || month > 12 || day < 1 || day > daysIn(year, month)) return undefined;
  const target = year + AUDIT_CYCLE_YEARS;
  return `${target}-${pad(month)}-${pad(Math.min(day, daysIn(target, month)))}`;
}
