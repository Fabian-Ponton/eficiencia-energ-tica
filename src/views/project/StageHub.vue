<script setup lang="ts">
import { IconCheck, IconChevronRight } from '@tabler/icons-vue';
import { computed } from 'vue';
import { RouterLink, useRoute } from 'vue-router';
import { useCurrentProject } from '@/composables/useCurrentProject';
import { STAGES } from '@/navigation';

const route = useRoute();
const { projectId, summary } = useCurrentProject();

const index = computed(() => Math.max(0, STAGES.findIndex((s) => s.id === route.params.stage)));
const stage = computed(() => STAGES[index.value]);
const progress = computed(() => summary.value?.progress.find((p) => p.id === stage.value.id));
const percent = computed(() => Math.round((progress.value?.ratio ?? 0) * 100));
const isDone = (id: string) => progress.value?.steps.find((s) => s.id === id)?.done ?? false;

const CIRCUMFERENCE = 2 * Math.PI * 18;
</script>

<template>
  <div class="etapa">
    <header class="encabezado">
      <svg width="52" height="52" viewBox="0 0 44 44" class="anillo" aria-hidden="true">
        <circle cx="22" cy="22" r="18" fill="none" stroke="var(--accent-tint)" stroke-width="4" />
        <circle
          cx="22"
          cy="22"
          r="18"
          fill="none"
          stroke="var(--accent)"
          stroke-width="4"
          stroke-linecap="round"
          :stroke-dasharray="`${(percent / 100) * CIRCUMFERENCE} ${CIRCUMFERENCE}`"
          transform="rotate(-90 22 22)"
        />
        <text x="22" y="26" text-anchor="middle" font-size="11" font-weight="700" fill="currentColor">{{ percent }}%</text>
      </svg>
      <div class="titulos">
        <span class="eyebrow">Etapa {{ index + 1 }} de 4</span>
        <h1>{{ stage.label }}</h1>
        <span class="resumen">{{ progress?.done ?? 0 }} de {{ stage.steps.length }} pasos completos</span>
      </div>
    </header>

    <ul class="card pasos">
      <li v-for="step in stage.steps" :key="step.id">
        <RouterLink :to="{ name: step.id, params: { projectId } }" class="paso">
          <span class="icono" :class="{ hecho: isDone(step.id) }">
            <IconCheck v-if="isDone(step.id)" :size="18" stroke="2.4" />
            <component :is="step.icon" v-else :size="20" />
          </span>
          <span class="textos">
            <span class="nombre">{{ step.label }}</span>
            <span class="descripcion">{{ step.description }}</span>
          </span>
          <IconChevronRight :size="18" class="flecha" />
        </RouterLink>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.etapa {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 16px;
}
.encabezado {
  display: flex;
  align-items: center;
  gap: 14px;
}
.anillo {
  flex-shrink: 0;
  color: var(--ink);
}
.titulos {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
h1 {
  margin: 0;
  font-size: 22px;
  font-weight: 600;
}
.resumen {
  color: var(--muted);
  font-size: 13px;
}
.pasos {
  margin: 0;
  padding: 4px 0;
  list-style: none;
}
.pasos li + li {
  border-top: 1px solid var(--divider);
}
.paso {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 64px;
  padding: 10px 14px;
  color: var(--ink);
  text-decoration: none;
}
.icono {
  display: grid;
  flex-shrink: 0;
  place-items: center;
  width: 40px;
  height: 40px;
  border-radius: 10px;
  background: var(--page);
  color: var(--ink-2);
}
.icono.hecho {
  background: var(--accent-wash);
  color: var(--accent-strong);
}
.textos {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.nombre {
  font-size: 15px;
  font-weight: 600;
}
.descripcion {
  color: var(--muted);
  font-size: 13px;
}
.flecha {
  flex-shrink: 0;
  color: var(--axis);
}
@media (min-width: 1024px) {
  .etapa {
    max-width: 760px;
    padding: 28px;
  }
}
</style>
