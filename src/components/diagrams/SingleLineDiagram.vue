<script setup lang="ts">
import { useMediaQuery } from '@vueuse/core';
import { computed } from 'vue';
import ElectricalIcon from '@/components/icons/ElectricalIcon.vue';
import { linkPath, singleLineLayout, type PlacedNode } from '@/domain/singleLine';
import type { NodeCheck } from '@/domain/sizing';
import type { ElectricalNode } from '@/domain/types';
import { formatNumber, formatPercent } from '@/utils/format';

/**
 * Diagrama unifilar simplificado: de la red a los circuitos, con la carga de cada elemento frente a su
 * capacidad y la energía «fluyendo» por las líneas (en ámbar o rojo si el elemento está cargado).
 */
const props = withDefaults(defineProps<{ nodes: readonly ElectricalNode[]; checks?: Map<string, NodeCheck>; showCircuits?: boolean }>(), {
  checks: undefined,
  showCircuits: true,
});
const emit = defineEmits<{ select: [node: ElectricalNode] }>();

/** En el celular el tronco principal va a la izquierda para que se vea sin desplazarse. */
const narrow = useMediaQuery('(max-width: 640px)');

interface Placed extends PlacedNode {
  check?: NodeCheck;
}

const layout = computed(() => {
  const base = singleLineLayout(props.nodes, { showCircuits: props.showCircuits, align: narrow.value ? 'left' : 'center' });
  return {
    width: base.width,
    height: base.height,
    placed: base.placed.map((p): Placed => ({ ...p, check: props.checks?.get(p.node.id) })),
    links: base.links.map((l) => ({ id: l.id, d: linkPath(l.points), level: props.checks?.get(l.id)?.level ?? 'normal' })),
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
