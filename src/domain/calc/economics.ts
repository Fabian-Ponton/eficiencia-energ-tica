/** Evaluación económica de medidas de ahorro. Las tasas se expresan como fracción (0,12 = 12 %). */

export const simplePayback = (investment: number, annualSavings: number): number =>
  annualSavings > 0 ? investment / annualSavings : Infinity;

/** Valor presente de 1 peso anual durante `years` años. */
export const annuityFactor = (rate: number, years: number): number =>
  rate === 0 ? years : (1 - (1 + rate) ** -years) / rate;

/** Valor presente neto; `cashFlows[0]` ocurre en el año 0. */
export const npv = (rate: number, cashFlows: readonly number[]): number =>
  cashFlows.reduce((total, flow, year) => total + flow / (1 + rate) ** year, 0);

export interface SavingsProject {
  investment: number;
  annualSavings: number;
  years: number;
  /** Incremento anual de la tarifa, que hace crecer el ahorro en pesos. */
  escalation?: number;
  /** Costos anuales adicionales de operación y mantenimiento. */
  annualCost?: number;
}

export const projectCashFlows = ({ investment, annualSavings, years, escalation = 0, annualCost = 0 }: SavingsProject): number[] => [
  -investment,
  ...Array.from({ length: years }, (_, i) => annualSavings * (1 + escalation) ** i - annualCost),
];

/** Tasa interna de retorno por bisección; `null` si los flujos no cambian de signo. */
export function irr(cashFlows: readonly number[], low = -0.99, high = 10, tolerance = 1e-9): number | null {
  let npvLow = npv(low, cashFlows);
  if (npvLow * npv(high, cashFlows) > 0) return null;
  for (let i = 0; i < 300; i++) {
    const mid = (low + high) / 2;
    const npvMid = npv(mid, cashFlows);
    if (Math.abs(npvMid) < tolerance || (high - low) / 2 < tolerance) return mid;
    if (npvLow * npvMid < 0) high = mid;
    else {
      low = mid;
      npvLow = npvMid;
    }
  }
  return (low + high) / 2;
}

/** Emisiones evitadas en toneladas de CO₂e. El factor de emisión se configura en el proyecto. */
export const avoidedEmissionsTonnes = (kwh: number, kgCo2ePerKwh: number): number => (kwh * kgCo2ePerKwh) / 1000;
