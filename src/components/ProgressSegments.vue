<script setup lang="ts">
import { computed } from 'vue';
import type { StageProgress } from '@/domain/progress';

const props = defineProps<{ progress: readonly StageProgress[] }>();

const label = computed(() => props.progress.map((s) => `${s.id}: ${Math.round(s.ratio * 100)} %`).join(', '));
</script>

<template>
  <div class="segmentos" role="img" :aria-label="`Avance por etapa: ${label}`">
    <div v-for="stage in progress" :key="stage.id" class="pista">
      <div class="relleno" :style="{ width: `${Math.round(stage.ratio * 100)}%` }" />
    </div>
  </div>
</template>

<style scoped>
.segmentos {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 4px;
}
.pista {
  height: 6px;
  overflow: hidden;
  border-radius: 3px;
  background: var(--accent-tint);
}
.relleno {
  height: 100%;
  background: var(--accent);
  transition: width 400ms var(--ease);
}
</style>
