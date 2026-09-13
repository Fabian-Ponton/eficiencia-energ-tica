<script setup lang="ts">
import { IconCalendarEvent, IconCash, IconChecklist, IconNotes, IconProgress } from '@tabler/icons-vue';
import InputText from 'primevue/inputtext';
import Select from 'primevue/select';
import Textarea from 'primevue/textarea';
import { computed, watch } from 'vue';
import EntityPhotos from '@/components/photos/EntityPhotos.vue';
import ChoiceChips from '@/components/ui/ChoiceChips.vue';
import NumberInput from '@/components/ui/NumberInput.vue';
import type { FieldErrors } from '@/composables/useRecordEditor';
import type { Draft } from '@/db/records';
import { FUNDING_SOURCES, kpiFor, PHASE_OF_PRIORITY, TASK_PHASES, taskDays, verificationFor } from '@/domain/implementation';
import type { Measure, Task } from '@/domain/types';
import { TASK_STATUS } from '@/ui/icons';
import { formatCop } from '@/utils/format';

/** Formulario de una tarea del plan: qué se hace, cuándo, quién, con qué dinero y cómo va. */
const draft = defineModel<Draft<Task>>('draft', { required: true });
const props = defineProps<{ errors: FieldErrors; projectId: string; measures: readonly Measure[]; tasks: readonly Task[] }>();

const PHASES = TASK_PHASES.map((p) => ({ value: p.id, label: p.label }));
const STATUSES = (['pendiente', 'en-ejecucion', 'implementada'] as const).map((s) => ({ value: s, label: TASK_STATUS[s].label, icon: TASK_STATUS[s].icon }));
const SOURCES = [...FUNDING_SOURCES];
const QUICK_PROGRESS = [0, 25, 50, 75, 100];
const measureOptions = computed(() => props.measures.map((m) => ({ value: m.id, label: `${m.code} · ${m.title}${m.selected ? '' : ' (fuera del plan)'}` })));
const measure = computed(() => props.measures.find((m) => m.id === draft.value.measureId));
const days = computed(() => taskDays(draft.value));

/** Parte de la inversión de la medida que aún no tiene tarea: evita contar dos veces el mismo dinero. */
const budgetHint = computed(() => {
  const m = measure.value;
  if (!m) return null;
  const assigned = props.tasks.filter((t) => t.measureId === m.id && t.id !== draft.value.id).reduce((total, t) => total + (t.budgetCop ?? 0), 0);
  const remaining = m.investmentCop - assigned;
  if (remaining <= 0 || remaining === draft.value.budgetCop) return null;
  return { value: remaining, label: assigned > 0 ? `Resto de la inversión de ${m.code}` : `Inversión de ${m.code}` };
});

/** Al elegir la medida se completan el nombre, el plazo, el indicador y la verificación que falten. */
function chooseMeasure(id: string | null | undefined) {
  draft.value.measureId = id ?? undefined;
  const m = props.measures.find((x) => x.id === id);
  if (!m) return;
  if (!draft.value.name.trim()) {
    draft.value.name = m.title;
    draft.value.phase = PHASE_OF_PRIORITY[m.priority ?? 'baja'];
  }
  draft.value.kpi ||= kpiFor(m);
  draft.value.verification ||= verificationFor(m);
}

// El estado y el avance van de la mano: implementada es el 100 %; pendiente, sin avance
watch(
  () => draft.value.status,
  (status) => {
    if (status === 'implementada') draft.value.progress = 100;
    else if (status === 'pendiente') draft.value.progress = 0;
  },
);
watch(
  () => draft.value.progress,
  (progress) => {
    if (progress >= 100 && draft.value.status !== 'implementada') draft.value.status = 'implementada';
    else if (progress > 0 && progress < 100 && draft.value.status !== 'en-ejecucion') draft.value.status = 'en-ejecucion';
  },
);
</script>

