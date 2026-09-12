<script setup lang="ts">
import { computed, useId } from 'vue';
import type { Orientation } from '@/domain/types';
import { formatNumber } from '@/utils/format';

/**
 * Plano a escala de un espacio con la distribución de sus luminarias y el área que ilumina cada una.
 * Al cambiar de la distribución actual a la propuesta, las luminarias se desplazan a su nuevo sitio.
 */
const props = withDefaults(
  defineProps<{
    lengthM: number;
    widthM: number;
    points: readonly { x: number; y: number }[];
    /** Símbolo de la luminaria: lineal (tubos) o panel cuadrado. */
    shape?: 'lineal' | 'panel';
    variant?: 'actual' | 'propuesta';
    windowOrientation?: Orientation;
    windowAreaM2?: number;
    label?: string;
  }>(),
  { shape: 'panel', variant: 'actual', windowOrientation: undefined, windowAreaM2: undefined, label: undefined },
);

const id = useId();
const VW = 340;
const VH = 232;

const box = computed(() => {
  const pad = { l: 44, r: 16, t: 38, b: 14 };
  const availW = VW - pad.l - pad.r;
  const availH = VH - pad.t - pad.b;
  const scale = Math.min(availW / props.lengthM, availH / props.widthM);
  const w = props.lengthM * scale;
  const h = props.widthM * scale;
  return { x: pad.l + (availW - w) / 2, y: pad.t + (availH - h) / 2, w, h, scale };
});
/** Cuadrícula de 1 m, o de 5 m en espacios grandes. */
const grid = computed(() => (box.value.scale >= 10 ? box.value.scale : box.value.scale * 5));
const symbol = computed(() => {
  const [w, h] = props.shape === 'lineal' ? [1.2, 0.3] : [0.6, 0.6];
  return { w: Math.max(7, w * box.value.scale), h: Math.max(5, h * box.value.scale) };
});
/** Radio del halo: la mitad de la separación media entre luminarias. */
const halo = computed(() => {
  const n = Math.max(1, props.points.length);
  return (Math.sqrt((props.lengthM * props.widthM) / n) * box.value.scale) / 1.3;
});
const at = (p: { x: number; y: number }) => ({ transform: `translate(${box.value.x + p.x * box.value.scale}px, ${box.value.y + p.y * box.value.scale}px)` });

/** Ventana dibujada en el muro de su orientación (norte arriba), con 1,5 m de alto supuesto. */
const windowLine = computed(() => {
  const o = props.windowOrientation;
  if (!o || !props.windowAreaM2) return null;
  const b = box.value;
  const along = o === 'N' || o === 'S' ? props.lengthM : props.widthM;
  const len = Math.min(along * 0.85, props.windowAreaM2 / 1.5) * b.scale;
  if (o === 'N') return { x1: b.x + (b.w - len) / 2, y1: b.y, x2: b.x + (b.w + len) / 2, y2: b.y };
  if (o === 'S') return { x1: b.x + (b.w - len) / 2, y1: b.y + b.h, x2: b.x + (b.w + len) / 2, y2: b.y + b.h };
  if (o === 'E') return { x1: b.x + b.w, y1: b.y + (b.h - len) / 2, x2: b.x + b.w, y2: b.y + (b.h + len) / 2 };
  return { x1: b.x, y1: b.y + (b.h - len) / 2, x2: b.x, y2: b.y + (b.h + len) / 2 };
});
const description = computed(
  () => props.label ?? `Plano de ${formatNumber(props.lengthM, 2)} por ${formatNumber(props.widthM, 2)} metros con ${props.points.length} luminarias`,
);
</script>

