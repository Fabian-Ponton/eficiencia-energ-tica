export interface LumenMethodInput {
  /** Iluminancia mantenida requerida (lux). */
  targetLux: number;
  areaM2: number;
  lumensPerLuminaire: number;
  /** Coeficiente de utilización (CU), depende del índice del local y de las reflectancias. */
  utilizationFactor: number;
  /** Factor de mantenimiento (FM). */
  maintenanceFactor: number;
}

/** Método de los lúmenes: N = E·A / (Φ·CU·FM). `count` redondea hacia arriba. */
export function luminairesRequired(i: LumenMethodInput): { exact: number; count: number } {
  const exact = (i.targetLux * i.areaM2) / (i.lumensPerLuminaire * i.utilizationFactor * i.maintenanceFactor);
  return { exact, count: Math.ceil(exact - 1e-9) };
}

/** Iluminancia media que se obtendría con una cantidad dada de luminarias. */
export const achievedLux = (count: number, i: Omit<LumenMethodInput, 'targetLux'>): number =>
  (count * i.lumensPerLuminaire * i.utilizationFactor * i.maintenanceFactor) / i.areaM2;

/** Densidad de potencia de iluminación (W/m²). */
export const lightingPowerDensity = (totalWatts: number, areaM2: number): number => totalWatts / areaM2;

export type LightingStatus = 'insuficiente' | 'adecuada' | 'excesiva';

/** Compara la iluminancia medida con la requerida. Los umbrales son configurables. */
export function lightingStatus(measuredLux: number, requiredLux: number, { tolerance = 0.1, excessFactor = 1.5 } = {}): LightingStatus {
  if (measuredLux < requiredLux * (1 - tolerance)) return 'insuficiente';
  if (measuredLux > requiredLux * excessFactor) return 'excesiva';
  return 'adecuada';
}
