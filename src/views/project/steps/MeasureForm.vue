<script setup lang="ts">
import { IconAlertTriangle, IconCalculator, IconCoin, IconListDetails, IconLink, IconNotes, IconPlus, IconTag, IconTrash, IconUserCheck } from '@tabler/icons-vue';
import Button from 'primevue/button';
import InputText from 'primevue/inputtext';
import MultiSelect from 'primevue/multiselect';
import Textarea from 'primevue/textarea';
import ToggleSwitch from 'primevue/toggleswitch';
import { computed, watch } from 'vue';
import CategoryPicker from '@/components/CategoryPicker.vue';
import EntityPhotos from '@/components/photos/EntityPhotos.vue';
import CalcPanel from '@/components/ui/CalcPanel.vue';
import ChoiceChips from '@/components/ui/ChoiceChips.vue';
import NumberInput from '@/components/ui/NumberInput.vue';
import type { FieldErrors } from '@/composables/useRecordEditor';
import type { Draft } from '@/db/records';
import { measureEconomics, paybackText, SAVINGS_TYPES, savingsTypeInfo, savingsTypeOf, suggestedPriority } from '@/domain/measures';
import { sum } from '@/domain/calc/stats';
import { measureAllowance, type TenureScope } from '@/domain/tenure';
import type { Finding, Measure, Project, SavingsType } from '@/domain/types';
import { PRIORITY_STATUS } from '@/ui/icons';
import { formatCop, formatNumber, formatPercent, round } from '@/utils/format';

/** Formulario de una medida de ahorro: qué es, cuánto ahorra, cuánto cuesta y a qué hallazgos responde. */
const draft = defineModel<Draft<Measure>>('draft', { required: true });
const props = defineProps<{
  errors: FieldErrors;
  projectId: string;
  economics: Project['economics'];
  findings: readonly Finding[];
  /** Qué medidas permite la tenencia del edificio (Res. 40412, art. 3, par. 3) y cómo se dice en el informe. */
  tenure: { scope: TenureScope; statement: string };
}>();

// Clase de potencial (art. 4d): si el auditor no elige, se infiere del tipo de medida
const savingsType = computed<SavingsType>({
  get: () => savingsTypeOf(draft.value),
  set: (value) => (draft.value.savingsType = value),
});
const TYPE_OPTIONS = SAVINGS_TYPES.map((t) => ({ value: t.id, label: t.short }));
const allowance = computed(() => measureAllowance(props.tenure.scope, savingsType.value));
// Una medida que la tenencia no permite sirve como potencial, pero no puede entrar al plan
watch(
  allowance,
  (value) => {
    if (value === 'no-permitida') draft.value.selected = false;
  },
  { immediate: true },
);

/** Qué parte del consumo del sistema representa el ahorro. */
const shareOfSystem = computed(() => {
  const consumption = draft.value.currentConsumptionKwhYear;
  return consumption && consumption > 0 && valid(draft.value.savingsKwhYear) ? draft.value.savingsKwhYear / consumption : null;
});

