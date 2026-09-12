<script setup lang="ts">
import { computed } from 'vue';
import { useTheme } from '@/composables/useTheme';
import { END_USES } from '@/domain/catalogs';
import type { EndUseCategory } from '@/domain/types';
import { readableTextOn } from '@/utils/color';
import { formatPercent } from '@/utils/format';

const props = defineProps<{ totals: Partial<Record<EndUseCategory, number>> }>();
const { isDark } = useTheme();

// Se dibuja en el orden de la paleta validada; cada uso conserva su color en toda la app
const items = computed(() => {
  const total = END_USES.reduce((acc, use) => acc + (props.totals[use.id] ?? 0), 0);
  return END_USES.map((use) => {
    const kwh = props.totals[use.id] ?? 0;
    const color = isDark.value ? use.colorDark : use.color;
    return { ...use, kwh, share: total ? kwh / total : 0, color, text: readableTextOn(color) };
  }).filter((use) => use.kwh > 0);
});
const description = computed(() => items.value.map((i) => `${i.label} ${formatPercent(i.share, 0)}`).join(', '));
</script>

<template>
  <div class="barra" role="img" :aria-label="`Consumo por uso final: ${description}`">
    <div v-for="item in items" :key="item.id" class="segmento" :style="{ flexGrow: item.share, background: item.color, color: item.text }">
      <span v-if="item.share >= 0.12" class="mono">{{ formatPercent(item.share, 0) }}</span>
    </div>
  </div>
  <ul class="leyenda">
    <li v-for="item in items" :key="item.id">
      <span class="muestra" :style="{ background: item.color }" />
      <span class="nombre">{{ item.label }}</span>
      <span class="mono num porcentaje">{{ formatPercent(item.share, 0) }}</span>
    </li>
  </ul>
</template>

<style scoped>
.barra {
  display: flex;
  gap: 2px;
  height: 16px;
  overflow: hidden;
  border-radius: 4px;
  background: var(--surface);
}
.segmento {
  display: flex;
  flex: 1 1 0;
  align-items: center;
  min-width: 3px;
  padding-left: 6px;
  font-size: 10px;
  font-weight: 600;
}
.leyenda {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px 16px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.leyenda li {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  white-space: nowrap;
}
.muestra {
  flex-shrink: 0;
  width: 10px;
  height: 10px;
  border-radius: 2px;
}
.nombre {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
}
.porcentaje {
  color: var(--ink-2);
}
</style>
