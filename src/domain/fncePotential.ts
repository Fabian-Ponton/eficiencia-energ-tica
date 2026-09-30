import { formatNumber } from '@/utils/format';
import { pvSizing } from './calc/solutions/pv';
import type { Area, Project } from './types';

/**
 * Potencial de referencia de fuentes no convencionales de energía renovable (FNCER) para el informe: solo solar fotovoltaica,
 * con la cubierta disponible y las horas solares pico. Es un dato para priorizar estudios posteriores, no un diseño: la auditoría
 * no dimensiona el sistema (decisión del auditor; la calculadora fotovoltaica de Oportunidades sí lo hace si se necesita).
 */

/** Valores con los que también arranca la calculadora fotovoltaica. */
export const FNCE_DEFAULTS = { performanceRatio: 0.8, moduleWp: 550, moduleAreaM2: 2.6 } as const;

export interface FncePotential {
  roofM2: number;
  peakSunHours: number;
  modules: number;
  kwp: number;
  arrayAreaM2: number;
  annualGenerationKwh: number;
  /** Fracción del consumo anual de referencia que cubriría; `null` sin consumo. */
  coverage: number | null;
  savingsCopYear: number | null;
}

export interface FnceInput {
  areas: readonly Pick<Area, 'roofAvailableM2'>[];
  peakSunHours?: number;
  annualKwh?: number | null;
  tariffCopPerKwh?: number;
  performanceRatio?: number;
  moduleWp?: number;
  moduleAreaM2?: number;
}

/** Módulos que caben en la cubierta disponible y lo que generarían al año; `null` si falta la cubierta o las horas solares. */
export function fncePotential(input: FnceInput): FncePotential | null {
  const roofM2 = input.areas.reduce((total, a) => total + (a.roofAvailableM2 ?? 0), 0);
  const peakSunHours = input.peakSunHours ?? 0;
  const moduleAreaM2 = input.moduleAreaM2 ?? FNCE_DEFAULTS.moduleAreaM2;
  const moduleWp = input.moduleWp ?? FNCE_DEFAULTS.moduleWp;
  const performanceRatio = input.performanceRatio ?? FNCE_DEFAULTS.performanceRatio;
  if (!(roofM2 > 0) || !(peakSunHours > 0)) return null;
  const modules = Math.floor(roofM2 / moduleAreaM2);
  if (modules < 1) return null;
  // Con el arreglo que cabe en la cubierta: la energía «a cubrir» es la que produce ese número de módulos
  const kwp = (modules * moduleWp) / 1000;
  const sizing = pvSizing({ dailyEnergyKwh: kwp * peakSunHours * performanceRatio, peakSunHours, performanceRatio, moduleWp, moduleAreaM2 });
  const annualGenerationKwh = sizing.annualGenerationKwh;
  return {
    roofM2,
    peakSunHours,
    modules: sizing.modules,
    kwp: sizing.installedKwp,
    arrayAreaM2: sizing.arrayAreaM2,
    annualGenerationKwh,
    coverage: input.annualKwh && input.annualKwh > 0 ? annualGenerationKwh / input.annualKwh : null,
    savingsCopYear: input.tariffCopPerKwh && input.tariffCopPerKwh > 0 ? annualGenerationKwh * input.tariffCopPerKwh : null,
  };
}

export type FnceStatementKind = 'potencial' | 'excluida';

const n = formatNumber;

/**
 * El párrafo de FNCER del informe: el potencial de referencia o la exclusión motivada, según lo que decidió el auditor en el
 * alcance. Mientras no excluya las FNCER, se reporta el potencial (es la opción por omisión del formulario de Datos generales).
 */
export function fnceStatement(scope: Project['scope'] | undefined, potential: FncePotential | null): { kind: FnceStatementKind; text: string } {
  if (scope?.fnce === 'excluida') {
    const why = scope.fnceNote?.trim();
    return {
      kind: 'excluida',
      text: `Las fuentes no convencionales de energía renovable (FNCER) quedan por fuera del alcance de esta auditoría${why ? `: ${why}` : ''}. El potencial no se cuantifica ni se diseñan sistemas de generación.`,
    };
  }
  if (!potential) {
    return {
      kind: 'potencial',
      text: 'Potencial de FNCER: para estimarlo faltan el área de cubierta disponible (en cada espacio) y las horas solares pico del sitio (en Datos generales). Se reporta como dato de referencia; la auditoría no incluye el diseño de un sistema fotovoltaico.',
    };
  }
  return {
    kind: 'potencial',
    text:
      `Potencial de FNCER (solar fotovoltaica, dato de referencia): la cubierta disponible de ${n(potential.roofM2)} m² admite hasta ${n(potential.modules)} módulos de ${n(FNCE_DEFAULTS.moduleWp)} Wp, es decir, del orden de ` +
      `${n(potential.kwp, 1)} kWp, con una generación de ${n(potential.annualGenerationKwh)} kWh al año (${n(potential.peakSunHours, 1)} horas solares pico y rendimiento de ${n(FNCE_DEFAULTS.performanceRatio, 2)})` +
      `${potential.coverage !== null ? `, equivalente al ${n(potential.coverage * 100, 1)} % del consumo anual` : ''}. ` +
      'Sirve para priorizar estudios posteriores: esta auditoría no incluye el diseño del sistema.',
  };
}