// Ítems de la plantilla 5 del reporte a la UPME
function addItem() {
  (draft.value.items ??= []).push({ action: '' });
}
const removeItem = (index: number) => draft.value.items?.splice(index, 1);
const itemsTotal = computed(() => sum((draft.value.items ?? []).map((i) => (i.quantity ?? 0) * (i.unitCostCop ?? 0))));

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
    { label: 'Retorno simple', ...paybackText(e, draft.value.investmentCop), strong: true },
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
      <div class="campo completo">
        <span class="etiqueta">Clase de potencial de ahorro</span>
        <ChoiceChips v-model="savingsType" :options="TYPE_OPTIONS" label="Clase de potencial de ahorro" />
        <small class="ayuda">{{ savingsTypeInfo(savingsType).label }}: {{ savingsTypeInfo(savingsType).help }}</small>
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
        <span class="etiqueta">Consumo actual del sistema</span>
        <NumberInput v-model="draft.currentConsumptionKwhYear" :decimals="0" suffix="kWh/año" />
        <small class="ayuda">{{ shareOfSystem !== null ? `El ahorro es el ${formatPercent(shareOfSystem, 1)} de lo que consume hoy el sistema que se interviene.` : 'Lo que consume hoy el sistema o los equipos que interviene la medida.' }}</small>
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
    <p v-if="allowance === 'no-permitida'" class="aviso-linea alerta">
      <IconAlertTriangle :size="16" /><span>{{ tenure.statement }} Esta medida no puede entrar al plan; queda registrada como potencial.</span>
    </p>
    <p v-else-if="allowance === 'confirmar'" class="aviso-linea alerta">
      <IconAlertTriangle :size="16" /><span>{{ tenure.statement }}</span>
    </p>
    <label class="fila-interruptor">
      <span>Incluir en el PGEE<small>Las medidas incluidas forman los planes de acción y el plan de implementación.</small></span>
      <ToggleSwitch v-model="draft.selected" :disabled="allowance === 'no-permitida'" />
    </label>
    <div class="campo">
      <span class="etiqueta">Prioridad</span>
      <ChoiceChips v-model="draft.priority" :options="PRIORITIES" label="Prioridad de la medida" clearable />
      <small v-if="suggestion && suggestion !== draft.priority" class="ayuda">Sugerida por el retorno: {{ PRIORITY_STATUS[suggestion].label.toLowerCase() }}.</small>
    </div>
  </section>

  <section class="form-seccion">
    <h3 class="form-seccion-titulo"><IconUserCheck :size="16" />Seguimiento (Formato 12)</h3>
    <div class="form-grid">
      <label class="campo completo">
        <span class="etiqueta">Evidencia del problema</span>
        <InputText v-model="draft.evidence" placeholder="Ej.: medición del 8 de sep, foto de la placa, factura de agosto" />
      </label>
      <label class="campo">
        <span class="etiqueta">Responsable</span>
        <InputText v-model="draft.responsible" placeholder="Quién la ejecuta" />
      </label>
      <label class="campo">
        <span class="etiqueta">Plazo</span>
        <InputText v-model="draft.deadline" placeholder="Ej.: 3 meses, 2027-03" />
      </label>
      <label class="campo completo">
        <span class="etiqueta">Indicador de seguimiento</span>
        <InputText v-model="draft.indicator" placeholder="Ej.: kWh/mes del laboratorio, horas de apagado por semana" />
      </label>
    </div>
  </section>

  <section class="form-seccion">
    <h3 class="form-seccion-titulo"><IconListDetails :size="16" />Ítems de la medida (plantilla 5 de la UPME)</h3>
    <p class="ayuda-seccion">Opcional. Los elementos que se compran o intervienen, con su cantidad y costo: la plantilla 5 del reporte a la UPME los pide por medida.</p>
    <div v-for="(item, i) in draft.items ?? []" :key="i" class="item">
      <div class="form-grid">
        <label class="campo completo">
          <span class="etiqueta">Acción</span>
          <InputText v-model="item.action" placeholder="Ej.: Reemplazo de luminarias fluorescentes por LED" />
        </label>
        <label class="campo">
          <span class="etiqueta">Elemento</span>
          <InputText v-model="item.element" placeholder="Luminaria 2×32 W" />
        </label>
        <label class="campo">
          <span class="etiqueta">Marca y modelo</span>
          <InputText v-model="item.brandModel" />
        </label>
        <label class="campo">
          <span class="etiqueta">Referencia</span>
          <InputText v-model="item.reference" />
        </label>
        <label class="campo">
          <span class="etiqueta">Cantidad</span>
          <NumberInput v-model="item.quantity" :decimals="0" />
        </label>
        <label class="campo">
          <span class="etiqueta">Unidad</span>
          <InputText v-model="item.unit" placeholder="un, m, kW" />
        </label>
        <label class="campo">
          <span class="etiqueta">Costo unitario</span>
          <NumberInput v-model="item.unitCostCop" :decimals="0" suffix="COP" />
        </label>
        <label class="campo">
          <span class="etiqueta">Fabricante</span>
          <InputText v-model="item.manufacturer" />
        </label>
        <label class="campo">
          <span class="etiqueta">Proveedor</span>
          <InputText v-model="item.supplier" />
        </label>
      </div>
      <Button label="Quitar ítem" severity="secondary" text size="small" @click="removeItem(i)">
        <template #icon><IconTrash :size="16" /></template>
      </Button>
    </div>
    <Button label="Agregar ítem" severity="secondary" outlined size="small" @click="addItem">
      <template #icon><IconPlus :size="16" /></template>
    </Button>
    <p v-if="itemsTotal > 0" class="aviso-linea">Los ítems suman {{ formatCop(itemsTotal) }}{{ draft.investmentCop > 0 ? ` frente a una inversión de ${formatCop(draft.investmentCop)}` : '' }}.</p>
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
.item {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 6px;
  padding: 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
}
.item .form-grid {
  align-self: stretch;
}
.w-full {
  width: 100%;
}
</style>
