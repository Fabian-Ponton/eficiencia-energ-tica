<script setup lang="ts">
import { useTheme } from '@/composables/useTheme';
import { END_USES } from '@/domain/catalogs';
import type { EndUseCategory } from '@/domain/types';
import { END_USE_ICONS } from '@/ui/icons';

/** Selector del uso final con el ícono y el color fijo de cada categoría. */
const model = defineModel<EndUseCategory>({ required: true });
const { isDark } = useTheme();
</script>

<template>
  <div class="categorias" role="radiogroup" aria-label="Uso final">
    <button
      v-for="use in END_USES"
      :key="use.id"
      type="button"
      role="radio"
      class="categoria"
      :class="{ activa: model === use.id }"
      :aria-checked="model === use.id"
      :style="{ '--color': isDark ? use.colorDark : use.color }"
      @click="model = use.id"
    >
      <span class="icono"><component :is="END_USE_ICONS[use.id]" :size="20" /></span>
      <span class="nombre">{{ use.label }}</span>
    </button>
  </div>
</template>

<style scoped>
.categorias {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(78px, 1fr));
  gap: 8px;
}
.categoria {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  min-height: 78px;
  padding: 10px 4px 8px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--surface);
  color: var(--ink-2);
  font-size: 12px;
  font-weight: 500;
  line-height: 1.2;
  text-align: center;
  cursor: pointer;
  transition:
    border-color 150ms var(--ease),
    background-color 150ms var(--ease);
}
.icono {
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  border-radius: 50%;
  background: color-mix(in srgb, var(--color) 16%, transparent);
  color: var(--color);
}
.categoria.activa {
  border-color: var(--color);
  box-shadow: inset 0 0 0 1px var(--color);
  background: color-mix(in srgb, var(--color) 8%, var(--surface));
  color: var(--ink);
  font-weight: 600;
}
.categoria.activa .icono {
  background: var(--color);
  color: #fff;
}
</style>
