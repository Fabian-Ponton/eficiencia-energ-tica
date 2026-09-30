<script setup lang="ts">
import { IconClock, IconNotes, IconUsers } from '@tabler/icons-vue';
import InputText from 'primevue/inputtext';
import Select from 'primevue/select';
import Textarea from 'primevue/textarea';
import ToggleSwitch from 'primevue/toggleswitch';
import { watch } from 'vue';
import NumberInput from '@/components/ui/NumberInput.vue';
import type { FieldErrors } from '@/composables/useRecordEditor';
import type { Draft } from '@/db/records';
import { DAY_OPTIONS, hoursBetween } from '@/domain/occupancy';
import type { Area, OccupancyRecord } from '@/domain/types';

const draft = defineModel<Draft<OccupancyRecord>>('draft', { required: true });
defineProps<{ errors: FieldErrors; areas: readonly Area[]; terms: readonly string[] }>();

// Las horas del bloque salen de la hora de inicio y la de fin; se pueden ajustar si hay pausas
watch([() => draft.value.start, () => draft.value.end], () => {
  const hours = hoursBetween(draft.value.start, draft.value.end);
  if (hours !== null) draft.value.hours = hours;
});
</script>

<template>
  <section class="form-seccion">
    <h3 class="form-seccion-titulo"><IconClock :size="16" />Bloque de uso</h3>
    <div class="form-grid">
      <label class="campo completo">
        <span class="etiqueta">Espacio</span>
        <Select v-model="draft.areaId" :options="[...areas]" option-label="name" option-value="id" placeholder="Elegir" filter :invalid="Boolean(errors.areaId)" />
        <small v-if="errors.areaId" class="error">{{ errors.areaId }}</small>
      </label>
      <label class="campo">
        <span class="etiqueta">Periodo académico</span>
        <Select v-model="draft.term" :options="[...terms]" editable placeholder="Ej.: 2026-1" :invalid="Boolean(errors.term)" />
        <small v-if="errors.term" class="error">{{ errors.term }}</small>
      </label>
      <label class="campo">
        <span class="etiqueta">Día o días</span>
        <Select v-model="draft.day" :options="[...DAY_OPTIONS]" option-label="label" option-value="value" editable placeholder="L-V" :invalid="Boolean(errors.day)" />
        <small v-if="errors.day" class="error">{{ errors.day }}</small>
      </label>
      <label class="campo completo">
        <span class="etiqueta">Actividad</span>
        <InputText v-model="draft.activity" placeholder="Ej.: Práctica de química general" :invalid="Boolean(errors.activity)" />
        <small v-if="errors.activity" class="error">{{ errors.activity }}</small>
      </label>
      <label class="campo">
        <span class="etiqueta">Hora de inicio</span>
        <input v-model="draft.start" type="time" class="p-inputtext p-component" />
      </label>
      <label class="campo">
        <span class="etiqueta">Hora de fin</span>
        <input v-model="draft.end" type="time" class="p-inputtext p-component" />
      </label>
      <label class="campo completo">
        <span class="etiqueta">Horas de uso del bloque</span>
        <NumberInput v-model="draft.hours" :decimals="2" :max="24" suffix="h" :invalid="Boolean(errors.hours)" required />
        <small v-if="errors.hours" class="error">{{ errors.hours }}</small>
        <small v-else class="ayuda">Se calculan con la hora de inicio y la de fin. Cámbialas si el espacio se desocupa a mitad del bloque.</small>
      </label>
    </div>
  </section>

  <section class="form-seccion">
    <h3 class="form-seccion-titulo"><IconUsers :size="16" />Ocupación y equipos en uso</h3>
    <div class="form-grid">
      <label class="campo completo">
        <span class="etiqueta">Personas presentes en promedio</span>
        <NumberInput v-model="draft.avgOccupants" :decimals="0" suffix="personas" />
      </label>
    </div>
    <label class="fila-interruptor">
      <span>Se usa el aire acondicionado<small>Durante este bloque el aire está encendido.</small></span>
      <ToggleSwitch v-model="draft.usesAc" />
    </label>
    <label class="fila-interruptor">
      <span>Se usa la iluminación<small>Las luminarias están encendidas durante el bloque.</small></span>
      <ToggleSwitch v-model="draft.usesLighting" />
    </label>
  </section>

  <section class="form-seccion">
    <h3 class="form-seccion-titulo"><IconNotes :size="16" />Observaciones</h3>
    <Textarea v-model="draft.notes" auto-resize rows="2" placeholder="Grupos, prácticas que se repiten, uso fuera de horario…" />
  </section>
</template>
