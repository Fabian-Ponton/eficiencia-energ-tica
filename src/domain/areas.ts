import { roomIndex } from './calc/sizing/space';
import type { Area } from './types';

type AreaSize = Pick<Area, 'lengthM' | 'widthM' | 'heightM' | 'areaM2' | 'workPlaneHeightM'>;

/** Área de piso: largo × ancho, o el área ingresada a mano si el espacio es irregular. */
export const floorAreaOf = (area: AreaSize): number | null =>
  area.lengthM && area.widthM ? area.lengthM * area.widthM : (area.areaM2 ?? null);

export function volumeOf(area: AreaSize): number | null {
  const floor = floorAreaOf(area);
  return floor && area.heightM ? floor * area.heightM : null;
}

/** Índice del local K; solo en espacios rectangulares con la altura mayor que la del plano de trabajo. */
export function roomIndexOf(area: AreaSize): number | null {
  const { lengthM, widthM, heightM } = area;
  if (!lengthM || !widthM || !heightM) return null;
  const plane = area.workPlaneHeightM ?? 0.8;
  return heightM > plane ? roomIndex({ lengthM, widthM, heightM }, plane) : null;
}
