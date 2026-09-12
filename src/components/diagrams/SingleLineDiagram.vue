<script setup lang="ts">
import { useMediaQuery } from '@vueuse/core';
import { computed } from 'vue';
import ElectricalIcon from '@/components/icons/ElectricalIcon.vue';
import { electricalRows } from '@/domain/electrical';
import type { NodeCheck } from '@/domain/sizing';
import type { ElectricalNode } from '@/domain/types';
import { formatNumber, formatPercent } from '@/utils/format';

/**
 * Diagrama unifilar simplificado: de la red a los circuitos, con la carga de cada elemento frente a su
 * capacidad y la energía «fluyendo» por las líneas (en ámbar o rojo si el elemento está cargado).
 * Los tableros se reparten a lo ancho y sus circuitos se apilan debajo, como en un cuadro de cargas.
 */
const props = withDefaults(defineProps<{ nodes: readonly ElectricalNode[]; checks?: Map<string, NodeCheck>; showCircuits?: boolean }>(), {
  checks: undefined,
  showCircuits: true,
});
const emit = defineEmits<{ select: [node: ElectricalNode] }>();

/** En el celular el tronco principal va a la izquierda para que se vea sin desplazarse. */
const narrow = useMediaQuery('(max-width: 640px)');

const W = 168;
const H = 64;
const GAP = 16;
const V = 44;
const PAD = 12;
const SLOT = W + GAP;
/** Circuitos apilados bajo su tablero. */
const INDENT = 18;
const CW = W - INDENT;
const CH = 52;
const CGAP = 10;

interface Placed {
  node: ElectricalNode;
  x: number;
  y: number;
  w: number;
  h: number;
  compact: boolean;
  check?: NodeCheck;
}

const layout = computed(() => {
  const visible = props.nodes.filter((n) => props.showCircuits || n.kind !== 'circuito');
  const rows = electricalRows(visible);
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
    center.set(n.id, narrow.value ? first : (first + last) / 2);
  };
  let start = 0;
  for (const root of roots) {
    place(root, start);
    start += width.get(root.id) ?? 1;
  }

  const placed = new Map<string, Placed>();
  const depthOf = new Map(rows.map((r) => [r.node.id, r.depth]));
  for (const row of rows) {
    const parent = placed.get(parentOf.get(row.node.id) ?? '');
    const parentNode = parent?.node;
    if (parent && parentNode && stacks(parentNode)) {
      const index = kidsOf(parentNode).indexOf(row.node);
      placed.set(row.node.id, {
        node: row.node,
        x: parent.x + INDENT,
        y: parent.y + parent.h + 14 + index * (CH + CGAP),
        w: CW,
        h: CH,
        compact: true,
        check: props.checks?.get(row.node.id),
      });
      continue;
    }
    placed.set(row.node.id, {
      node: row.node,
      x: PAD + ((center.get(row.node.id) ?? 0.5) - 0.5) * SLOT,
      y: PAD + (depthOf.get(row.node.id) ?? 0) * (H + V),
      w: W,
      h: H,
      compact: false,
      check: props.checks?.get(row.node.id),
    });
  }

  const links = [...placed.values()].flatMap((p) => {
    const parent = placed.get(parentOf.get(p.node.id) ?? '');
    if (!parent) return [];
    let d: string;
    if (p.compact) {
      d = `M ${parent.x + INDENT / 2} ${parent.y + parent.h} V ${p.y + p.h / 2} H ${p.x}`;
    } else {
      const px = parent.x + parent.w / 2;
      const cx = p.x + p.w / 2;
      const bus = parent.y + parent.h + V / 2;
      d = Math.abs(px - cx) < 0.5 ? `M ${px} ${parent.y + parent.h} V ${p.y}` : `M ${px} ${parent.y + parent.h} V ${bus} H ${cx} V ${p.y}`;
    }
    return [{ id: p.node.id, d, level: p.check?.level ?? 'normal' }];
  });
  const all = [...placed.values()];
  return {
    placed: all,
    links,
    width: Math.max(W + PAD * 2, PAD * 2 + totalSlots * SLOT - GAP),
    height: Math.max(H, ...all.map((p) => p.y + p.h)) + PAD,
  };
});

function rating(n: ElectricalNode): string {
  if (n.kind === 'transformador') return n.ratedKva ? `${formatNumber(n.ratedKva, 1)} kVA` : 'Sin capacidad';
  if (n.kind === 'red') return n.primaryKv ? `${formatNumber(n.primaryKv, 1)} kV` : 'Media tensión';
  if (n.kind === 'medidor') return n.meterNumber ? `N.º ${n.meterNumber}` : 'Frontera comercial';
  if (n.kind === 'acometida') return n.ampacityA ? `${formatNumber(n.ampacityA)} A` : 'Sin capacidad';
  return n.breakerA ? `Prot. ${formatNumber(n.breakerA)} A` : 'Sin protección';
}
const detail = (p: Placed) => (p.check ? `${rating(p.node)} · ${formatPercent(p.check.ratio, 0)}` : rating(p.node));
const short = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);
const LEVEL_TEXT = { normal: 'carga normal', alta: 'carga alta', critica: 'carga crítica' } as const;
const describe = (p: Placed) =>
  `${p.node.name}: ${rating(p.node)}${p.check ? `, ${formatPercent(p.check.ratio, 0)} de su capacidad, ${LEVEL_TEXT[p.check.level]}` : ''}`;
