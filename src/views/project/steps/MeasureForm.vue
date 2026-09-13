<script setup lang="ts">
import { IconCalculator, IconCoin, IconLink, IconNotes, IconTag } from '@tabler/icons-vue';
import InputText from 'primevue/inputtext';
import MultiSelect from 'primevue/multiselect';
import Textarea from 'primevue/textarea';
import ToggleSwitch from 'primevue/toggleswitch';
import { computed } from 'vue';
import CategoryPicker from '@/components/CategoryPicker.vue';
import EntityPhotos from '@/components/photos/EntityPhotos.vue';
import CalcPanel from '@/components/ui/CalcPanel.vue';
import ChoiceChips from '@/components/ui/ChoiceChips.vue';
import NumberInput from '@/components/ui/NumberInput.vue';
import type { FieldErrors } from '@/composables/useRecordEditor';
import type { Draft } from '@/db/records';
import { measureEconomics, suggestedPriority } from '@/domain/measures';
import type { Finding, Measure, Project } from '@/domain/types';
import { PRIORITY_STATUS } from '@/ui/icons';
import { formatCop, formatNumber, formatPercent, round } from '@/utils/format';

/** Formulario de una medida de ahorro: qué es, cuánto ahorra, cuánto cuesta y a qué hallazgos responde. */
const draft = defineModel<Draft<Measure>>('draft', { required: true });
const props = defineProps<{ errors: FieldErrors; projectId: string; economics: Project['economics']; findings: readonly Finding[] }>();

const KINDS = [
  { value: 'operativa', label: 'Operativa' },
  { value: 'baja-inversion', label: 'Baja inversión' },
  { value: 'alta-inversion', label: 'Alta inversión' },
] as const;
const PRIORITIES = (['alta', 'media', 'baja'] as const).map((id) => ({ value: id, label: PRIORITY_STATUS[id].label.replace('Prioridad ', ''), icon: PRIORITY_STATUS[id].icon }));
const findingOptions = computed(() => props.findings.map((f) => ({ value: f.id, label: f.title })));

const valid = (v: number) => Number.isFinite(v) && v >= 0;
const economics = computed(() => {
  const d = draft.value;
  if (![d.savingsCopYear, d.investmentCop, d.annualCostCop, d.savingsKwhYear].every(valid) || !(d.lifetimeYears > 0)) return null;
  return measureEconomics(d, props.economics);
});
const suggestion = computed(() => (economics.value ? suggestedPriority(economics.value, draft.value.investmentCop) : null));
const calcItems = computed(() => {
  const e = economics.value;
  if (!e) return [];
  return [
    { label: 'Retorno simple', value: Number.isFinite(e.paybackYears) ? formatNumber(e.paybackYears, 1) : '—', unit: Number.isFinite(e.paybackYears) ? 'años' : 'sin ahorro neto', strong: true },
    { label: `VPN · ${e.years} años`, value: formatCop(e.npvCop), unit: 'COP' },
    { label: 'TIR', value: e.irr === null ? '—' : formatPercent(e.irr, 1) },
    { label: 'Emisiones evitadas', value: e.co2TonnesYear === null ? '—' : formatNumber(e.co2TonnesYear, 2), unit: e.co2TonnesYear === null ? 'sin factor' : 't CO₂e/año' },
  ];
});

/** Ahorro en pesos con la tarifa del proyecto. */
const tariffSavings = computed(() => (props.economics.tariffCopPerKwh > 0 && valid(draft.value.savingsKwhYear) ? round(draft.value.savingsKwhYear * props.economics.tariffCopPerKwh) : null));
function useTariffSavings() {
  if (tariffSavings.value !== null) draft.value.savingsCopYear = tariffSavings.value;
}
</script>