<template>
  <svg :viewBox="`0 0 ${VW} ${VH}`" class="plano" :class="variant" role="img" :aria-label="description">
    <defs>
      <pattern :id="`${id}-rejilla`" :width="grid" :height="grid" patternUnits="userSpaceOnUse" :x="box.x" :y="box.y">
        <path :d="`M ${grid} 0 L 0 0 0 ${grid}`" class="rejilla" />
      </pattern>
      <radialGradient :id="`${id}-luz`">
        <stop offset="0%" class="luz-centro" />
        <stop offset="100%" class="luz-borde" />
      </radialGradient>
      <clipPath :id="`${id}-local`">
        <rect :x="box.x" :y="box.y" :width="box.w" :height="box.h" />
      </clipPath>
    </defs>

    <rect :x="box.x" :y="box.y" :width="box.w" :height="box.h" class="piso" />
    <rect :x="box.x" :y="box.y" :width="box.w" :height="box.h" :fill="`url(#${id}-rejilla)`" />
    <g :clip-path="`url(#${id}-local)`">
      <g v-for="(p, i) in points" :key="`halo-${i}`" class="mover" :style="at(p)">
        <circle :r="halo" :fill="`url(#${id}-luz)`" />
      </g>
    </g>
    <rect :x="box.x" :y="box.y" :width="box.w" :height="box.h" class="muro" />
    <line v-if="windowLine" v-bind="windowLine" class="ventana" />
    <g v-for="(p, i) in points" :key="`lum-${i}`" class="mover luminaria" :style="at(p)">
      <rect :x="-symbol.w / 2" :y="-symbol.h / 2" :width="symbol.w" :height="symbol.h" rx="1.5" />
    </g>

    <g class="cota">
      <line :x1="box.x" :y1="box.y - 16" :x2="box.x + box.w" :y2="box.y - 16" />
      <line :x1="box.x" :y1="box.y - 22" :x2="box.x" :y2="box.y - 10" />
      <line :x1="box.x + box.w" :y1="box.y - 22" :x2="box.x + box.w" :y2="box.y - 10" />
      <text :x="box.x + box.w / 2" :y="box.y - 22" text-anchor="middle">{{ formatNumber(lengthM, 2) }} m</text>
    </g>
    <g class="cota">
      <line :x1="box.x - 16" :y1="box.y" :x2="box.x - 16" :y2="box.y + box.h" />
      <line :x1="box.x - 22" :y1="box.y" :x2="box.x - 10" :y2="box.y" />
      <line :x1="box.x - 22" :y1="box.y + box.h" :x2="box.x - 10" :y2="box.y + box.h" />
      <text :transform="`translate(${box.x - 24} ${box.y + box.h / 2}) rotate(-90)`" text-anchor="middle">{{ formatNumber(widthM, 2) }} m</text>
    </g>
    <text :x="VW - 6" :y="14" text-anchor="end" class="norte">N ↑</text>
  </svg>
</template>

<style scoped>
.plano {
  display: block;
  width: 100%;
  height: auto;
}
.piso {
  fill: var(--info-wash);
}
.rejilla {
  fill: none;
  stroke: var(--border);
  stroke-width: 0.6;
}
.muro {
  fill: none;
  stroke: var(--navy);
  stroke-width: 2.5;
}
.app-dark .muro {
  stroke: var(--ink-2);
}
.ventana {
  stroke: #5fb4f5;
  stroke-linecap: round;
  stroke-width: 5;
}
.luz-centro {
  stop-color: #f5b83d;
  stop-opacity: 0.42;
}
.luz-borde {
  stop-color: #f5b83d;
  stop-opacity: 0;
}
.propuesta .luz-centro,
.propuesta .luz-borde {
  stop-color: #3ccf7e;
}
/* Las luminarias se desplazan al cambiar de distribución y aparecen con un destello */
.mover {
  transition: transform 450ms var(--ease);
}
.luminaria {
  animation: aparecer 380ms var(--ease) both;
}
.luminaria rect {
  fill: #eda100;
  stroke: #9a6700;
  stroke-width: 1;
}
.propuesta .luminaria rect {
  fill: #22a056;
  stroke: #146b3a;
}
@keyframes aparecer {
  from {
    opacity: 0;
    scale: 0.4;
  }
}
@media (prefers-reduced-motion: reduce) {
  .mover,
  .luminaria {
    animation: none;
    transition: none;
  }
}
.cota line {
  stroke: var(--axis);
  stroke-width: 1;
}
.cota text,
.norte {
  fill: var(--ink-2);
  font-family: var(--font-mono);
  font-size: 11px;
}
</style>
