<script setup lang="ts">
import { IconAlertTriangle, IconGauge } from '@tabler/icons-vue';
import InputText from 'primevue/inputtext';
import { computed, useId } from 'vue';
import EntityPhotos from '@/components/photos/EntityPhotos.vue';
import CalcPanel from '@/components/ui/CalcPanel.vue';
import NumberInput from '@/components/ui/NumberInput.vue';
import type { FieldErrors } from '@/composables/useRecordEditor';
import type { Draft } from '@/db/records';
import type { MeterReadingRecord } from '@/domain/types';
import { formatDateTime, parseLocal } from '@/utils/dates';
import { formatNumber } from '@/utils/format';

const draft = defineModel<Draft<MeterReadingRecord>>('draft', { required: true });
const props = defineProps<{ errors: FieldErrors; projectId: string; readings: MeterReadingRecord[] }>();
const metersId = useId();

const meters = computed(() => [...new Set(props.readings.map((r) => r.meter))]);
// Lectura anterior del mismo medidor, para mostrar el consumo desde entonces
const previous = computed(() =>
  props.readings
    .filter((r) => r.meter === draft.value.meter.trim() && r.id !== draft.value.id && r.at < draft.value.at)
    .sort((a, b) => b.at.localeCompare(a.at))[0],
);
const since = computed(() => {
  const before = previous.value;
  const from = parseLocal(before?.at);
  const to = parseLocal(draft.value.at);
  if (!before || !from || !to || !Number.isFinite(draft.value.kwh)) return null;
  const days = (to.getTime() - from.getTime()) / 86_400_000;
  return { kwh: draft.value.kwh - before.kwh, days };
});
</script>

<template>
  <section class="form-seccion">
    <h3 class="form-seccion-titulo"><IconGauge :size="16" />Lectura del medidor</h3>
    <div class="form-grid">
      <label class="campo completo">
        <span class="etiqueta">Medidor</span>
        <InputText v-model="draft.meter" :list="metersId" placeholder="Ej.: Medidor principal" :invalid="Boolean(errors.meter)" />
        <small v-if="errors.meter" class="error">{{ errors.meter }}</small>
      </label>
      <label class="campo">
        <span class="etiqueta">Fecha y hora</span>
        <input v-model="draft.at" type="datetime-local" class="p-inputtext p-component" />
        <small v-if="errors.at" class="error">{{ errors.at }}</small>
      </label>
      <label class="campo">
        <span class="etiqueta">Lectura acumulada</span>
        <NumberInput v-model="draft.kwh" required :decimals="1" suffix="kWh" :invalid="Boolean(errors.kwh)" />
        <small v-if="errors.kwh" class="error">{{ errors.kwh }}</small>
      </label>
    </div>
    <datalist :id="metersId">
      <option v-for="name in meters" :key="name" :value="name" />
    </datalist>
    <p v-if="previous" class="ayuda">Lectura anterior: {{ formatNumber(previous.kwh, 1) }} kWh el {{ formatDateTime(previous.at) }}.</p>
    <p v-if="since && since.kwh < 0" class="aviso-linea alerta">
      <IconAlertTriangle :size="16" />Esta lectura es menor que la anterior. Revisa si cambiaron el medidor o si hay un error de digitación.
    </p>
    <CalcPanel
      v-else-if="since && since.days > 0"
      title="Desde la lectura anterior"
      :items="[
        { label: 'Consumo', value: formatNumber(since.kwh, 1), unit: 'kWh' },
        { label: 'Tiempo', value: formatNumber(since.days, 2), unit: 'días' },
        { label: 'Promedio', value: formatNumber(since.kwh / since.days, 1), unit: 'kWh/día', strong: true },
      ]"
    />
  </section>

  <section class="form-seccion">
    <EntityPhotos :project-id="projectId" entity-type="medicion" :entity-id="draft.id" default-kind="otra" title="Foto del display" hint="Una foto de la pantalla del medidor sirve como evidencia de la lectura." />
  </section>
</template>
