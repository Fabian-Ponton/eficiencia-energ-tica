<script setup lang="ts">
import { computed } from 'vue';

/** Horario típico de 24 horas: se toca o se arrastra el dedo para marcar las horas de uso. */
const model = defineModel<boolean[] | undefined>();

const hours = computed(() => Array.from({ length: 24 }, (_, h) => model.value?.[h] ?? false));
const count = computed(() => hours.value.filter(Boolean).length);

const PRESETS = [
  { label: '7–17 h', from: 7, to: 17 },
  { label: '6–22 h', from: 6, to: 22 },
  { label: '24 h', from: 0, to: 24 },
];
const range = (from: number, to: number) => Array.from({ length: 24 }, (_, h) => h >= from && h < to);
const isPreset = (from: number, to: number) => range(from, to).every((on, h) => on === hours.value[h]);

function set(hour: number, value: boolean) {
  if (hours.value[hour] === value) return;
  const next = [...hours.value];
  next[hour] = value;
  model.value = next;
}

let painting: boolean | null = null;
function hourAt(event: PointerEvent): number | null {
  const cell = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>('[data-hora]');
  return cell ? Number(cell.dataset.hora) : null;
}
function start(event: PointerEvent) {
  const hour = hourAt(event);
  if (hour === null) return;
  painting = !hours.value[hour];
  set(hour, painting);
  try {
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  } catch {
    // Sin captura el trazo igual funciona mientras el dedo esté sobre la franja
  }
}
function move(event: PointerEvent) {
  if (painting === null) return;
  const hour = hourAt(event);
  if (hour !== null) set(hour, painting);
}
const stop = () => (painting = null);
</script>

<template>
  <div class="horario">
    <div
      class="horas"
      role="group"
      aria-label="Horas de funcionamiento en un día típico"
      @pointerdown.prevent="start"
      @pointermove="move"
      @pointerup="stop"
      @pointercancel="stop"
    >
      <button
        v-for="(on, h) in hours"
        :key="h"
        type="button"
        class="hora"
        :class="{ activa: on }"
        :data-hora="h"
        :aria-pressed="on"
        :aria-label="`De ${h} a ${h + 1} horas`"
        @click="(event: MouseEvent) => event.detail === 0 && set(h, !on)"
      >
        <span v-if="h % 6 === 0" class="marca mono">{{ h }}</span>
      </button>
    </div>
    <div class="pie">
      <span class="total">
        <template v-if="count"><strong class="num">{{ count }}</strong> h/día marcadas</template>
        <template v-else>Sin horario marcado</template>
      </span>
      <button v-for="p in PRESETS" :key="p.label" type="button" class="valor-rapido" :class="{ activo: isPreset(p.from, p.to) }" @click="model = range(p.from, p.to)">
        {{ p.label }}
      </button>
      <button v-if="count" type="button" class="valor-rapido" @click="model = undefined">Quitar</button>
    </div>
  </div>
</template>

<style scoped>
.horario {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.horas {
  display: grid;
  grid-template-columns: repeat(12, minmax(0, 1fr));
  gap: 3px;
  touch-action: none;
  user-select: none;
}
@media (min-width: 640px) {
  .horas {
    grid-template-columns: repeat(24, minmax(0, 1fr));
  }
}
.hora {
  position: relative;
  height: 30px;
  padding: 0;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--surface-2);
  cursor: pointer;
}
.hora.activa {
  border-color: var(--accent-strong);
  background: var(--accent);
}
.marca {
  position: absolute;
  top: 2px;
  left: 3px;
  color: var(--muted);
  font-size: 9px;
  line-height: 1;
}
.hora.activa .marca {
  color: #fff;
}
.pie {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}
.total {
  margin-right: auto;
  color: var(--ink-2);
  font-size: 13px;
}
.total strong {
  color: var(--ink);
}
</style>