<template>
  <section class="form-seccion">
    <h3 class="form-seccion-titulo"><IconChecklist :size="16" />Tarea</h3>
    <label class="campo">
      <span class="etiqueta">Nombre</span>
      <InputText v-model="draft.name" placeholder="Ej.: Instalación de luminarias LED en las aulas" :invalid="Boolean(errors.name)" />
      <small v-if="errors.name" class="error">{{ errors.name }}</small>
    </label>
    <label class="campo">
      <span class="etiqueta">Medida del plan</span>
      <Select
        :model-value="draft.measureId"
        :options="measureOptions"
        option-label="label"
        option-value="value"
        placeholder="Sin medida (tarea general)"
        show-clear
        @update:model-value="chooseMeasure"
      />
    </label>
    <div class="campo">
      <span class="etiqueta">Plazo</span>
      <ChoiceChips v-model="draft.phase" :options="PHASES" label="Plazo de la tarea" fill />
    </div>
  </section>

  <section class="form-seccion">
    <h3 class="form-seccion-titulo"><IconCalendarEvent :size="16" />Programación</h3>
    <div class="form-grid">
      <label class="campo">
        <span class="etiqueta">Inicio</span>
        <input v-model="draft.start" type="date" class="p-inputtext p-component" />
      </label>
      <label class="campo">
        <span class="etiqueta">Fin</span>
        <input v-model="draft.end" type="date" class="p-inputtext p-component" :class="{ 'p-invalid': errors.end }" />
        <small v-if="errors.end" class="error">{{ errors.end }}</small>
        <small v-else-if="days" class="ayuda">{{ days }} {{ days === 1 ? 'día' : 'días' }}</small>
      </label>
      <label class="campo completo">
        <span class="etiqueta">Responsable</span>
        <InputText v-model="draft.responsible" placeholder="Persona o dependencia" />
      </label>
    </div>
  </section>

  <section class="form-seccion">
    <h3 class="form-seccion-titulo"><IconCash :size="16" />Presupuesto</h3>
    <div class="form-grid">
      <label class="campo">
        <span class="etiqueta">Presupuesto</span>
        <NumberInput v-model="draft.budgetCop" :decimals="0" suffix="COP" />
        <button v-if="budgetHint" type="button" class="valor-rapido sugerido" @click="draft.budgetCop = budgetHint.value">
          {{ budgetHint.label }}: {{ formatCop(budgetHint.value) }}
        </button>
      </label>
      <label class="campo">
        <span class="etiqueta">Financiación</span>
        <Select v-model="draft.fundingSource" :options="SOURCES" editable placeholder="Elegir o escribir" show-clear />
      </label>
    </div>
  </section>

  <section class="form-seccion">
    <h3 class="form-seccion-titulo"><IconProgress :size="16" />Avance</h3>
    <div class="campo">
      <span class="etiqueta">Estado</span>
      <ChoiceChips v-model="draft.status" :options="STATUSES" label="Estado de la tarea" fill />
    </div>
    <label class="campo">
      <span class="etiqueta">Avance</span>
      <NumberInput v-model="draft.progress" required :decimals="0" :min="0" :max="100" suffix="%" :invalid="Boolean(errors.progress)" />
      <small v-if="errors.progress" class="error">{{ errors.progress }}</small>
    </label>
    <div class="valores-rapidos">
      <button v-for="v in QUICK_PROGRESS" :key="v" type="button" class="valor-rapido" @click="draft.progress = v">{{ v }} %</button>
    </div>
  </section>

  <section class="form-seccion">
    <h3 class="form-seccion-titulo"><IconNotes :size="16" />Seguimiento</h3>
    <label class="campo">
      <span class="etiqueta">Indicador</span>
      <InputText v-model="draft.kpi" placeholder="Ej.: kWh/mes del bloque frente a la línea base" />
    </label>
    <label class="campo">
      <span class="etiqueta">Verificación del ahorro</span>
      <InputText v-model="draft.verification" placeholder="Ej.: IPMVP opción B, medición antes y después" />
    </label>
    <Textarea v-model="draft.notes" auto-resize rows="2" placeholder="Observaciones: contratista, riesgos, compromisos…" />
  </section>

  <EntityPhotos :project-id="projectId" entity-type="tarea" :entity-id="draft.id" default-kind="instalacion" title="Evidencia de la tarea" />
</template>

<style scoped>
.sugerido {
  align-self: flex-start;
}
</style>