<template>
  <section class="form-seccion">
    <h3 class="form-seccion-titulo"><IconTag :size="16" />Medida</h3>
    <div class="form-grid">
      <label class="campo">
        <span class="etiqueta">Código</span>
        <InputText v-model="draft.code" placeholder="M1" :invalid="Boolean(errors.code)" />
        <small v-if="errors.code" class="error">{{ errors.code }}</small>
      </label>
      <div class="campo">
        <span class="etiqueta">Tipo</span>
        <ChoiceChips v-model="draft.kind" :options="KINDS" label="Tipo de medida" />
      </div>
      <label class="campo completo">
        <span class="etiqueta">Nombre</span>
        <InputText v-model="draft.title" placeholder="Ej.: Cambio a iluminación LED en las aulas" :invalid="Boolean(errors.title)" />
        <small v-if="errors.title" class="error">{{ errors.title }}</small>
      </label>
    </div>
    <div class="campo">
      <span class="etiqueta">Uso final</span>
      <CategoryPicker v-model="draft.category" />
    </div>
  </section>

  <section class="form-seccion">
    <h3 class="form-seccion-titulo"><IconCoin :size="16" />Ahorro e inversión</h3>
    <div class="form-grid">
      <label class="campo">
        <span class="etiqueta">Ahorro de energía</span>
        <NumberInput v-model="draft.savingsKwhYear" required :decimals="0" suffix="kWh/año" :invalid="Boolean(errors.savingsKwhYear)" />
        <small v-if="errors.savingsKwhYear" class="error">{{ errors.savingsKwhYear }}</small>
      </label>
      <label class="campo">
        <span class="etiqueta">Ahorro en pesos</span>
        <NumberInput v-model="draft.savingsCopYear" required :decimals="0" suffix="COP/año" :invalid="Boolean(errors.savingsCopYear)" />
        <button v-if="tariffSavings !== null && tariffSavings !== draft.savingsCopYear" type="button" class="valor-rapido sugerido" @click="useTariffSavings">
          Con la tarifa: {{ formatCop(tariffSavings) }}
        </button>
        <small v-if="errors.savingsCopYear" class="error">{{ errors.savingsCopYear }}</small>
      </label>
      <label class="campo">
        <span class="etiqueta">Inversión</span>
        <NumberInput v-model="draft.investmentCop" required :decimals="0" suffix="COP" :invalid="Boolean(errors.investmentCop)" />
        <small v-if="errors.investmentCop" class="error">{{ errors.investmentCop }}</small>
      </label>
      <label class="campo">
        <span class="etiqueta">Costo anual de operación</span>
        <NumberInput v-model="draft.annualCostCop" required :decimals="0" suffix="COP/año" />
      </label>
      <label class="campo">
        <span class="etiqueta">Vida útil</span>
        <NumberInput v-model="draft.lifetimeYears" required :decimals="0" :min="1" :max="50" suffix="años" :invalid="Boolean(errors.lifetimeYears)" />
        <small v-if="errors.lifetimeYears" class="error">{{ errors.lifetimeYears }}</small>
      </label>
    </div>
    <CalcPanel v-if="economics" title="Evaluación económica" :items="calcItems" :note="`Tasa de descuento ${formatPercent(props.economics.discountRate, 0)} · incremento de tarifa ${formatPercent(props.economics.tariffEscalation, 1)} anual`" />
  </section>

  <section class="form-seccion">
    <h3 class="form-seccion-titulo"><IconCalculator :size="16" />Plan de gestión</h3>
    <label class="fila-interruptor">
      <span>Incluir en el PGEE<small>Las medidas incluidas forman los planes de acción y el plan de implementación.</small></span>
      <ToggleSwitch v-model="draft.selected" />
    </label>
    <div class="campo">
      <span class="etiqueta">Prioridad</span>
      <ChoiceChips v-model="draft.priority" :options="PRIORITIES" label="Prioridad de la medida" clearable />
      <small v-if="suggestion && suggestion !== draft.priority" class="ayuda">Sugerida por el retorno: {{ PRIORITY_STATUS[suggestion].label.toLowerCase() }}.</small>
    </div>
  </section>

  <section class="form-seccion">
    <h3 class="form-seccion-titulo"><IconLink :size="16" />Hallazgos que atiende</h3>
    <MultiSelect
      v-model="draft.findingIds"
      :options="findingOptions"
      option-label="label"
      option-value="value"
      display="chip"
      :placeholder="findingOptions.length ? 'Elige los hallazgos' : 'Aún no hay hallazgos en el diagnóstico'"
      :disabled="!findingOptions.length"
      :filter="findingOptions.length > 8"
      class="w-full"
    />
  </section>

  <section class="form-seccion">
    <h3 class="form-seccion-titulo"><IconNotes :size="16" />Descripción</h3>
    <Textarea v-model="draft.description" auto-resize rows="3" placeholder="Qué se hace, dónde y con qué especificación técnica." />
    <Textarea v-model="draft.notes" auto-resize rows="2" placeholder="Observaciones: cotizaciones, supuestos, riesgos…" />
  </section>

  <EntityPhotos :project-id="projectId" entity-type="medida" :entity-id="draft.id" default-kind="instalacion" title="Fotos de la medida" />
</template>

<style scoped>
.sugerido {
  align-self: flex-start;
}
.w-full {
  width: 100%;
}
</style>
