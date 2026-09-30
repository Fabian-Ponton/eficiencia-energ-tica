<script setup lang="ts">
import { IconAirConditioning, IconBulb, IconClock, IconPlus, IconUsers } from '@tabler/icons-vue';
import Button from 'primevue/button';
import { computed, ref, watch } from 'vue';
import EmptyState from '@/components/EmptyState.vue';
import ChoiceChips from '@/components/ui/ChoiceChips.vue';
import FormSheet from '@/components/ui/FormSheet.vue';
import { useCurrentProject } from '@/composables/useCurrentProject';
import { useRecordEditor } from '@/composables/useRecordEditor';
import { areaUse, parseDays, termsOf } from '@/domain/occupancy';
import type { Area, OccupancyRecord } from '@/domain/types';
import { formatNumber } from '@/utils/format';
import OccupancyForm from './OccupancyForm.vue';

const props = defineProps<{ rows: readonly OccupancyRecord[]; areas: readonly Area[]; ready: boolean }>();
const { projectId } = useCurrentProject();

// El periodo por omisión es el último registrado; si no hay ninguno, el semestre de hoy (enero–junio es el 1)
const today = new Date();
const currentTerm = `${today.getFullYear()}-${today.getMonth() < 6 ? 1 : 2}`;
const terms = computed(() => termsOf(props.rows));
const term = ref<string>(terms.value[0] ?? currentTerm);
watch(terms, (list) => {
  if (!list.includes(term.value)) term.value = list[0] ?? currentTerm;
});
const termOptions = computed(() => terms.value.map((t) => ({ value: t, label: t })));
const knownTerms = computed(() => [...new Set([...terms.value, currentTerm])]);

const areaName = (id: string) => props.areas.find((a) => a.id === id)?.name ?? 'Espacio eliminado';
const inTerm = computed(() => props.rows.filter((r) => r.term === term.value));
const byArea = computed(() => {
  const ids = [...new Set(inTerm.value.map((r) => r.areaId))];
  return ids
    .map((id) => ({
      area: props.areas.find((a) => a.id === id),
      id,
      use: areaUse(props.rows, id, term.value),
      blocks: inTerm.value.filter((r) => r.areaId === id).sort((a, b) => a.day.localeCompare(b.day) || a.start.localeCompare(b.start)),
    }))
    .sort((a, b) => areaName(a.id).localeCompare(areaName(b.id), 'es', { numeric: true }));
});
const withoutSchedule = computed(() => props.areas.filter((a) => !inTerm.value.some((r) => r.areaId === a.id)));

const { visible, draft, isNew, errors, saving, openNew, openEdit, save, saveAndDuplicate, remove } = useRecordEditor('occupancy', {
  empty: () => ({ id: crypto.randomUUID(), projectId: projectId.value, areaId: '', term: term.value, activity: '', day: 'L-V', start: '07:00', end: '11:00', hours: 4 }),
  validate: (d) => ({
    areaId: props.areas.some((a) => a.id === d.areaId) ? undefined : 'Elige el espacio.',
    term: d.term?.trim() ? undefined : 'Escribe el periodo, por ejemplo 2026-1.',
    activity: d.activity?.trim() ? undefined : 'Describe la actividad.',
    day: parseDays(d.day).length ? undefined : 'Usa L, M, X, J, V, S o D; por ejemplo L-V o L,X.',
    hours: Number.isFinite(d.hours) && d.hours > 0 && d.hours <= 24 ? undefined : 'Las horas deben estar entre 0 y 24.',
  }),
  describe: (d) => `${areaName(d.areaId)} · ${d.day} ${d.start}–${d.end}`,
  prepare: (d) => ({ ...d, term: d.term.trim(), activity: d.activity.trim() }),
});

// La pantalla de espacios abre el formulario desde su botón «+»
defineExpose({ openNew: (areaId?: string) => openNew(areaId ? { areaId } : {}) });
</script>

