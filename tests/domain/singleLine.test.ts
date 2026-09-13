import { describe, expect, it } from 'vitest';
import { linkPath, singleLineLayout } from '@/domain/singleLine';
import type { ElectricalNode } from '@/domain/types';

const base = { projectId: 'p', createdAt: 0, updatedAt: 0 };
const node = (id: string, kind: ElectricalNode['kind'], parentId?: string): ElectricalNode => ({ ...base, id, kind, name: id, parentId });

// Red → transformador → tablero general con dos tableros; el primero alimenta dos circuitos
const nodes = [
  node('red', 'red'),
  node('T1', 'transformador', 'red'),
  node('TGD', 'tablero', 'T1'),
  node('TD-A', 'tablero', 'TGD'),
  node('TD-B', 'tablero', 'TGD'),
  node('C1', 'circuito', 'TD-A'),
  node('C2', 'circuito', 'TD-A'),
];
const at = (layout: ReturnType<typeof singleLineLayout>, id: string) => layout.placed.find((p) => p.node.id === id);

describe('diagrama unifilar', () => {
  const layout = singleLineLayout(nodes);

  it('reparte los tableros en columnas y centra cada padre sobre sus hijos', () => {
    expect(layout.width).toBe(376);
    expect(at(layout, 'TD-A')).toMatchObject({ x: 12, y: 336, compact: false });
    expect(at(layout, 'TD-B')).toMatchObject({ x: 196, y: 336 });
    expect(at(layout, 'TGD')).toMatchObject({ x: 104, y: 228 });
    expect(at(layout, 'red')).toMatchObject({ x: 104, y: 12 });
  });

  it('apila los circuitos bajo su tablero', () => {
    expect(at(layout, 'C1')).toMatchObject({ x: 30, y: 414, w: 150, h: 52, compact: true });
    expect(at(layout, 'C2')?.y).toBe(476);
    expect(layout.height).toBe(540);
    expect(layout.links.find((l) => l.id === 'C1')?.points).toEqual([
      [21, 400],
      [21, 440],
      [30, 440],
    ]);
  });

  it('une padres e hijos con recorridos ortogonales', () => {
    expect(layout.links.find((l) => l.id === 'TD-B')?.points).toEqual([
      [188, 292],
      [188, 314],
      [280, 314],
      [280, 336],
    ]);
    expect(layout.links.find((l) => l.id === 'T1')?.points).toEqual([
      [188, 76],
      [188, 120],
    ]);
    expect(linkPath([[1, 2], [3, 4]])).toBe('M 1 2 L 3 4');
  });

  it('alinea el tronco a la izquierda y puede ocultar los circuitos', () => {
    expect(at(singleLineLayout(nodes, { align: 'left' }), 'TGD')?.x).toBe(12);
    const withoutCircuits = singleLineLayout(nodes, { showCircuits: false });
    expect(withoutCircuits.placed.some((p) => p.node.kind === 'circuito')).toBe(false);
    expect(withoutCircuits.width).toBe(376);
  });
});
