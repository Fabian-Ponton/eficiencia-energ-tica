import { describe, expect, it } from 'vitest';
import { canHaveChildren, descendantIds, electricalRows, suggestedChildKind } from '@/domain/electrical';
import type { ElectricalNode } from '@/domain/types';

const node = (id: string, kind: ElectricalNode['kind'], parentId?: string, name = id): ElectricalNode => ({
  id,
  projectId: 'p',
  createdAt: 0,
  updatedAt: 0,
  kind,
  name,
  parentId,
});

describe('sistema eléctrico', () => {
  it('ordena el árbol siguiendo el recorrido de la energía y calcula las guías', () => {
    const rows = electricalRows([
      node('c2', 'circuito', 'p1', 'C2'),
      node('tgd', 'tablero', 't1', 'TGD'),
      node('t1', 'transformador', undefined, 'T1'),
      node('p1', 'tablero', 'tgd', 'TD-P1'),
      node('c1', 'circuito', 'p1', 'C1'),
      node('aa', 'tablero', 'tgd', 'TD-AA'),
      node('caa', 'circuito', 'aa', 'C-AA'),
    ]);
    expect(rows.map((r) => `${'  '.repeat(r.depth)}${r.node.name}`)).toEqual(['T1', '  TGD', '    TD-AA', '      C-AA', '    TD-P1', '      C1', '      C2']);
    const byId = (id: string) => rows.find((r) => r.node.id === id)!;
    // C-AA cuelga de TD-AA, que tiene un hermano debajo: la guía del nivel 2 continúa
    expect(byId('caa').guides).toEqual([false, true]);
    expect(byId('c1')).toMatchObject({ guides: [false, false], isLast: false });
    expect(byId('c2').isLast).toBe(true);
    expect(byId('tgd').childCount).toBe(2);
  });

  it('no pierde elementos huérfanos ni ciclos', () => {
    const rows = electricalRows([node('x', 'tablero', 'borrado'), node('a', 'tablero', 'b'), node('b', 'tablero', 'a')]);
    expect(rows.map((r) => r.node.id).sort()).toEqual(['a', 'b', 'x']);
  });

  it('sugiere el siguiente elemento y excluye los descendientes como alimentador', () => {
    expect(suggestedChildKind()).toBe('transformador');
    expect(suggestedChildKind('transformador')).toBe('acometida');
    expect(suggestedChildKind('tablero')).toBe('circuito');
    expect(canHaveChildren('circuito')).toBe(false);
    const nodes = [node('t', 'transformador'), node('g', 'tablero', 't'), node('s', 'tablero', 'g'), node('otro', 'tablero')];
    expect([...descendantIds(nodes, 't')].sort()).toEqual(['g', 's']);
  });
});
