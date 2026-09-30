<script setup lang="ts">
import { IconCalendar, IconCurrencyDollar, IconFlame, IconNotes } from '@tabler/icons-vue';
import DatePicker from 'primevue/datepicker';
import Textarea from 'primevue/textarea';
import { computed, watch } from 'vue';
import EntityPhotos from '@/components/photos/EntityPhotos.vue';
import CalcPanel from '@/components/ui/CalcPanel.vue';
import ChoiceChips from '@/components/ui/ChoiceChips.vue';
import NumberInput from '@/components/ui/NumberInput.vue';
import type { FieldErrors } from '@/composables/useRecordEditor';
import type { Draft } from '@/db/records';
import { BILL_UNITS, carrierInfo, equivalentKwh, NON_ELECTRIC_CARRIERS, unitLabel } from '@/domain/carriers';
import type { Bill } from '@/domain/types';
import { daysBetween, parseLocal, toPeriod } from '@/utils/dates';
import { formatNumber } from '@/utils/format';

/** Factura de gas natural, GLP u otro energético: cantidad, factor de conversión a kWh y valor. */
const draft = defineModel<Draft<Bill>>('draft', { required: true });
defineProps<{ errors: FieldErrors; projectId: string }>();

const CARRIER_OPTIONS = NON_ELECTRIC_CARRIERS.map((c) => ({ value: c.id, label: c.label }));
const UNIT_OPTIONS = BILL_UNITS.filter((u) => u.id !== 'kWh').map((u) => ({ value: u.id, label: u.label }));
const info = computed(() => carrierInfo(draft.value.carrier));
const unit = computed(() => unitLabel(draft.value.unit));

const period = computed({
  get: () => parseLocal(draft.value.period) ?? undefined,
  set: (date: Date | undefined) => {
    draft.value.period = date ? toPeriod(date) : '';
  },
});

// Al cambiar de energético se propone su unidad habitual
watch(
  () => draft.value.carrier,
  (carrier) => {
    draft.value.unit = carrierInfo(carrier).unit;
  },
);

// Los días facturados salen de las fechas de lectura, salvo que el auditor escriba otro valor
watch(
  () => [draft.value.startDate, draft.value.endDate] as const,
  ([start, end], [oldStart, oldEnd]) => {
    const days = daysBetween(start, end);
    if (days && (draft.value.days === undefined || draft.value.days === daysBetween(oldStart, oldEnd))) draft.value.days = days;
  },
);

// La energía equivalente se guarda en `kwh` para que las exportaciones y los totales la vean; sin factor queda en cero y la factura se marca como incompleta
const kwh = computed(() => equivalentKwh(draft.value));
watch(kwh, (value) => (draft.value.kwh = value ?? 0), { immediate: true });

const calc = computed(() => {
  const b = draft.value;
  const items: { label: string; value: string; unit?: string; strong?: boolean }[] = [];
  if (kwh.value !== null) items.push({ label: 'Energía equivalente', value: formatNumber(kwh.value), unit: 'kWh', strong: true });
  if (kwh.value && b.days) items.push({ label: 'Consumo diario', value: formatNumber(kwh.value / b.days, 1), unit: 'kWh/día' });
  if (kwh.value && b.costCop > 0) items.push({ label: 'Costo por kWh', value: formatNumber(b.costCop / kwh.value, 1), unit: 'COP/kWh' });
  if (b.quantity && b.quantity > 0 && b.costCop > 0) items.push({ label: `Costo por ${unit.value}`, value: formatNumber(b.costCop / b.quantity, 0), unit: `COP/${unit.value}` });
  return items;
});
</script>

<template>
  <section class="form-seccion">
    <h3 class="form-seccion-titulo"><IconFlame :size="16" />Energético</h3>
    <ChoiceChips v-model="draft.carrier" :options="CARRIER_OPTIONS" label="Energético de la factura" fill />
    <small class="ayuda">{{ info.hint }}</small>
  </section>

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
    <h3 class="form-seccion-titulo"><IconFlame :size="16" />Consumo facturado</h3>
    <div class="form-grid">
      <label class="campo">
        <span class="etiqueta">Cantidad</span>
        <NumberInput v-model="draft.quantity" :decimals="2" :suffix="unit" :invalid="Boolean(errors.quantity)" />
        <small v-if="errors.quantity" class="error">{{ errors.quantity }}</small>
      </label>
      <div class="campo">
        <span class="etiqueta">Unidad</span>
        <ChoiceChips v-model="draft.unit" :options="UNIT_OPTIONS" label="Unidad de la cantidad" fill />
      </div>
      <label class="campo completo">
        <span class="etiqueta">Factor de conversión a kWh</span>
        <NumberInput v-model="draft.kwhPerUnit" :decimals="4" :suffix="`kWh/${unit}`" :invalid="Boolean(errors.kwhPerUnit)" />
        <small v-if="errors.kwhPerUnit" class="error">{{ errors.kwhPerUnit }}</small>
        <small v-else class="ayuda">Cópialo de la factura del proveedor. Sin él, esta factura no se puede sumar al balance de todos los energéticos.</small>
      </label>
    </div>
    <CalcPanel v-if="calc.length" :items="calc" />
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
        <span class="etiqueta">Valor de la energía</span>
        <NumberInput v-model="draft.energyCostCop" :decimals="0" suffix="COP" />
        <small class="ayuda">Opcional: sin cargos fijos ni impuestos.</small>
      </label>
    </div>
  </section>

  <section class="form-seccion">
    <EntityPhotos :project-id="projectId" entity-type="factura" :entity-id="draft.id" default-kind="documento" title="Foto de la factura" />
  </section>

  <section class="form-seccion">
    <h3 class="form-seccion-titulo"><IconNotes :size="16" />Observaciones</h3>
    <Textarea v-model="draft.notes" auto-resize rows="2" placeholder="Para qué se usa (laboratorio, cafetería), cobros extraordinarios, medidor compartido…" />
  </section>
</template>
