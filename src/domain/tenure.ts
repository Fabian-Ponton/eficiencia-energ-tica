import type { EntityKind, SavingsType, Tenure } from './types';

/**
 * Lo que la entidad puede implementar en un edificio según cómo lo tiene.
 * - `todas`: cualquier medida.
 * - `solo-bpo`: únicamente buenas prácticas de operación.
 * - `confirmar`: la norma no lo resuelve; el auditor debe confirmar quién es el titular del dominio.
 */
export type TenureScope = 'todas' | 'solo-bpo' | 'confirmar';

export interface TenureInfo {
  id: Tenure;
  label: string;
  /** Cómo se dice en el informe: «Edificio …». */
  phrase: string;
  scope: TenureScope;
  /** Explicación para el auditor, en el formulario. */
  help: string;
}

/**
 * Fuente: Res. MME 40412 de 2024, art. 3, par. 3 (texto verificado el 2026-09-29): «Las edificaciones en calidad de
 * arrendamiento, comodato u otra figura jurídica similar […] podrán realizar la auditoría energética […] e implementar
 * únicamente medidas asociadas a Buenas Prácticas de Operación». La norma no dice nada de las sedes compartidas.
 */
export const TENURES: readonly TenureInfo[] = [
  { id: 'propia', label: 'Propia', phrase: 'propio', scope: 'todas', help: 'La entidad es la titular del dominio del edificio y puede implementar cualquier medida.' },
  {
    id: 'arrendada',
    label: 'Arrendada',
    phrase: 'en arrendamiento',
    scope: 'solo-bpo',
    help: 'Edificio en arrendamiento: se audita, pero solo se pueden implementar buenas prácticas de operación.',
  },
  {
    id: 'comodato',
    label: 'En comodato',
    phrase: 'en comodato',
    scope: 'solo-bpo',
    help: 'Edificio en comodato: se audita, pero solo se pueden implementar buenas prácticas de operación.',
  },
  {
    id: 'compartida',
    label: 'Sede compartida',
    phrase: 'en sede compartida',
    scope: 'confirmar',
    help: 'La norma no la resuelve: confirma si la entidad es titular del dominio de la parte que ocupa. Si no lo es, aplica lo mismo que al arriendo.',
  },
  {
    id: 'otra',
    label: 'Otra figura jurídica',
    phrase: 'en otra figura jurídica',
    scope: 'solo-bpo',
    help: 'Si la figura es similar al arriendo o al comodato, solo se pueden implementar buenas prácticas de operación.',
  },
];

export const tenureInfo = (tenure: Tenure | undefined): TenureInfo | undefined => TENURES.find((t) => t.id === tenure);

/**
 * Alcance de las medidas. La restricción es de la Res. 40412, que rige a las entidades públicas: para una entidad
 * privada no limita nada. Sin tenencia registrada no se bloquea nada: se pide confirmarla.
 */
export function tenureScope(tenure: Tenure | undefined, entityKind?: EntityKind): TenureScope {
  if (entityKind === 'privada') return 'todas';
  return tenureInfo(tenure)?.scope ?? 'confirmar';
}

export type MeasureAllowance = 'permitida' | 'no-permitida' | 'confirmar';

/** ¿Puede la entidad implementar una medida de este tipo de ahorro en su edificio? */
export function measureAllowance(scope: TenureScope, savingsType: SavingsType): MeasureAllowance {
  if (scope === 'todas' || savingsType === 'bpo') return 'permitida';
  return scope === 'solo-bpo' ? 'no-permitida' : 'confirmar';
}

/** Frase para el informe. Vacía cuando no hay nada que declarar. */
export function tenureStatement(tenure: Tenure | undefined, entityKind?: EntityKind): string {
  const scope = tenureScope(tenure, entityKind);
  const info = tenureInfo(tenure);
  if (scope === 'todas') return info?.id === 'propia' ? 'Edificio propio: la entidad puede implementar cualquier medida de eficiencia energética.' : '';
  if (scope === 'solo-bpo') {
    return `Edificio ${info?.phrase}: según el parágrafo 3 del artículo 3 de la Resolución 40412 de 2024, en estas edificaciones solo se pueden implementar medidas asociadas a buenas prácticas de operación.`;
  }
  return 'La tenencia del edificio está por confirmar: si la entidad no es titular del dominio, solo se pueden implementar buenas prácticas de operación (Resolución 40412 de 2024, art. 3, par. 3).';
}
