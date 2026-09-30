import type { Equipment } from './types';

/**
 * Código con que PONTIA identifica a un equipo en los formatos de Excel. Si el equipo tiene código propio se usa ese; si
 * no, se genera uno estable (EQ- y los seis primeros caracteres de su identificador interno). Al volver a cargar el libro,
 * la fila con ese código actualiza el equipo en vez de duplicarlo.
 */
export const generatedEquipmentCode = (equipment: Pick<Equipment, 'id' | 'code'>): string => equipment.code?.trim() || `EQ-${equipment.id.slice(0, 6).toUpperCase()}`;
