/** Indicadores de desempeño energético (IDEn) simples. */

/** kWh por metro cuadrado en el periodo del consumo recibido. */
export const energyIntensity = (kwh: number, areaM2: number): number => (areaM2 > 0 ? kwh / areaM2 : NaN);

/** kWh por usuario en el periodo del consumo recibido. */
export const energyPerUser = (kwh: number, users: number): number => (users > 0 ? kwh / users : NaN);

/** Costo por metro cuadrado en el periodo del costo recibido. */
export const costIntensity = (costCop: number, areaM2: number): number => (areaM2 > 0 ? costCop / areaM2 : NaN);
