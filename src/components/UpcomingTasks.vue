<script setup lang="ts">
import { IconCalendarStats, IconChevronRight } from '@tabler/icons-vue';
import { computed } from 'vue';
import { RouterLink } from 'vue-router';
import StatusChip from '@/components/ui/StatusChip.vue';
import { useCurrentProject } from '@/composables/useCurrentProject';
import { useProjectRecords } from '@/composables/useProjectRecords';
import { isOverdue, scheduleSummary, upcomingTasks } from '@/domain/implementation';
import type { Task } from '@/domain/types';
import { OVERDUE_STATUS, TASK_STATUS } from '@/ui/icons';
import { formatDate, toLocalDate } from '@/utils/dates';
import { formatPercent } from '@/utils/format';

/** Tablero del proyecto: lo que sigue en el plan de implementación (atrasadas, en curso y próximas). */
const { projectId } = useCurrentProject();
const { rows: tasks } = useProjectRecords('tasks');
const { rows: measures } = useProjectRecords('measures');
const today = toLocalDate();
const summary = computed(() => scheduleSummary(tasks.value, today));
const next = computed(() => upcomingTasks(tasks.value, today).slice(0, 4));
const codeOf = (t: Task) => measures.value.find((m) => m.id === t.measureId)?.code;
const detail = (t: Task) =>
  isOverdue(t, today) ? `Debía terminar el ${formatDate(t.end)}` : t.status === 'en-ejecucion' ? `En ejecución · termina el ${formatDate(t.end)}` : `Empieza el ${formatDate(t.start)}`;
</script>

<template>
  <section v-if="tasks.length" class="card tareas">
    <div class="encabezado">
      <h2>Próximas tareas</h2>
      <span class="eyebrow">avance del plan {{ formatPercent(summary.progress, 0) }}</span>
    </div>
    <div class="pista"><span class="relleno" :style="{ width: `${summary.progress * 100}%` }" /></div>
    <ul v-if="next.length" class="lista">
      <li v-for="t in next" :key="t.id">
        <RouterLink :to="{ name: 'implementacion', params: { projectId } }" class="fila">
          <span class="texto">
            <strong><span v-if="codeOf(t)" class="mono codigo">{{ codeOf(t) }}</span>{{ t.name }}</strong>
            <span>{{ detail(t) }}{{ t.responsible ? ` · ${t.responsible}` : '' }}</span>
          </span>
          <StatusChip v-bind="isOverdue(t, today) ? OVERDUE_STATUS : TASK_STATUS[t.status]" />
        </RouterLink>
      </li>
    </ul>
    <p v-else class="vacio"><IconCalendarStats :size="18" />No hay tareas pendientes en las próximas semanas.</p>
    <RouterLink :to="{ name: 'implementacion', params: { projectId } }" class="ver">Ver el cronograma <IconChevronRight :size="16" /></RouterLink>
  </section>
</template>

<style scoped>
.tareas {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 14px 16px;
}
.encabezado {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
}
h2 {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
}
.pista {
  height: 4px;
  overflow: hidden;
  border-radius: 2px;
  background: var(--accent-tint);
}
.relleno {
  display: block;
  height: 100%;
  background: var(--accent);
  transition: width 400ms var(--ease);
}
.lista {
  display: flex;
  flex-direction: column;
  margin: 0;
  padding: 0;
  list-style: none;
}
.lista li + li {
  border-top: 1px solid var(--divider);
}
.fila {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 10px 0;
  color: var(--ink);
  text-decoration: none;
}
.fila:hover strong {
  color: var(--accent-strong);
}
.texto {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  font-size: 12.5px;
}
.texto strong {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 2px 6px;
  font-size: 14px;
}
.texto > span {
  color: var(--muted);
}
.codigo {
  color: var(--accent-strong);
  font-size: 12px;
}
.app-dark .codigo {
  color: var(--accent);
}
.vacio {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  color: var(--muted);
  font-size: 13px;
}
.ver {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  align-self: flex-start;
  font-size: 13px;
  font-weight: 600;
}
</style>
