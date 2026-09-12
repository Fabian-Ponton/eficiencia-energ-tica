<script setup lang="ts">
import { computed, useId } from 'vue';
import { formatNumber } from '@/utils/format';

/** Plano esquemático a escala de un espacio, con cotas, área y volumen. */
const props = defineProps<{ lengthM?: number; widthM?: number; heightM?: number; compact?: boolean }>();

const id = useId();
const width = computed(() => (props.compact ? 96 : 320));
const height = computed(() => (props.compact ? 72 : 210));
const valid = computed(() => (props.lengthM ?? 0) > 0 && (props.widthM ?? 0) > 0);
const length = computed(() => props.lengthM ?? 0);
const depth = computed(() => props.widthM ?? 0);

const box = computed(() => {
  const pad = props.compact ? { l: 8, r: 8, t: 8, b: 8 } : { l: 46, r: 16, t: 40, b: 14 };
  const availW = width.value - pad.l - pad.r;
  const availH = height.value - pad.t - pad.b;
  const L = length.value || 1;
  const A = depth.value || 1;
  const scale = Math.min(availW / L, availH / A);
  const w = L * scale;
  const h = A * scale;
  return { x: pad.l + (availW - w) / 2, y: pad.t + (availH - h) / 2, w, h, scale };
});
/** Cuadrícula de 1 m, o de 5 m en espacios grandes, como en un plano. */
const grid = computed(() => (box.value.scale >= 10 ? box.value.scale : box.value.scale * 5));
const area = computed(() => length.value * depth.value);
const volume = computed(() => (props.heightM ? area.value * props.heightM : null));
const label = computed(() =>
  valid.value ? `Plano de ${formatNumber(length.value, 2)} por ${formatNumber(depth.value, 2)} metros` : 'Espacio sin dimensiones',
);
</script>

<template>
  <svg :viewBox="`0 0 ${width} ${height}`" class="plano" :class="{ compacto: compact }" role="img" :aria-label="label">
    <defs>
      <pattern :id="`${id}-rejilla`" :width="grid" :height="grid" patternUnits="userSpaceOnUse" :x="box.x" :y="box.y">
        <path :d="`M ${grid} 0 L 0 0 0 ${grid}`" class="rejilla" />
      </pattern>
    </defs>
    <template v-if="valid">
      <rect :x="box.x" :y="box.y" :width="box.w" :height="box.h" class="piso" />
      <rect :x="box.x" :y="box.y" :width="box.w" :height="box.h" :fill="`url(#${id}-rejilla)`" />
      <rect :x="box.x" :y="box.y" :width="box.w" :height="box.h" class="muro" />
      <template v-if="!compact">
        <g class="cota">
          <line :x1="box.x" :y1="box.y - 16" :x2="box.x + box.w" :y2="box.y - 16" />
          <line :x1="box.x" :y1="box.y - 22" :x2="box.x" :y2="box.y - 10" />
          <line :x1="box.x + box.w" :y1="box.y - 22" :x2="box.x + box.w" :y2="box.y - 10" />
          <text :x="box.x + box.w / 2" :y="box.y - 22" text-anchor="middle">{{ formatNumber(length, 2) }} m</text>
        </g>
        <g class="cota">
          <line :x1="box.x - 16" :y1="box.y" :x2="box.x - 16" :y2="box.y + box.h" />
          <line :x1="box.x - 22" :y1="box.y" :x2="box.x - 10" :y2="box.y" />
          <line :x1="box.x - 22" :y1="box.y + box.h" :x2="box.x - 10" :y2="box.y + box.h" />
          <text :transform="`translate(${box.x - 24} ${box.y + box.h / 2}) rotate(-90)`" text-anchor="middle">{{ formatNumber(depth, 2) }} m</text>
        </g>
        <text :x="box.x + box.w / 2" :y="box.y + box.h / 2 + (volume === null ? 5 : -2)" text-anchor="middle" class="area">{{ formatNumber(area, 1) }} m²</text>
        <text v-if="volume !== null" :x="box.x + box.w / 2" :y="box.y + box.h / 2 + 15" text-anchor="middle" class="volumen">
          {{ formatNumber(volume, 1) }} m³ · h {{ formatNumber(heightM ?? 0, 2) }} m
        </text>
      </template>
    </template>
    <template v-else>
      <rect :x="width * 0.1" :y="height * 0.14" :width="width * 0.8" :height="height * 0.72" rx="4" class="vacio" />
      <text v-if="!compact" :x="width / 2" :y="height / 2 + 4" text-anchor="middle" class="volumen">Ingresa el largo y el ancho</text>
    </template>
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
.compacto .muro {
  stroke-width: 1.6;
}
.app-dark .muro {
  stroke: var(--ink-2);
}
.cota line {
  stroke: var(--axis);
  stroke-width: 1;
}
.cota text {
  fill: var(--ink-2);
  font-family: var(--font-mono);
  font-size: 11px;
}
.area {
  fill: var(--ink);
  font-family: var(--font-sans);
  font-size: 15px;
  font-weight: 700;
}
.volumen {
  fill: var(--muted);
  font-family: var(--font-mono);
  font-size: 10px;
}
.vacio {
  fill: none;
  stroke: var(--field-border);
  stroke-dasharray: 5 4;
  stroke-width: 1.5;
}
</style>
