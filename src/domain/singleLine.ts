import { electricalRows } from './electrical';
import type { ElectricalNode } from './types';

/**
 * Distribución del diagrama unifilar, sin dibujo: la usan la pantalla (SVG) y el informe (PNG).
 * Cada hoja ocupa una columna y cada padre queda sobre sus hijos; los tableros se reparten a lo ancho
 * y los circuitos finales se apilan debajo de su tablero, como en un cuadro de cargas.
 */

/** Medidas en píxeles. */
export const SINGLE_LINE = {
  /** Caja de un elemento. */
  W: 168,
  H: 64,
  /** Separación horizontal entre columnas y vertical entre niveles. */
  GAP: 16,
  V: 44,
  PAD: 12,
  /** Circuitos apilados: sangría, alto y separación. */
  INDENT: 18,
  CH: 52,
  CGAP: 10,
} as const;

export interface PlacedNode {
  node: ElectricalNode;
  x: number;
  y: number;
  w: number;
  h: number;
  /** Circuito apilado bajo su tablero (caja más pequeña). */
  compact: boolean;
}

export interface SingleLineLink {
  /** El elemento alimentado. */
  id: string;
  /** Recorrido ortogonal del padre al hijo. */
  points: [number, number][];
}

export interface SingleLineLayout {
  placed: PlacedNode[];
  links: SingleLineLink[];
  width: number;
  height: number;
}

export interface SingleLineOptions {
  showCircuits?: boolean;
  /** `left`: cada padre sobre su primer hijo, para que en el celular el tronco se vea sin desplazarse. */
  align?: 'center' | 'left';
}

export function singleLineLayout(nodes: readonly ElectricalNode[], { showCircuits = true, align = 'center' }: SingleLineOptions = {}): SingleLineLayout {
  const { W, H, GAP, V, PAD, INDENT, CH, CGAP } = SINGLE_LINE;
  const SLOT = W + GAP;
  const visible = nodes.filter((n) => showCircuits || n.kind !== 'circuito');
  const rows = electricalRows(visible);

  // Árbol a partir de las filas ordenadas (los padres ausentes o en ciclo quedan como raíz)
  const children = new Map<string, ElectricalNode[]>();
  const parentOf = new Map<string, string>();
  const roots: ElectricalNode[] = [];
  const trail: ElectricalNode[] = [];
  for (const row of rows) {
    trail.length = row.depth;
    const parent = trail[row.depth - 1];
    if (row.depth > 0 && parent) {
      children.set(parent.id, [...(children.get(parent.id) ?? []), row.node]);
      parentOf.set(row.node.id, parent.id);
    } else roots.push(row.node);
    trail[row.depth] = row.node;
  }
  const kidsOf = (n: ElectricalNode) => children.get(n.id) ?? [];
  /** Un tablero cuyos hijos son solo circuitos finales los muestra apilados en su propia columna. */
  const stacks = (n: ElectricalNode) => kidsOf(n).length > 0 && kidsOf(n).every((k) => k.kind === 'circuito' && !kidsOf(k).length);

  const width = new Map<string, number>();
  const measure = (n: ElectricalNode): number => {
    const kids = kidsOf(n);
    const value = !kids.length || stacks(n) ? 1 : kids.reduce((total, k) => total + measure(k), 0);
    width.set(n.id, value);
    return value;
  };
  const totalSlots = roots.reduce((total, r) => total + measure(r), 0);

  const center = new Map<string, number>();
  const place = (n: ElectricalNode, start: number) => {
    const kids = kidsOf(n);
    if (!kids.length || stacks(n)) {
      center.set(n.id, start + 0.5);
      return;
    }
    let offset = start;
    for (const kid of kids) {
      place(kid, offset);
      offset += width.get(kid.id) ?? 1;
    }
    const first = center.get(kids[0].id) ?? 0;
    const last = center.get(kids[kids.length - 1].id) ?? 0;
    center.set(n.id, align === 'left' ? first : (first + last) / 2);
  };
  let start = 0;
  for (const root of roots) {
    place(root, start);
    start += width.get(root.id) ?? 1;
  }

  const placed = new Map<string, PlacedNode>();
  const depthOf = new Map(rows.map((r) => [r.node.id, r.depth]));
  for (const row of rows) {
    const parent = placed.get(parentOf.get(row.node.id) ?? '');
    if (parent && stacks(parent.node)) {
      const index = kidsOf(parent.node).indexOf(row.node);
      placed.set(row.node.id, { node: row.node, x: parent.x + INDENT, y: parent.y + parent.h + 14 + index * (CH + CGAP), w: W - INDENT, h: CH, compact: true });
      continue;
    }
    placed.set(row.node.id, {
      node: row.node,
      x: PAD + ((center.get(row.node.id) ?? 0.5) - 0.5) * SLOT,
      y: PAD + (depthOf.get(row.node.id) ?? 0) * (H + V),
      w: W,
      h: H,
      compact: false,
    });
  }

  const links: SingleLineLink[] = [];
  for (const p of placed.values()) {
    const parent = placed.get(parentOf.get(p.node.id) ?? '');
    if (!parent) continue;
    const bottom = parent.y + parent.h;
    if (p.compact) {
      const x = parent.x + INDENT / 2;
      links.push({ id: p.node.id, points: [[x, bottom], [x, p.y + p.h / 2], [p.x, p.y + p.h / 2]] });
      continue;
    }
    const px = parent.x + parent.w / 2;
    const cx = p.x + p.w / 2;
    const bus = bottom + V / 2;
    links.push({
      id: p.node.id,
      points: Math.abs(px - cx) < 0.5 ? [[px, bottom], [px, p.y]] : [[px, bottom], [px, bus], [cx, bus], [cx, p.y]],
    });
  }

  const all = [...placed.values()];
  return {
    placed: all,
    links,
    width: Math.max(W + PAD * 2, PAD * 2 + totalSlots * SLOT - GAP),
    height: Math.max(H, ...all.map((p) => p.y + p.h)) + PAD,
  };
}

/** Recorrido de un enlace como atributo `d` de un trazo SVG. */
export const linkPath = (points: readonly (readonly [number, number])[]): string => points.map(([x, y], i) => `${i ? 'L' : 'M'} ${x} ${y}`).join(' ');
