<script setup lang="ts">
import { IconClipboardCheck, IconNotes, IconTool } from '@tabler/icons-vue';
import InputText from 'primevue/inputtext';
import Select from 'primevue/select';
import Textarea from 'primevue/textarea';
import { computed } from 'vue';
import EntityPhotos from '@/components/photos/EntityPhotos.vue';
import ChoiceChips from '@/components/ui/ChoiceChips.vue';
import type { FieldErrors } from '@/composables/useRecordEditor';
import type { Draft } from '@/db/records';
import { CONDITIONS } from '@/domain/catalogs';
import { FREQUENCIES, MAINTENANCE_TYPES, nextDue } from '@/domain/maintenance';
import type { Area, Equipment, MaintenanceRecord } from '@/domain/types';
import { CONDITION_STATUS } from '@/ui/icons';
import { formatDate } from '@/utils/dates';

const draft = defineModel<Draft<MaintenanceRecord>>('draft', { required: true });
const props = defineProps<{ errors: FieldErrors; projectId: string; equipment: readonly Equipment[]; areas: readonly Area[] }>();

const TYPE_OPTIONS = MAINTENANCE_TYPES.map((t) => ({ value: t.id, label: t.label }));
const CONDITION_OPTIONS = CONDITIONS.map((c) => ({ value: c.id, label: c.label, icon: CONDITION_STATUS[c.id].icon }));

// El nombre del equipo lleva su espacio para distinguir los repetidos
const options = computed(() =>
  props.equipment.map((e) => ({ id: e.id, label: [e.name, e.code, props.areas.find((a) => a.id === e.areaId)?.name].filter(Boolean).join(' · ') })),
);
const due = computed(() => nextDue(draft.value));
</script>

<template>
  <section class="form-seccion">
    <h3 class="form-seccion-titulo"><IconTool :size="16" />Equipo</h3>
    <label class="campo">
      <span class="etiqueta">Equipo</span>
      <Select v-model="draft.equipmentId" :options="options" option-label="label" option-value="id" placeholder="Elegir" filter :invalid="Boolean(errors.equipmentId)" />
      <small v-if="errors.equipmentId" class="error">{{ errors.equipmentId }}</small>
    </label>
    <div class="campo">
      <span class="etiqueta">Tipo de mantenimiento</span>
      <ChoiceChips v-model="draft.type" :options="TYPE_OPTIONS" label="Tipo de mantenimiento" />
    </div>
  </section>

  <section class="form-seccion">
    <h3 class="form-seccion-titulo"><IconClipboardCheck :size="16" />Último mantenimiento</h3>
    <div class="form-grid">
      <label class="campo">
        <span class="etiqueta">Fecha</span>
        <input v-model="draft.lastAt" type="date" class="p-inputtext p-component" />
      </label>
      <label class="campo">
        <span class="etiqueta">Frecuencia</span>
        <Select v-model="draft.frequency" :options="[...FREQUENCIES]" option-label="label" option-value="id" editable placeholder="Ej.: semestral" />
      </label>
      <p v-if="due" class="aviso-linea completo">El próximo mantenimiento toca el {{ formatDate(due) }}.</p>
      <label class="campo completo">
        <span class="etiqueta">Actividades realizadas</span>
        <Textarea v-model="draft.activities" auto-resize rows="2" placeholder="Ej.: limpieza de filtros, revisión de gas refrigerante" />
      </label>
      <label class="campo completo">
        <span class="etiqueta">Fallas reportadas</span>
        <Textarea v-model="draft.failures" auto-resize rows="2" placeholder="Ej.: se apaga por sobrecalentamiento" />
      </label>
    </div>
  </section>

  <section class="form-seccion">
    <h3 class="form-seccion-titulo"><IconNotes :size="16" />Condición y responsable</h3>
    <div class="campo">
      <span class="etiqueta">Condición actual</span>
      <ChoiceChips v-model="draft.condition" :options="CONDITION_OPTIONS" label="Condición actual del equipo" fill clearable />
    </div>
    <div class="form-grid">
      <label class="campo completo">
        <span class="etiqueta">Recomendación existente</span>
        <Textarea v-model="draft.recommendation" auto-resize rows="2" placeholder="Ej.: reemplazar el compresor" />
      </label>
      <label class="campo completo">
        <span class="etiqueta">Responsable</span>
        <InputText v-model="draft.responsible" placeholder="Quién hace o supervisa el mantenimiento" />
      </label>
      <label class="campo completo">
        <span class="etiqueta">Observaciones</span>
        <Textarea v-model="draft.notes" auto-resize rows="2" />
      </label>
    </div>
  </section>

  <section class="form-seccion">
    <EntityPhotos :project-id="projectId" entity-type="mantenimiento" :entity-id="draft.id" default-kind="documento" title="Evidencia del mantenimiento" hint="Fotos de la hoja de vida, del informe del técnico o del equipo." />
  </section>
</template>
