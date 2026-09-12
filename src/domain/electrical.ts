import type { ElectricalKind, ElectricalNode } from './types';

/** Orden en que la energía recorre la instalación. */
export const KIND_ORDER: readonly ElectricalKind[] = ['red', 'transformador', 'medidor', 'acometida', 'tablero', 'circuito'];

const NEXT: Record<ElectricalKind, ElectricalKind> = {
  red: 'transformador',
  transformador: 'acometida',
  medidor: 'tablero',
  acometida: 'tablero',
  tablero: 'circuito',
  circuito: 'circuito',
};

/** Tipo más probable para un elemento nuevo que cuelga de `parent`. */
export const suggestedChildKind = (parent?: ElectricalKind): ElectricalKind => (parent ? NEXT[parent] : 'transformador');

/** Los circuitos son el último eslabón: no alimentan otros elementos. */
export const canHaveChildren = (kind: ElectricalKind): boolean => kind !== 'circuito';

export interface ElectricalRow {
  node: ElectricalNode;
  depth: number;
  /** Líneas verticales a la izquierda: en cada nivel intermedio, si esa rama continúa más abajo. */
  guides: boolean[];
  isLast: boolean;
  childCount: number;
}

const compare = (a: ElectricalNode, b: ElectricalNode) =>
  KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind) || a.name.localeCompare(b.name, 'es', { numeric: true });

/**
 * Recorre el sistema eléctrico desde el origen y devuelve las filas en orden de árbol.
 * Los elementos cuyo padre ya no existe, o que forman un ciclo, quedan en la raíz para no perderlos.
 */
export function electricalRows(nodes: readonly ElectricalNode[]): ElectricalRow[] {
  const ids = new Set(nodes.map((n) => n.id));
  const children = new Map<string, ElectricalNode[]>();
  const roots: ElectricalNode[] = [];
  for (const node of nodes) {
    if (node.parentId && node.parentId !== node.id && ids.has(node.parentId)) {
      children.set(node.parentId, [...(children.get(node.parentId) ?? []), node]);
    } else roots.push(node);
  }
  const rows: ElectricalRow[] = [];
  const seen = new Set<string>();
  const visit = (list: readonly ElectricalNode[], depth: number, trail: boolean[]) => {
    const pending = [...list].sort(compare).filter((n) => !seen.has(n.id));
    pending.forEach((node, i) => {
      if (seen.has(node.id)) return;
      seen.add(node.id);
      const isLast = i === pending.length - 1;
      const kids = children.get(node.id) ?? [];
      rows.push({ node, depth, guides: trail.slice(1), isLast, childCount: kids.length });
      visit(kids, depth + 1, [...trail, !isLast]);
    });
  };
  visit(roots, 0, []);
  const trapped = nodes.filter((n) => !seen.has(n.id));
  if (trapped.length) visit(trapped, 0, []);
  return rows;
}

/** Identificadores de todo lo que cuelga de `id` (para no elegirlos como su alimentador). */
export function descendantIds(nodes: readonly ElectricalNode[], id: string): Set<string> {
  const result = new Set<string>();
  const stack = [id];
  while (stack.length) {
    const current = stack.pop();
    for (const node of nodes) {
      if (node.parentId === current && node.id !== id && !result.has(node.id)) {
        result.add(node.id);
        stack.push(node.id);
      }
    }
  }
  return result;
}
