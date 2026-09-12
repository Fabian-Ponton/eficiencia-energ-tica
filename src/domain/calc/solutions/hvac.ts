/** Capacidades comerciales habituales de aires acondicionados (BTU/h). Editable desde los catálogos. */
export const COMMERCIAL_SIZES_BTU_H = [9000, 12000, 18000, 24000, 36000, 48000, 60000] as const;

/** Potencia eléctrica (kW) a partir de la capacidad y la eficiencia EER (BTU/h por W). */
export const electricPowerKw = (capacityBtuH: number, eer: number): number => capacityBtuH / eer / 1000;

/** Menor capacidad comercial que cubre la carga requerida (o la mayor disponible). */
export function nearestCommercialSize(requiredBtuH: number, sizes: readonly number[] = COMMERCIAL_SIZES_BTU_H): number {
  return sizes.find((size) => size >= requiredBtuH) ?? sizes[sizes.length - 1];
}

export interface HvacReplacementInput {
  capacityBtuH: number;
  currentEer: number;
  newEer: number;
  /** Horas equivalentes a plena carga por año. */
  fullLoadHoursPerYear: number;
}

export const hvacReplacementSavingsKwh = (i: HvacReplacementInput): number =>
  (electricPowerKw(i.capacityBtuH, i.currentEer) - electricPowerKw(i.capacityBtuH, i.newEer)) * i.fullLoadHoursPerYear;
