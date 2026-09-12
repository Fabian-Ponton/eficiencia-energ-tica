export interface LightingRetrofitInput {
  /** Potencia total actual, incluidas las pérdidas de balastos (W). */
  currentW: number;
  proposedW: number;
  hoursPerYear: number;
}

export const lightingRetrofitSavingsKwh = (i: LightingRetrofitInput): number =>
  ((i.currentW - i.proposedW) * i.hoursPerYear) / 1000;