</script>

<template>
  <div class="unifilar">
    <svg :width="layout.width" :height="layout.height" :viewBox="`0 0 ${layout.width} ${layout.height}`" role="group" aria-label="Diagrama unifilar del sistema eléctrico">
      <g>
        <path v-for="l in layout.links" :key="`base-${l.id}`" :d="l.d" class="linea" />
        <path v-for="l in layout.links" :key="`flujo-${l.id}`" :d="l.d" class="flujo" :class="l.level" />
      </g>
      <g
        v-for="p in layout.placed"
        :key="p.node.id"
        class="nodo"
        :class="[p.node.kind, p.check?.level]"
        :transform="`translate(${p.x} ${p.y})`"
        role="button"
        tabindex="0"
        :aria-label="describe(p)"
        @click="emit('select', p.node)"
        @keydown.enter.prevent="emit('select', p.node)"
        @keydown.space.prevent="emit('select', p.node)"
      >
        <title>{{ describe(p) }}</title>
        <rect :width="p.w" :height="p.h" :rx="p.compact ? 8 : 10" class="caja" />
        <template v-if="p.compact">
          <rect x="8" y="9" width="26" height="26" rx="7" class="insignia" />
          <ElectricalIcon :kind="p.node.kind" :size="16" x="13" y="14" />
          <text x="42" y="20" class="nombre compacto">{{ short(p.node.name, 18) }}</text>
          <text x="42" y="34" class="detalle">{{ detail(p) }}</text>
        </template>
        <template v-else>
          <rect x="10" y="10" width="30" height="30" rx="8" class="insignia" />
          <ElectricalIcon :kind="p.node.kind" :size="20" x="15" y="15" />
          <text x="48" y="25" class="nombre">{{ short(p.node.name, 19) }}</text>
          <text x="48" y="41" class="detalle">{{ detail(p) }}</text>
        </template>
        <template v-if="p.check">
          <rect x="10" :y="p.h - (p.compact ? 9 : 12)" :width="p.w - 20" height="4" rx="2" class="pista" />
          <rect x="10" :y="p.h - (p.compact ? 9 : 12)" :width="(p.w - 20) * Math.min(1, p.check.ratio)" height="4" rx="2" class="barra" />
        </template>
      </g>
    </svg>
  </div>
</template>

<style scoped>
.unifilar {
  overflow-x: auto;
  padding-bottom: 4px;
  scrollbar-width: thin;
}
svg {
  display: block;
  max-width: none;
  margin: 0 auto;
}
.linea {
  fill: none;
  stroke: var(--field-border);
  stroke-width: 2;
}
/* La energía recorre las líneas hacia abajo; más rápido y en rojo si el elemento está al límite */
.flujo {
  fill: none;
  stroke: var(--accent);
  stroke-dasharray: 4 10;
  stroke-linecap: round;
  stroke-width: 2.4;
  animation: flujo 1.1s linear infinite;
}
.flujo.alta {
  stroke: var(--warning-text);
}
.flujo.critica {
  stroke: var(--critical-text);
  animation-duration: 0.7s;
}
@keyframes flujo {
  to {
    stroke-dashoffset: -28;
  }
}
@media (prefers-reduced-motion: reduce) {
  .flujo {
    animation: none;
  }
}
.nodo {
  color: var(--navy);
  cursor: pointer;
  outline: none;
}
.app-dark .nodo {
  color: var(--ink);
}
.caja {
  fill: var(--surface);
  stroke: var(--border);
  stroke-width: 1.2;
  transition: stroke 150ms var(--ease);
}
.nodo:hover .caja {
  stroke: var(--field-border);
}
.nodo:focus-visible .caja {
  stroke: var(--accent);
  stroke-width: 2;
}
.alta .caja {
  stroke: color-mix(in srgb, var(--warning-text) 55%, var(--border));
}
.critica .caja {
  stroke: color-mix(in srgb, var(--critical-text) 65%, var(--border));
  stroke-width: 1.6;
}
.insignia {
  fill: var(--info-wash);
}
.transformador .insignia {
  fill: var(--warning-wash);
}
.tablero .insignia {
  fill: var(--accent-wash);
}
.circuito .insignia,
.acometida .insignia {
  fill: var(--surface-2);
}
.nombre {
  fill: var(--ink);
  font-family: var(--font-sans);
  font-size: 12.5px;
  font-weight: 600;
}
.nombre.compacto {
  font-size: 11.5px;
}
.detalle {
  fill: var(--muted);
  font-family: var(--font-mono);
  font-size: 10.5px;
}
.pista {
  fill: var(--divider);
}
.barra {
  fill: var(--accent);
  transition: width 600ms var(--ease);
}
.alta .barra {
  fill: var(--warning-text);
}
.critica .barra {
  fill: var(--critical-text);
}
</style>
