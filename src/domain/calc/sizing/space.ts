export interface RoomDimensions {
  lengthM: number;
  widthM: number;
  heightM: number;
}

export const floorArea = (d: Pick<RoomDimensions, 'lengthM' | 'widthM'>): number => d.lengthM * d.widthM;

export const roomVolume = (d: RoomDimensions): number => floorArea(d) * d.heightM;

/**
 * Índice del local K = L·A / (h·(L + A)), donde h es la altura entre el plano de trabajo
 * y las luminarias. Se usa para elegir el coeficiente de utilización en el método de los lúmenes.
 */
export function roomIndex(d: RoomDimensions, workPlaneHeightM = 0.8): number {
  const h = d.heightM - workPlaneHeightM;
  if (h <= 0) throw new Error('La altura del local debe ser mayor que la del plano de trabajo.');
  return (d.lengthM * d.widthM) / (h * (d.lengthM + d.widthM));
}
