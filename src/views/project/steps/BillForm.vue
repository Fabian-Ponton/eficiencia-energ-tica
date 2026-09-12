<script setup lang="ts">
import { IconBolt, IconCalendar, IconChartDots, IconCurrencyDollar, IconNotes } from '@tabler/icons-vue';
import DatePicker from 'primevue/datepicker';
import Textarea from 'primevue/textarea';
import { computed, watch } from 'vue';
import EntityPhotos from '@/components/photos/EntityPhotos.vue';
import CalcPanel from '@/components/ui/CalcPanel.vue';
import NumberInput from '@/components/ui/NumberInput.vue';
import type { FieldErrors } from '@/composables/useRecordEditor';
import type { Draft } from '@/db/records';
import { powerFactorFromEnergy } from '@/domain/calc/bills';
import type { Bill } from '@/domain/types';
import { daysBetween, parseLocal, toPeriod } from '@/utils/dates';
import { formatNumber, formatPercent } from '@/utils/format';

const draft = defineModel<Draft<Bill>>('draft', { required: true });
defineProps<{ errors: FieldErrors; projectId: string }>();

const period = computed({
  get: () => parseLocal(draft.value.period) ?? undefined,
  set: (date: Date | undefined) => {
    draft.value.period = date ? toPeriod(date) : '';
  },
});

// Los días facturados se calculan con las fechas de lectura, salvo que el auditor escriba otro valor
watch(
  () => [draft.value.startDate, draft.value.endDate] as const,
  ([start, end], [oldStart, oldEnd]) => {
    const days = daysBetween(start, end);
    const before = daysBetween(oldStart, oldEnd);
    if (days && (draft.value.days === undefined || draft.value.days === before)) draft.value.days = days;
  },
);

const calc = computed(() => {
  const b = draft.value;
  const items: { label: string; value: string; unit?: string; strong?: boolean }[] = [];
  if (b.kwh > 0 && b.days) items.push({ label: 'Consumo diario', value: formatNumber(b.kwh / b.days, 1), unit: 'kWh/día', strong: true });
  if (b.kwh > 0 && b.costCop > 0) items.push({ label: 'Tarifa efectiva', value: formatNumber(b.costCop / b.kwh, 2), unit: 'COP/kWh' });
  if (b.kwh > 0 && b.kvarh !== undefined) {
    items.push({ label: 'FP promedio', value: formatNumber(powerFactorFromEnergy(b.kwh, b.kvarh), 3) });
    items.push({ label: 'Reactiva', value: formatPercent(b.kvarh / b.kwh, 1), unit: 'de la activa' });
  }
  return items;
});
</script>

<template>
  <section class="form-seccion">
    <h3 class="form-seccion-titulo"><IconCalendar :size="16" />Periodo</h3>
    <div class="form-grid">
      <label class="campo completo">
        <span class="etiqueta">Mes facturado</span>
        <DatePicker v-model="period" view="month" date-format="MM 'de' yy" placeholder="Elegir el mes" :invalid="Boolean(errors.period)" fluid />
        <small v-if="errors.period" class="error">{{ errors.period }}</small>
      </label>
      <label class="campo">
        <span class="etiqueta">Lectura inicial</span>
        <input v-model="draft.startDate" type="date" class="p-inputtext p-component" />
      </label>
      <label class="campo">
        <span class="etiqueta">Lectura final</span>
        <input v-model="draft.endDate" type="date" class="p-inputtext p-component" />
      </label>
      <label class="campo">
        <span class="etiqueta">Días facturados</span>
        <NumberInput v-model="draft.days" :decimals="0" :min="1" :max="62" suffix="días" :invalid="Boolean(errors.days)" />
        <small v-if="errors.days" class="error">{{ errors.days }}</small>
      </label>
    </div>
  </section>

  <section class="form-seccion">
    <h3 class="form-seccion-titulo"><IconBolt :size="16" />Energía</h3>
    <div class="form-grid">
      <label class="campo">
        <span class="etiqueta">Energía activa</span>
        <NumberInput v-model="draft.kwh" required :decimals="1" suffix="kWh" :invalid="Boolean(errors.kwh)" />
        <small v-if="errors.kwh" class="error">{{ errors.kwh }}</small>
      </label>
      <label class="campo">
        <span class="etiqueta">Energía reactiva</span>
        <NumberInput v-model="draft.kvarh" :decimals="1" suffix="kvarh" />
      </label>
      <label class="campo">
        <span class="etiqueta">Demanda máxima</span>
        <NumberInput v-model="draft.demandKw" :decimals="1" suffix="kW" />
      </label>
    </div>
  </section>

  <section class="form-seccion">
    <h3 class="form-seccion-titulo"><IconCurrencyDollar :size="16" />Valores</h3>
    <div class="form-grid">
      <label class="campo">
        <span class="etiqueta">Valor total</span>
        <NumberInput v-model="draft.costCop" required :decimals="0" suffix="COP" :invalid="Boolean(errors.costCop)" />
        <small v-if="errors.costCop" class="error">{{ errors.costCop }}</small>
      </label>
      <label class="campo">
        <span class="etiqueta">Cobro por reactiva</span>
        <NumberInput v-model="draft.reactiveChargeCop" :decimals="0" suffix="COP" />
      </label>
      <label class="campo">
        <span class="etiqueta">Tarifa en la factura</span>
        <NumberInput v-model="draft.tariffCopPerKwh" :decimals="2" suffix="COP/kWh" />
        <small class="ayuda">Opcional: si la dejas vacía se usa el valor total entre los kWh.</small>
      </label>
    </div>
    <CalcPanel v-if="calc.length" :items="calc" />
  </section>

  <section class="form-seccion">
    <h3 class="form-seccion-titulo"><IconChartDots :size="16" />Variables para la línea base</h3>
    <p class="ayuda-seccion">Opcional. Explican por qué un mes consume más que otro y se usan en la línea base energética (ISO 50006).</p>
    <div class="form-grid tres">
      <label class="campo">
        <span class="etiqueta">Días hábiles</span>
        <NumberInput v-model="draft.workingDays" :decimals="0" :max="31" suffix="días" />
      </label>
      <label class="campo">
        <span class="etiqueta">Temperatura media</span>
        <NumberInput v-model="draft.avgTemperatureC" :decimals="1" :min="-10" :max="50" suffix="°C" />
      </label>
      <label class="campo">
        <span class="etiqueta">Ocupación</span>
        <NumberInput v-model="draft.occupancyPct" :decimals="0" :max="100" suffix="%" />
      </label>
    </div>
  </section>

  <section class="form-seccion">
    <EntityPhotos :project-id="projectId" entity-type="factura" :entity-id="draft.id" default-kind="otra" title="Foto de la factura" />
  </section>

  <section class="form-seccion">
    <h3 class="form-seccion-titulo"><IconNotes :size="16" />Observaciones</h3>
    <Textarea v-model="draft.notes" auto-resize rows="2" placeholder="Ajustes, cobros extraordinarios, meses con vacaciones…" />
  </section>
</template>
