import { characterization, groupStatus } from '@/domain/compliance';
import { tenureInfo, tenureStatement } from '@/domain/tenure';
import type { Project } from '@/domain/types';
import { formatCop, formatNumber } from '@/utils/format';

const KIND = { publica: 'Pública', privada: 'Privada' } as const;
const ORDER = { nacional: 'orden nacional', territorial: 'orden territorial' } as const;
const DASH = '—';

const join = (parts: readonly (string | undefined | false)[], separator = ', ') => parts.filter(Boolean).join(separator);

/**
 * Filas de la tabla «Datos generales de la instalación» del informe, con lo que exige el art. 4(a) de la Res. 40412.
 * Lo que no se registró sale como «—», para que se vea qué falta.
 */
export function characterizationFacts(project: Project, year: number): [string, string][] {
  const b = project.building;
  const pop = project.population;
  const entity = join([project.client, project.entity && join([KIND[project.entity.kind], project.entity.order && ORDER[project.entity.order]], ' · ')], ' · ');
  const site = project.site;
  const age = b?.builtYear ? `${b.builtYear} (${Math.max(0, year - b.builtYear)} años)` : undefined;
  const population = join([
    pop?.students ? `${formatNumber(pop.students)} estudiantes` : undefined,
    pop?.staff ? `${formatNumber(pop.staff)} de personal docente y administrativo` : undefined,
    pop?.floating ? `${formatNumber(pop.floating)} de población flotante` : undefined,
  ]);
  const rows: [string, string][] = [
    ['Entidad', entity || DASH],
    ['NIT', project.nit ?? DASH],
    ['Sede', site?.name ? join([site.name, site.upmeCode && `código ${site.upmeCode}`], ' · ') : DASH],
    ['Ubicación', join([project.address, project.city]) || DASH],
    ['Sector', project.sector ?? DASH],
    ['Proceso o actividad', b?.activity ?? DASH],
    ['Entorno', b?.surroundings ?? DASH],
    ['Edad y pisos', join([age, b?.floors ? `${formatNumber(b.floors)} ${b.floors === 1 ? 'piso' : 'pisos'}` : undefined], ' · ') || DASH],
    ['Tenencia del edificio', tenureInfo(b?.tenure)?.label ?? DASH],
    ['Área construida', project.areaM2 ? `${formatNumber(project.areaM2)} m²` : DASH],
  ];
  if (population) rows.push(['Población', population]);
  rows.push(
    ['Usuarios', project.users ? formatNumber(project.users) : DASH],
    ['Horario de operación', project.operatingHours ?? DASH],
    ['Días de operación', `${project.calendar.daysPerWeek} por semana`],
    ['Operador de red', join([project.gridOperator, project.voltageLevel], ' · ') || DASH],
    ['Tarifa de referencia', project.economics.tariffCopPerKwh ? `${formatCop(project.economics.tariffCopPerKwh)} por kWh` : DASH],
  );
  return rows;
}

export interface CharacterizationNotes {
  /** Qué falta de la caracterización; vacío si está completa. */
  missing: string[];
  /** Consecuencia de la tenencia sobre las medidas; vacío si no hay nada que declarar. */
  tenure: string;
  /** Frontera, objetivos y limitaciones que escribió el auditor, con su título. */
  scope: { title: string; text: string }[];
}

export function characterizationNotes(project: Project): CharacterizationNotes {
  const status = groupStatus(characterization(project));
  const scope = project.scope;
  return {
    missing: status.missing.map((item) => item.label.charAt(0).toLowerCase() + item.label.slice(1)),
    tenure: tenureStatement(project.building?.tenure, project.entity?.kind),
    scope: [
      { title: 'Frontera de la auditoría', text: scope?.boundary?.trim() ?? '' },
      { title: 'Objetivos', text: scope?.objectives?.trim() ?? '' },
      { title: 'Limitaciones', text: scope?.limitations?.trim() ?? '' },
    ].filter((block) => block.text),
  };
}
