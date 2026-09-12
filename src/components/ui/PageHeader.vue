<script setup lang="ts">
import { computed } from 'vue';
import { findStep, stepEyebrow } from '@/navigation';

const props = defineProps<{
  /** Paso de la auditoría: de él salen el título, la descripción y la etiqueta superior. */
  step?: string;
  title?: string;
  description?: string;
  eyebrow?: string;
  stats?: { label: string; value: string; unit?: string }[];
}>();

const info = computed(() => (props.step ? findStep(props.step) : undefined));
const heading = computed(() => props.title ?? info.value?.label ?? '');
const text = computed(() => props.description ?? info.value?.description);
const overline = computed(() => props.eyebrow ?? (props.step ? stepEyebrow(props.step) : undefined));
</script>

<template>
  <header class="cabecera">
    <div class="fila">
      <div class="textos">
        <span v-if="overline" class="eyebrow">{{ overline }}</span>
        <h1>{{ heading }}</h1>
        <p v-if="text" class="descripcion">{{ text }}</p>
      </div>
      <div v-if="$slots.actions" class="acciones"><slot name="actions" /></div>
    </div>
    <dl v-if="stats?.length" class="card resumen" :class="`n${Math.min(stats.length, 4)}`">
      <div v-for="stat in stats" :key="stat.label" class="dato">
        <dt class="eyebrow">{{ stat.label }}</dt>
        <dd>
          <span class="valor num">{{ stat.value }}</span>
          <span v-if="stat.unit" class="unidad">{{ stat.unit }}</span>
        </dd>
      </div>
    </dl>
    <slot />
  </header>
</template>

<style scoped>
.cabecera {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.fila {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
}
.textos {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}
h1 {
  margin: 0;
  font-size: 22px;
  font-weight: 600;
  line-height: 1.2;
}
.descripcion {
  max-width: 640px;
  margin: 2px 0 0;
  color: var(--muted);
  font-size: 13px;
}
.acciones {
  display: flex;
  flex-shrink: 0;
  gap: 8px;
}
.resumen {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1px;
  margin: 0;
  overflow: hidden;
  background: var(--divider);
}
.resumen.n1 {
  grid-template-columns: minmax(0, 1fr);
}
.resumen.n3 {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}
.dato {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
  padding: 10px 12px;
  background: var(--surface);
}
.dato .eyebrow {
  font-size: 10px;
}
/* El número nunca se corta: si no cabe con la unidad, la unidad baja a la siguiente línea */
dd {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0 4px;
  margin: 0;
  min-width: 0;
}
.valor {
  flex-shrink: 0;
  font-size: 19px;
  font-weight: 600;
  line-height: 1.15;
  white-space: nowrap;
}
.unidad {
  color: var(--muted);
  font-size: 12px;
  white-space: nowrap;
}
@media (min-width: 1024px) {
  h1 {
    font-size: 26px;
  }
  .resumen.n2 {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .resumen.n4 {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
  .dato {
    padding: 12px 16px;
  }
  .valor {
    font-size: 22px;
  }
}
</style>
