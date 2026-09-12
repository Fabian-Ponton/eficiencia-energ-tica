<script setup lang="ts">
import { IconBolt, IconClipboardCheck, IconGauge, IconMapPin, IconNotes } from '@tabler/icons-vue';
import InputText from 'primevue/inputtext';
import Select from 'primevue/select';
import Textarea from 'primevue/textarea';
import { computed, useId, watch } from 'vue';
import EntityPhotos from '@/components/photos/EntityPhotos.vue';
import CalcPanel from '@/components/ui/CalcPanel.vue';
import ChoiceChips from '@/components/ui/ChoiceChips.vue';
import NumberInput from '@/components/ui/NumberInput.vue';
import type { FieldErrors } from '@/composables/useRecordEditor';
import type { Draft } from '@/db/records';
import { DATA_TYPES } from '@/domain/catalogs';
import { defaultVoltageRef, derivePower } from '@/domain/measurements';
import type { Area, ElectricalNode, Equipment, Measurement } from '@/domain/types';
import { formatNumber, formatPercent } from '@/utils/format';

const draft = defineModel<Draft<Measurement>>('draft', { required: true });
const props = defineProps<{
  errors: FieldErrors;
  projectId: string;
  areas: Area[];
  equipment: Equipment[];
  nodes: ElectricalNode[];
  instruments: string[];
}>();

const instrumentsId = useId();
const POINTS = [
  { value: 'general', label: 'General' },
  { value: 'tablero', label: 'Tablero' },
  { value: 'area', label: 'Espacio' },
  { value: 'equipo', label: 'Equipo' },
] as const;
const PHASES = [
  { value: 1, label: '1 fase' },
  { value: 2, label: '2 fases' },
  { value: 3, label: '3 fases' },
] as const;
const REFERENCES = [
  { value: 'LN', label: 'Fase-neutro' },
  { value: 'LL', label: 'Entre fases' },
] as const;
const TYPES = DATA_TYPES.map((t) => ({ value: t.id, label: t.label }));

const pointOptions = computed(() => {
  switch (draft.value.pointType) {
    case 'tablero':
      return props.nodes.map((n) => ({ id: n.id, label: n.name }));
    case 'area':
      return props.areas.map((a) => ({ id: a.id, label: a.name }));
    case 'equipo':
      return props.equipment.map((e) => ({ id: e.id, label: e.code ? `${e.name} · ${e.code}` : e.name }));
    default:
      return [];
  }
});
watch(
  () => draft.value.pointType,
  (type, old) => {
    if (type !== old) draft.value.pointId = undefined;
  },
);

const phases = computed(() => draft.value.phases ?? 3);
const labels = computed(() => ['L1', 'L2', 'L3'].slice(0, phases.value));

function phaseValue(field: 'voltageV' | 'currentA', i: number): number | undefined {
  const value = draft.value[field]?.[i];
  return typeof value === 'number' ? value : undefined;
}
function setPhase(field: 'voltageV' | 'currentA', i: number, value: number | undefined) {
  const next = Array.from({ length: phases.value }, (_, k) => draft.value[field]?.[k] ?? null);
  next[i] = value ?? null;
  draft.value[field] = next.some((v) => v !== null) ? next : undefined;
}
// Al cambiar el número de fases se ajustan las listas y, si no se había elegido otra, la referencia de tensión
watch(phases, (count, old) => {
  for (const field of ['voltageV', 'currentA'] as const) {
    const values = draft.value[field];
    if (values) draft.value[field] = Array.from({ length: count }, (_, k) => values[k] ?? null);
  }
  if (draft.value.voltageRef === defaultVoltageRef(old)) draft.value.voltageRef = defaultVoltageRef(count);
});

const derived = computed(() => derivePower(draft.value));
const calc = computed(() => {
  const d = derived.value;
  const items: { label: string; value: string; unit?: string; strong?: boolean }[] = [];
  if (d.kva !== null) items.push({ label: d.calculated.kva ? 'Potencia aparente (V·I)' : 'Potencia aparente', value: formatNumber(d.kva, 2), unit: 'kVA' });
  if (d.pf !== null) items.push({ label: d.calculated.pf ? 'FP calculado' : 'Factor de potencia', value: formatNumber(d.pf, 3), strong: true });
  if (d.kvar !== null) items.push({ label: d.calculated.kvar ? 'Reactiva calculada' : 'Potencia reactiva', value: formatNumber(d.kvar, 2), unit: 'kvar' });
  if (d.imbalance !== null) items.push({ label: 'Desbalance de corriente', value: formatPercent(d.imbalance, 1) });
  return items;
});
</script>