<template>
  <template v-if="rows.length">
    <ChoiceChips v-if="termOptions.length > 1" v-model="term" :options="termOptions" label="Periodo académico" />

    <TransitionGroup name="list" tag="div" class="tarjetas">
      <section v-for="g in byArea" :key="g.id" class="card espacio">
        <header class="cabecera">
          <div class="titulo">
            <strong>{{ g.area?.name ?? 'Espacio eliminado' }}</strong>
            <span v-if="g.area?.code || g.area?.floor" class="mono chico">{{ [g.area?.code, g.area?.floor ? `piso ${g.area.floor}` : ''].filter(Boolean).join(' · ') }}</span>
          </div>
          <span class="semana"><span class="num">{{ formatNumber(g.use.weeklyHours, 1) }}</span> h/semana</span>
        </header>
        <p class="resumen">
          <span v-if="g.use.avgOccupants !== null"><IconUsers :size="14" />{{ formatNumber(g.use.avgOccupants, 0) }} personas en promedio</span>
          <span v-if="g.use.acWeeklyHours"><IconAirConditioning :size="14" />aire {{ formatNumber(g.use.acWeeklyHours, 1) }} h</span>
          <span v-if="g.use.lightingWeeklyHours"><IconBulb :size="14" />luz {{ formatNumber(g.use.lightingWeeklyHours, 1) }} h</span>
        </p>
        <ul class="bloques">
          <li v-for="b in g.blocks" :key="b.id">
            <button type="button" @click="openEdit(b)">
              <span class="mono cuando">{{ b.day }} · {{ b.start }}–{{ b.end }}</span>
              <span class="actividad">{{ b.activity }}</span>
              <span class="mono horas">{{ formatNumber(b.hours, 1) }} h</span>
            </button>
          </li>
        </ul>
      </section>
    </TransitionGroup>

    <div v-if="withoutSchedule.length" class="card sin-horario">
      <strong>Sin horario en {{ term }}</strong>
      <div class="chips">
        <button v-for="a in withoutSchedule" :key="a.id" type="button" class="chip" @click="openNew({ areaId: a.id })"><IconPlus :size="14" />{{ a.name }}</button>
      </div>
    </div>
  </template>

  <div v-else-if="ready" class="card">
    <EmptyState
      :icon="IconClock"
      title="Aún no hay horarios de uso"
      text="Registra cuándo se usa cada espacio, con cuánta gente y si el aire y la luz están encendidos. Con eso se comparan las horas de los equipos con el uso real."
    >
      <Button label="Agregar el primer horario" :disabled="!areas.length" @click="openNew()" />
      <small v-if="!areas.length">Primero registra los espacios en la pestaña anterior.</small>
    </EmptyState>
  </div>

  <FormSheet
    v-model:visible="visible"
    :title="isNew ? 'Nuevo horario de uso' : `${areaName(draft.areaId)} · ${draft.day}`"
    eyebrow="Horarios y ocupación"
    :saving="saving"
    :can-delete="!isNew"
    can-duplicate
    @submit="save"
    @delete="remove()"
    @duplicate="saveAndDuplicate"
  >
    <OccupancyForm :key="draft.id" v-model:draft="draft" :errors="errors" :areas="areas" :terms="knownTerms" />
  </FormSheet>
</template>

<style scoped>
.tarjetas {
  display: grid;
  gap: 10px;
}
.espacio {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px 14px;
}
.cabecera {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
}
.titulo {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 4px 10px;
  min-width: 0;
}
.titulo strong {
  font-size: 15px;
}
.chico {
  color: var(--muted);
  font-size: 12px;
}
.semana {
  flex-shrink: 0;
  color: var(--muted);
  font-size: 12px;
}
.semana .num {
  color: var(--ink);
  font-size: 16px;
  font-weight: 600;
}
.resumen {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 14px;
  margin: 0;
  color: var(--muted);
  font-size: 12px;
}
.resumen span {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.bloques {
  display: flex;
  flex-direction: column;
  margin: 0;
  padding: 0;
  list-style: none;
  border-top: 1px solid var(--divider);
}
.bloques li + li {
  border-top: 1px solid var(--divider);
}
.bloques button {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 12px;
  width: 100%;
  min-height: 40px;
  padding: 6px 0;
  border: 0;
  background: transparent;
  color: var(--ink);
  font: inherit;
  font-size: 13px;
  text-align: left;
  cursor: pointer;
}
.bloques button:hover .actividad {
  text-decoration: underline;
}
.cuando {
  color: var(--ink-2);
  font-size: 12px;
  white-space: nowrap;
}
.horas {
  color: var(--muted);
  font-size: 12px;
}
.sin-horario {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px 14px;
  font-size: 13px;
}
.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-height: 32px;
  padding: 0 10px;
  border: 1px dashed var(--field-border);
  border-radius: 999px;
  background: var(--surface);
  color: var(--ink-2);
  font: inherit;
  font-size: 13px;
  cursor: pointer;
}
.chip:hover {
  border-style: solid;
  border-color: var(--accent-strong);
  color: var(--accent-strong);
}
@media (min-width: 1024px) {
  .tarjetas {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
