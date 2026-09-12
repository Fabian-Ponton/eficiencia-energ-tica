<script setup lang="ts">
import { computed } from 'vue';
import { RouterLink, useRoute } from 'vue-router';
import EmptyState from '@/components/EmptyState.vue';
import { useCurrentProject } from '@/composables/useCurrentProject';
import { findStep } from '@/navigation';

const route = useRoute();
const { projectId } = useCurrentProject();
const step = computed(() => findStep(String(route.meta.step ?? route.name ?? '')));
</script>

<template>
  <div class="pendiente">
    <div v-if="step" class="card">
      <EmptyState :icon="step.icon" :title="step.label" :text="`${step.description} Esta pantalla se construye en la fase ${step.phase} del plan.`">
        <RouterLink :to="{ name: 'inicio', params: { projectId } }">Volver al inicio</RouterLink>
      </EmptyState>
    </div>
  </div>
</template>

<style scoped>
.pendiente {
  padding: 16px;
}
@media (min-width: 1024px) {
  .pendiente {
    max-width: 760px;
    padding: 28px;
  }
}
</style>