<template>
  <section class="form-seccion">
    <h3 class="form-seccion-titulo"><IconMapPin :size="16" />Punto medido</h3>
    <ChoiceChips v-model="draft.pointType" :options="POINTS" label="Punto medido" fill />
    <label v-if="draft.pointType !== 'general'" class="campo">
      <span class="etiqueta">{{ { tablero: 'Tablero o circuito', area: 'Espacio', equipo: 'Equipo', general: '' }[draft.pointType] }}</span>
      <Select
        v-model="draft.pointId"
        :options="pointOptions"
        option-label="label"
        option-value="id"
        placeholder="Elegir"
        :filter="pointOptions.length > 8"
        :invalid="Boolean(errors.pointId)"
        empty-message="Todavía no hay registros de este tipo"
      />
      <small v-if="errors.pointId" class="error">{{ errors.pointId }}</small>
    </label>
    <div class="form-grid">
      <label class="campo">
        <span class="etiqueta">Fecha y hora</span>
        <input v-model="draft.takenAt" type="datetime-local" class="p-inputtext p-component" />
        <small v-if="errors.takenAt" class="error">{{ errors.takenAt }}</small>
      </label>
      <label class="campo">
        <span class="etiqueta">Instrumento</span>
        <InputText v-model="draft.instrument" :list="instrumentsId" placeholder="Ej.: Analizador de redes" />
      </label>
    </div>
    <datalist :id="instrumentsId">
      <option v-for="name in instruments" :key="name" :value="name" />
    </datalist>
  </section>

  <section class="form-seccion">
    <h3 class="form-seccion-titulo"><IconGauge :size="16" />Tensión y corriente por fase</h3>
    <div class="form-grid">
      <ChoiceChips v-model="draft.phases" :options="PHASES" label="Número de fases" fill class="completo" />
      <ChoiceChips v-model="draft.voltageRef" :options="REFERENCES" label="Tensión medida" fill class="completo" />
    </div>
    <div class="fases" :style="{ '--fases': labels.length }">
      <span />
      <span v-for="label in labels" :key="label" class="mono cabeza">{{ label }}</span>
      <span class="mono cabeza fila-titulo">V</span>
      <NumberInput
        v-for="(label, i) in labels"
        :key="`v-${label}`"
        :model-value="phaseValue('voltageV', i)"
        :decimals="1"
        :aria-label="`Tensión ${label} en voltios`"
        @update:model-value="(value) => setPhase('voltageV', i, value)"
      />
      <span class="mono cabeza fila-titulo">A</span>
      <NumberInput
        v-for="(label, i) in labels"
        :key="`a-${label}`"
        :model-value="phaseValue('currentA', i)"
        :decimals="2"
        :aria-label="`Corriente ${label} en amperios`"
        @update:model-value="(value) => setPhase('currentA', i, value)"
      />
    </div>
  </section>

  <section class="form-seccion">
    <h3 class="form-seccion-titulo"><IconBolt :size="16" />Potencia y calidad</h3>
    <div class="form-grid">
      <label class="campo">
        <span class="etiqueta">Potencia activa</span>
        <NumberInput v-model="draft.kw" :decimals="2" suffix="kW" />
      </label>
      <label class="campo">
        <span class="etiqueta">Potencia aparente</span>
        <NumberInput v-model="draft.kva" :decimals="2" suffix="kVA" />
      </label>
      <label class="campo">
        <span class="etiqueta">Potencia reactiva</span>
        <NumberInput v-model="draft.kvar" :decimals="2" suffix="kvar" />
      </label>
      <label class="campo">
        <span class="etiqueta">Factor de potencia</span>
        <NumberInput v-model="draft.pf" :decimals="3" :max="1" :invalid="Boolean(errors.pf)" />
      </label>
      <label class="campo">
        <span class="etiqueta">THD de tensión</span>
        <NumberInput v-model="draft.thdV" :decimals="1" :max="100" suffix="%" />
      </label>
      <label class="campo">
        <span class="etiqueta">THD de corriente</span>
        <NumberInput v-model="draft.thdI" :decimals="1" :max="100" suffix="%" />
      </label>
    </div>
    <small v-if="errors.values" class="error">{{ errors.values }}</small>
    <CalcPanel v-if="calc.length" :items="calc" note="Lo calculado no reemplaza lo medido: se muestra solo cuando falta el dato." />
  </section>

  <section class="form-seccion">
    <h3 class="form-seccion-titulo"><IconClipboardCheck :size="16" />Tipo de dato</h3>
    <ChoiceChips v-model="draft.dataType" :options="TYPES" label="Tipo de dato" fill />
  </section>

  <section class="form-seccion">
    <EntityPhotos :project-id="projectId" entity-type="medicion" :entity-id="draft.id" default-kind="instalacion" title="Fotos" hint="Pantalla del analizador, pinzas conectadas o punto de medición." />
  </section>

  <section class="form-seccion">
    <h3 class="form-seccion-titulo"><IconNotes :size="16" />Observaciones</h3>
    <Textarea v-model="draft.notes" auto-resize rows="2" placeholder="Condiciones durante la medición: ocupación, equipos encendidos…" />
  </section>
</template>

<style scoped>
.fases {
  display: grid;
  grid-template-columns: 28px repeat(var(--fases), minmax(0, 1fr));
  gap: 8px;
  align-items: center;
}
.cabeza {
  color: var(--muted);
  font-size: 11px;
  text-align: center;
}
.fila-titulo {
  text-align: left;
}
</style>
