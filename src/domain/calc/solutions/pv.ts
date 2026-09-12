export interface PvSizingInput {
  /** Energía diaria que se quiere cubrir (kWh/día). */
  dailyEnergyKwh: number;
  /** Horas solares pico del sitio (kWh/m²·día). */
  peakSunHours: number;
  /** Rendimiento global del sistema (PR), como fracción. */
  performanceRatio: number;
  moduleWp: number;
  moduleAreaM2: number;
}

export interface PvSizingResult {
  requiredKwp: number;
  modules: number;
  installedKwp: number;
  arrayAreaM2: number;
  annualGenerationKwh: number;
}

/** Dimensionamiento de un sistema solar fotovoltaico conectado a la red: kWp = E ÷ (HSP × PR). */
export function pvSizing(i: PvSizingInput): PvSizingResult {
  const requiredKwp = i.dailyEnergyKwh / (i.peakSunHours * i.performanceRatio);
  const modules = Math.ceil((requiredKwp * 1000) / i.moduleWp - 1e-9);
  const installedKwp = (modules * i.moduleWp) / 1000;
  return {
    requiredKwp,
    modules,
    installedKwp,
    arrayAreaM2: modules * i.moduleAreaM2,
    annualGenerationKwh: installedKwp * i.peakSunHours * i.performanceRatio * 365,
  };
}
