<script setup lang="ts" generic="T extends string | number | undefined">
import type { Component } from 'vue';

const model = defineModel<T>({ required: true });
const props = defineProps<{
  options: readonly { value: NonNullable<T>; label: string; icon?: Component }[];
  label?: string;
  /** Las opciones ocupan todo el ancho, como un control segmentado. */
  fill?: boolean;
  /** Un segundo toque sobre la opción elegida la quita. */
  clearable?: boolean;
}>();

function choose(value: NonNullable<T>) {
  model.value = (props.clearable && model.value === value ? undefined : value) as T;
}
</script>

<template>
  <div class="opciones" :class="{ llenar: fill }" role="radiogroup" :aria-label="label">
    <button
      v-for="option in options"
      :key="String(option.value)"
      type="button"
      role="radio"
      class="opcion"
      :class="{ activa: model === option.value }"
      :aria-checked="model === option.value"
      @click="choose(option.value)"
    >
      <component :is="option.icon" v-if="option.icon" :size="16" />
      <span>{{ option.label }}</span>
    </button>
  </div>
</template>

<style scoped>
.opciones {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.opcion {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 38px;
  padding: 0 12px;
  border: 1px solid var(--field-border);
  border-radius: 8px;
  background: var(--surface);
  color: var(--ink-2);
  font-size: 13px;
  font-weight: 500;
  white-space: nowrap;
  cursor: pointer;
  transition:
    background-color 120ms var(--ease),
    border-color 120ms var(--ease);
}
.opcion:hover {
  border-color: var(--axis);
}
.opcion.activa {
  border-color: var(--navy);
  background: var(--navy);
  color: #fff;
  font-weight: 600;
}
.app-dark .opcion.activa {
  border-color: var(--accent-strong);
  background: var(--accent-strong);
}
.llenar .opcion {
  flex: 1 1 0;
  padding: 0 8px;
}
</style>
