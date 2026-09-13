import { singleLineLayout } from '@/domain/singleLine';
import type { NodeCheck } from '@/domain/sizing';
import type { ElectricalKind, ElectricalNode } from '@/domain/types';
import { formatNumber, formatPercent } from '@/utils/format';
import type { ChartOption } from './echarts';
import { chartPalette, MONO, SANS } from './palette';

/**
 * El diagrama unifilar dibujado con formas de ECharts, para exportarlo como PNG (informe Word y descargas).
 * Usa la misma distribución que la pantalla; la franja de la izquierda indica el tipo de elemento.
 */
export function singleLineChart(
  nodes: readonly ElectricalNode[],
  checks: ReadonlyMap<string, NodeCheck> = new Map(),
  dark = false,
): { option: ChartOption; width: number; height: number } {
  const p = chartPalette(dark);
  const layout = singleLineLayout(nodes, { showCircuits: true });
  const levelColor = (check?: NodeCheck) => (check?.level === 'critica' ? p.critical : check?.level === 'alta' ? p.warning : p.good);
  const KIND_COLOR: Record<ElectricalKind, string> = {
    red: p.navy,
    transformador: p.warning,
    medidor: p.navy,
    acometida: p.axis,
    tablero: p.accent,
    circuito: p.axis,
  };

  const elements: Record<string, unknown>[] = [];
  for (const link of layout.links) {
    const check = checks.get(link.id);
    elements.push({ type: 'polyline', silent: true, shape: { points: link.points }, style: { stroke: check ? levelColor(check) : p.line, lineWidth: 2, fill: null } });
  }
  for (const n of layout.placed) {
    const check = checks.get(n.node.id);
    const flagged = check && check.level !== 'normal';
    elements.push(
      {
        type: 'rect',
        silent: true,
        shape: { x: n.x, y: n.y, width: n.w, height: n.h, r: 8 },
        style: { fill: p.surface, stroke: flagged ? levelColor(check) : p.border, lineWidth: flagged ? 1.6 : 1 },
      },
      { type: 'rect', silent: true, shape: { x: n.x, y: n.y + 8, width: 3, height: n.h - 16, r: 1.5 }, style: { fill: KIND_COLOR[n.node.kind] } },
      {
        type: 'text',
        silent: true,
        style: {
          x: n.x + 12,
          y: n.y + (n.compact ? 9 : 12),
          text: shorten(n.node.name, n.compact ? 21 : 23),
          fontFamily: SANS,
          fontSize: n.compact ? 11 : 12,
          fontWeight: 600,
          fill: p.text,
          verticalAlign: 'top',
        },
      },
      {
        type: 'text',
        silent: true,
        style: {
          x: n.x + 12,
          y: n.y + (n.compact ? 25 : 30),
          text: check ? `${rating(n.node)} · ${formatPercent(check.ratio, 0)}` : rating(n.node),
          fontFamily: MONO,
          fontSize: 10,
          fill: p.muted,
          verticalAlign: 'top',
        },
      },
    );
    if (check) {
      const y = n.y + n.h - (n.compact ? 9 : 12);
      elements.push(
        { type: 'rect', silent: true, shape: { x: n.x + 12, y, width: n.w - 22, height: 4, r: 2 }, style: { fill: p.grid } },
        { type: 'rect', silent: true, shape: { x: n.x + 12, y, width: (n.w - 22) * Math.min(1, check.ratio), height: 4, r: 2 }, style: { fill: levelColor(check) } },
      );
    }
  }
  return { option: { animation: false, graphic: { elements } }, width: layout.width, height: layout.height };
}

const shorten = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);

function rating(n: ElectricalNode): string {
  if (n.kind === 'transformador') return n.ratedKva ? `${formatNumber(n.ratedKva, 1)} kVA` : 'Sin capacidad';
  if (n.kind === 'red') return n.primaryKv ? `${formatNumber(n.primaryKv, 1)} kV` : 'Media tensión';
  if (n.kind === 'medidor') return n.meterNumber ? `N.º ${n.meterNumber}` : 'Frontera comercial';
  if (n.kind === 'acometida') return n.ampacityA ? `${formatNumber(n.ampacityA)} A` : 'Sin capacidad';
  return n.breakerA ? `Prot. ${formatNumber(n.breakerA)} A` : 'Sin protección';
}
