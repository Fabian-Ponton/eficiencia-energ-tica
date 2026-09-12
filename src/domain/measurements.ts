import { phaseImbalance } from './calc/sizing/capacity';
import type { Measurement } from './types';

type PhaseData = Pick<Measurement, 'phases' | 'voltageRef' | 'voltageV' | 'currentA'>;
type PowerData = PhaseData & Pick<Measurement, 'kw' | 'kva' | 'kvar' | 'pf'>;

const valid = (value: number | null | undefined): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0;
const average = (values: readonly number[]) => values.reduce((a, b) => a + b, 0) / values.length;

/** Referencia de tensión por omisión: entre fases en trifásico, fase-neutro en lo demás. */
export const defaultVoltageRef = (phases: number): 'LN' | 'LL' => (phases === 3 ? 'LL' : 'LN');

/**
 * Potencia aparente (kVA) a partir de tensiones y corrientes por fase.
 * Fase-neutro: suma de V·I de cada fase. Entre fases: √3·V·I en trifásico y V·I en monofásico o bifásico.
 */
export function apparentPowerKva(m: PhaseData): number | null {
  const phases = m.phases ?? 3;
  const voltages = (m.voltageV ?? []).slice(0, phases);
  const currents = (m.currentA ?? []).slice(0, phases);
  if (voltages.length < phases || currents.length < phases) return null;
  if (!voltages.every(valid) || !currents.every(valid) || voltages.some((v) => v === 0)) return null;
  const v = voltages as number[];
  const i = currents as number[];
  if ((m.voltageRef ?? defaultVoltageRef(phases)) === 'LN') return v.reduce((total, vk, k) => total + vk * i[k], 0) / 1000;
  return ((phases === 3 ? Math.sqrt(3) : 1) * average(v) * average(i)) / 1000;
}

export interface DerivedPower {
  kw: number | null;
  kva: number | null;
  kvar: number | null;
  pf: number | null;
  /** Desbalance de corriente entre fases (fracción), solo en mediciones trifásicas completas. */
  imbalance: number | null;
  /** Qué valores se calcularon porque el auditor no los registró. */
  calculated: { kw: boolean; kva: boolean; kvar: boolean; pf: boolean };
}

/** Completa lo que no se registró: kVA desde V·I, FP = kW/kVA y kvar = √(kVA² − kW²). */
export function derivePower(m: PowerData): DerivedPower {
  const kva = m.kva ?? apparentPowerKva(m);
  const kw = m.kw ?? (m.pf !== undefined && kva !== null ? kva * m.pf : null);
  const pf = m.pf ?? (kw !== null && kva ? Math.min(1, kw / kva) : null);
  const kvar = m.kvar ?? (kw !== null && kva !== null && kva >= kw ? Math.sqrt(kva ** 2 - kw ** 2) : null);
  const phases = m.phases ?? 3;
  const currents = (m.currentA ?? []).slice(0, 3);
  const imbalance = phases === 3 && currents.length === 3 && currents.every(valid) ? phaseImbalance(currents as number[]) : null;
  return {
    kw,
    kva,
    kvar,
    pf,
    imbalance,
    calculated: {
      kw: m.kw === undefined && kw !== null,
      kva: m.kva === undefined && kva !== null,
      kvar: m.kvar === undefined && kvar !== null,
      pf: m.pf === undefined && pf !== null,
    },
  };
}

export type ImbalanceLevel = 'normal' | 'alto' | 'critico';

/** Desbalance de corriente: hasta 10 % normal, hasta 20 % alto y más de 20 % crítico (umbrales orientativos). */
export const imbalanceLevel = (fraction: number): ImbalanceLevel => (fraction > 0.2 ? 'critico' : fraction > 0.1 ? 'alto' : 'normal');
