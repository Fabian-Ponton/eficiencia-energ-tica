<script setup lang="ts">
import { IconAlertTriangle, IconChecklist, IconNotes, IconSparkles, IconTag } from '@tabler/icons-vue';
import InputText from 'primevue/inputtext';
import Select from 'primevue/select';
import Textarea from 'primevue/textarea';
import EntityPhotos from '@/components/photos/EntityPhotos.vue';
import ChoiceChips from '@/components/ui/ChoiceChips.vue';
import type { FieldErrors } from '@/composables/useRecordEditor';
import type { Draft } from '@/db/records';
import { END_USES } from '@/domain/catalogs';
import type { Finding } from '@/domain/types';
import { FINDING_STATE, SEVERITY_STATUS } from '@/ui/icons';

/** Formulario de un hallazgo: qué se encontró, qué tan grave es, en qué va y la evidencia fotográfica. */
const draft = defineModel<Draft<Finding>>('draft', { required: true });
defineProps<{ errors: FieldErrors; projectId: string }>();

const SEVERITIES = (['critico', 'alto', 'medio', 'bajo'] as const).map((id) => ({ value: id, label: SEVERITY_STATUS[id].label, icon: SEVERITY_STATUS[id].icon }));
const STATES = (['abierto', 'en-medida', 'cerrado'] as const).map((id) => ({ value: id, label: FINDING_STATE[id].label }));
const CATEGORIES: { value: NonNullable<Finding['category']>; label: string }[] = [
  ...END_USES.map((u) => ({ value: u.id, label: u.label })),
  { value: 'electrico', label: 'Sistema eléctrico' },
  { value: 'envolvente', label: 'Envolvente del edificio' },
];
</script>

<template>
  <section class="form-seccion">
    <h3 class="form-seccion-titulo"><IconAlertTriangle :size="16" />Hallazgo</h3>
    <p v-if="draft.auto" class="aviso-linea">
      <IconSparkles :size="16" />
      <span>Lo sugirieron las reglas del análisis con los datos del proyecto. Ajústalo con tu criterio y agrega la evidencia.</span>
    </p>
    <label class="campo">
      <span class="etiqueta">Qué se encontró</span>
      <InputText v-model="draft.title" placeholder="Ej.: Aires del aula 604 sin capacidad suficiente" :invalid="Boolean(errors.title)" />
      <small v-if="errors.title" class="error">{{ errors.title }}</small>
    </label>
    <div class="campo">
      <span class="etiqueta">Gravedad</span>
      <ChoiceChips v-model="draft.severity" :options="SEVERITIES" label="Gravedad del hallazgo" fill />
    </div>
    <div class="campo">
      <span class="etiqueta">Estado</span>
      <ChoiceChips v-model="draft.status" :options="STATES" label="Estado del hallazgo" fill />
    </div>
  </section>

  <section class="form-seccion">
    <h3 class="form-seccion-titulo"><IconTag :size="16" />Clasificación</h3>
    <label class="campo">
      <span class="etiqueta">Sistema o uso afectado</span>
      <Select v-model="draft.category" :options="CATEGORIES" option-label="label" option-value="value" placeholder="Sin clasificar" show-clear />
    </label>
  </section>

  <section class="form-seccion">
    <h3 class="form-seccion-titulo"><IconNotes :size="16" />Descripción</h3>
    <Textarea v-model="draft.description" auto-resize rows="3" placeholder="Qué se observó, dónde, cómo se midió y por qué importa." />
  </section>

  <section class="form-seccion">
    <h3 class="form-seccion-titulo"><IconChecklist :size="16" />Causa, impacto y acción (Formato 11)</h3>
    <div class="form-grid">
      <label class="campo">
        <span class="etiqueta">Fecha del hallazgo</span>
        <input v-model="draft.foundAt" type="date" class="p-inputtext p-component" />
      </label>
      <label class="campo completo">
        <span class="etiqueta">Posible causa</span>
        <Textarea v-model="draft.cause" auto-resize rows="2" placeholder="Ej.: filtros sucios, horario de encendido sin control" />
      </label>
      <label class="campo completo">
        <span class="etiqueta">Impacto energético observado</span>
        <Textarea v-model="draft.energyImpact" auto-resize rows="2" placeholder="Ej.: consumo nocturno de 5,9 kW con el edificio cerrado" />
      </label>
      <label class="campo completo">
        <span class="etiqueta">Acción sugerida</span>
        <Textarea v-model="draft.suggestedAction" auto-resize rows="2" placeholder="Ej.: apagado programado y revisión mensual del mantenimiento" />
      </label>
    </div>
  </section>

  <EntityPhotos :project-id="projectId" entity-type="hallazgo" :entity-id="draft.id" default-kind="estado-fisico" title="Evidencia fotográfica" hint="Fotos de la condición encontrada: placas, termografías, tableros, luminarias…" />
</template>
