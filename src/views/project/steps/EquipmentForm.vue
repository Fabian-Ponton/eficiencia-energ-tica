<script setup lang="ts">
import { IconAirConditioning, IconBolt, IconBulb, IconEngine, IconLayoutGrid, IconListDetails, IconNotes, IconTag } from '@tabler/icons-vue';
import Button from 'primevue/button';
import InputText from 'primevue/inputtext';
import Select from 'primevue/select';
import Textarea from 'primevue/textarea';
import ToggleSwitch from 'primevue/toggleswitch';
import { computed, ref, useId, watch } from 'vue';
import CategoryPicker from '@/components/CategoryPicker.vue';
import HourStrip from '@/components/HourStrip.vue';
import EntityPhotos from '@/components/photos/EntityPhotos.vue';
import CalcPanel from '@/components/ui/CalcPanel.vue';
import ChoiceChips from '@/components/ui/ChoiceChips.vue';
import NumberInput from '@/components/ui/NumberInput.vue';
import type { FieldErrors } from '@/composables/useRecordEditor';
import type { Draft } from '@/db/records';
import { dailyEnergyKwh, installedPowerKw } from '@/domain/calc/equipment';
import { COMMON_BTU, CONDITIONS, EQUIPMENT_SUGGESTIONS, LAMP_TYPES } from '@/domain/catalogs';
import type { Area, ElectricalNode, Equipment } from '@/domain/types';
import { CONDITION_STATUS } from '@/ui/icons';
import { formatCop, formatNumber, round } from '@/utils/format';

const draft = defineModel<Draft<Equipment>>('draft', { required: true });
const props = defineProps<{ errors: FieldErrors; projectId: string; areas: Area[]; panels: ElectricalNode[]; tariff: number }>();

const suggestionsId = useId();
const UNITS = [
  { value: 'W', label: 'W' },
  { value: 'kW', label: 'kW' },
] as const;
const CONDITION_OPTIONS = CONDITIONS.map((c) => ({ value: c.id, label: c.label, icon: CONDITION_STATUS[c.id].icon }));
const thisYear = new Date().getFullYear();

// La potencia se escribe en W o en kW, como venga en la placa; siempre se guarda en kW
const unit = ref<'W' | 'kW'>(['iluminacion', 'ti', 'otros'].includes(draft.value.category) ? 'W' : 'kW');
const power = computed({
  get: () => (Number.isFinite(draft.value.powerKw) ? (unit.value === 'W' ? round(draft.value.powerKw * 1000, 3) : draft.value.powerKw) : Number.NaN),
  set: (value: number) => {
    draft.value.powerKw = !Number.isFinite(value) ? Number.NaN : unit.value === 'W' ? value / 1000 : value;
  },
});
const useFactorPct = computed({
  get: () => (Number.isFinite(draft.value.useFactor) ? round(draft.value.useFactor * 100, 2) : Number.NaN),
  set: (value: number) => {
    draft.value.useFactor = Number.isFinite(value) ? value / 100 : Number.NaN;
  },
});
const efficiencyPct = computed({
  get: () => (draft.value.efficiency === undefined ? undefined : round(draft.value.efficiency * 100, 2)),
  set: (value: number | undefined) => {
    draft.value.efficiency = value === undefined ? undefined : value / 100;
  },
});

// El horario marcado define las horas de uso al día
watch(
  () => draft.value.activeHours,
  (hours) => {
    if (hours) draft.value.hoursPerDay = hours.filter(Boolean).length;
  },
);

const calc = computed(() => {
  const e = draft.value;
  if (!(e.powerKw > 0) || !(e.quantity > 0) || !(e.hoursPerDay >= 0) || !(e.useFactor >= 0)) return null;
  const day = dailyEnergyKwh(e);
  const month = day * (Number.isFinite(e.operatingDaysPerMonth) ? e.operatingDaysPerMonth : 0);
  return [
    { label: 'Potencia instalada', value: formatNumber(installedPowerKw(e), 2), unit: 'kW' },
    { label: 'Energía diaria', value: formatNumber(day, 1), unit: 'kWh/día' },
    { label: 'Energía mensual', value: formatNumber(month), unit: 'kWh/mes', strong: true },
    { label: 'Energía anual', value: formatNumber(month * 12), unit: 'kWh/año' },
    ...(props.tariff > 0 ? [{ label: 'Costo mensual', value: formatCop(month * props.tariff), unit: 'COP' }] : []),
  ];
});

// Aire acondicionado: potencia eléctrica estimada con la capacidad y la eficiencia (EER = BTU/h ÷ W)
const powerFromCapacity = computed(() => (draft.value.capacityBtuH && draft.value.eer ? draft.value.capacityBtuH / draft.value.eer / 1000 : null));
function usePowerFromCapacity() {
  if (!powerFromCapacity.value) return;
  unit.value = 'kW';
  draft.value.powerKw = round(powerFromCapacity.value, 3);
}
const efficacy = computed(() => (draft.value.lumens && draft.value.powerKw > 0 ? draft.value.lumens / (draft.value.powerKw * 1000) : null));

// Motores: potencia eléctrica = HP × 0,746 ÷ eficiencia
const horsepower = ref<number | undefined>(undefined);
function useHorsepower() {
  if (!horsepower.value) return;
  unit.value = 'kW';
  draft.value.powerKw = round((horsepower.value * 0.746) / (draft.value.efficiency || 1), 3);
}
</script>

<template>
  <section class="form-seccion">
    <h3 class="form-seccion-titulo"><IconLayoutGrid :size="16" />Uso final</h3>
    <CategoryPicker v-model="draft.category" />
  </section>

  <section class="form-seccion">
    <h3 class="form-seccion-titulo"><IconTag :size="16" />Identificación</h3>
    <div class="form-grid">
      <label class="campo completo">
        <span class="etiqueta">Nombre del equipo</span>
        <InputText v-model="draft.name" :list="suggestionsId" placeholder="Ej.: Aire acondicionado mini-split" :invalid="Boolean(errors.name)" />
        <small v-if="errors.name" class="error">{{ errors.name }}</small>
      </label>
      <label class="campo">
        <span class="etiqueta">Código</span>
        <InputText v-model="draft.code" class="mono" placeholder="AC-A601-01" />
      </label>
      <label class="campo">
        <span class="etiqueta">Espacio</span>
        <Select v-model="draft.areaId" :options="areas" option-label="name" option-value="id" placeholder="Sin espacio" show-clear :filter="areas.length > 8" />
      </label>
      <label class="campo completo">
        <span class="etiqueta">Tablero o circuito</span>
        <Select
          v-model="draft.panelId"
          :options="panels"
          option-label="name"
          option-value="id"
          placeholder="Sin asignar"
          show-clear
          :filter="panels.length > 8"
          empty-message="Registra los tableros en «Sistema eléctrico»"
        />
      </label>
    </div>
    <datalist :id="suggestionsId">
      <option v-for="name in EQUIPMENT_SUGGESTIONS[draft.category]" :key="name" :value="name" />
    </datalist>
  </section>

  <section class="form-seccion">
    <h3 class="form-seccion-titulo"><IconBolt :size="16" />Potencia y uso</h3>
    <div class="form-grid">
      <div class="campo completo">
        <span class="etiqueta">Potencia de una unidad</span>
        <div class="potencia">
          <NumberInput v-model="power" required :decimals="unit === 'W' ? 1 : 3" :suffix="unit" :invalid="Boolean(errors.powerKw)" aria-label="Potencia de una unidad" />
          <ChoiceChips v-model="unit" :options="UNITS" label="Unidad de potencia" />
        </div>
        <small v-if="errors.powerKw" class="error">{{ errors.powerKw }}</small>
      </div>
      <label class="campo">
        <span class="etiqueta">Cantidad</span>
        <NumberInput v-model="draft.quantity" required :decimals="0" :min="1" suffix="unid." :invalid="Boolean(errors.quantity)" />
      </label>
      <label class="campo">
        <span class="etiqueta">Factor de uso</span>
        <NumberInput v-model="useFactorPct" required :decimals="1" :max="100" suffix="%" :invalid="Boolean(errors.useFactor)" />
      </label>
      <label class="campo">
        <span class="etiqueta">Horas de uso al día</span>
        <NumberInput v-model="draft.hoursPerDay" required :decimals="1" :max="24" suffix="h" :invalid="Boolean(errors.hoursPerDay)" />
      </label>
      <label class="campo">
        <span class="etiqueta">Días de uso al mes</span>
        <NumberInput v-model="draft.operatingDaysPerMonth" required :decimals="0" :max="31" suffix="días" :invalid="Boolean(errors.operatingDaysPerMonth)" />
      </label>
      <small class="ayuda completo">El factor de uso es la parte del tiempo en que el equipo trabaja a plena carga (un aire con compresor que para y arranca, ~60 %).</small>
    </div>
    <div class="campo">
      <span class="etiqueta">Horario típico <span class="opcional">· opcional, alimenta la curva diaria estimada</span></span>
      <HourStrip v-model="draft.activeHours" />
    </div>
    <CalcPanel v-if="calc" :items="calc" />
  </section>

  <section v-if="draft.category === 'climatizacion'" class="form-seccion">
    <h3 class="form-seccion-titulo"><IconAirConditioning :size="16" />Capacidad de climatización</h3>
    <div class="form-grid">
      <label class="campo">
        <span class="etiqueta">Capacidad</span>
        <NumberInput v-model="draft.capacityBtuH" :decimals="0" suffix="BTU/h" />
      </label>
      <label class="campo">
        <span class="etiqueta">EER</span>
        <NumberInput v-model="draft.eer" :decimals="2" suffix="BTU/h·W" />
      </label>
    </div>
    <div class="valores-rapidos">
      <button v-for="btu in COMMON_BTU" :key="btu" type="button" class="valor-rapido" :class="{ activo: draft.capacityBtuH === btu }" @click="draft.capacityBtuH = btu">
        {{ formatNumber(btu) }}
      </button>
    </div>
    <label class="fila-interruptor">
      <span>Inverter<small>Compresor de velocidad variable.</small></span>
      <ToggleSwitch v-model="draft.inverter" />
    </label>
    <div v-if="powerFromCapacity || draft.capacityBtuH" class="aviso-linea">
      <span>
        <template v-if="draft.capacityBtuH">{{ formatNumber(draft.capacityBtuH / 12000, 2) }} toneladas de refrigeración. </template>
        <template v-if="powerFromCapacity">Potencia eléctrica estimada: <strong>{{ formatNumber(powerFromCapacity, 2) }} kW</strong>.</template>
      </span>
      <Button v-if="powerFromCapacity" label="Usar" size="small" severity="secondary" outlined @click="usePowerFromCapacity" />
    </div>
  </section>

  <section v-if="draft.category === 'iluminacion'" class="form-seccion">
    <h3 class="form-seccion-titulo"><IconBulb :size="16" />Iluminación</h3>
    <div class="form-grid">
      <label class="campo">
        <span class="etiqueta">Tipo de lámpara</span>
        <Select v-model="draft.lampType" :options="[...LAMP_TYPES]" option-label="label" option-value="id" placeholder="Elegir" show-clear />
      </label>
      <label class="campo">
        <span class="etiqueta">Flujo por luminaria</span>
        <NumberInput v-model="draft.lumens" :decimals="0" suffix="lm" />
      </label>
    </div>
    <p v-if="efficacy" class="aviso-linea">Eficacia: <strong>{{ formatNumber(efficacy, 0) }} lm/W</strong>{{ efficacy < 80 ? ' · candidata a cambio por LED' : '' }}</p>
  </section>

  <section v-if="draft.category === 'motores'" class="form-seccion">
    <h3 class="form-seccion-titulo"><IconEngine :size="16" />Motor</h3>
    <div class="form-grid">
      <label class="campo">
        <span class="etiqueta">Eficiencia</span>
        <NumberInput v-model="efficiencyPct" :decimals="1" :max="100" suffix="%" />
      </label>
      <div class="campo">
        <span class="etiqueta">Potencia en placa</span>
        <div class="potencia">
          <NumberInput v-model="horsepower" :decimals="2" suffix="HP" aria-label="Potencia en placa en HP" />
          <Button label="Convertir" size="small" severity="secondary" outlined :disabled="!horsepower" @click="useHorsepower" />
        </div>
      </div>
    </div>
    <small class="ayuda">Potencia eléctrica = HP × 0,746 ÷ eficiencia.</small>
  </section>

  <section class="form-seccion">
    <h3 class="form-seccion-titulo"><IconListDetails :size="16" />Estado y placa</h3>
    <ChoiceChips v-model="draft.condition" :options="CONDITION_OPTIONS" label="Estado del equipo" fill />
    <div class="form-grid">
      <label class="campo">
        <span class="etiqueta">Marca</span>
        <InputText v-model="draft.brand" />
      </label>
      <label class="campo">
        <span class="etiqueta">Modelo</span>
        <InputText v-model="draft.model" class="mono" />
      </label>
      <label class="campo">
        <span class="etiqueta">Año de fabricación</span>
        <NumberInput v-model="draft.year" :decimals="0" :min="1950" :max="thisYear" :grouping="false" />
      </label>
    </div>
  </section>

  <section class="form-seccion">
    <EntityPhotos
      :project-id="projectId"
      entity-type="equipo"
      :entity-id="draft.id"
      default-kind="placa"
      title="Fotos del equipo"
      hint="La primera foto queda como placa de características; cambia el tipo tocando la foto."
    />
  </section>

  <section class="form-seccion">
    <h3 class="form-seccion-titulo"><IconNotes :size="16" />Observaciones</h3>
    <Textarea v-model="draft.notes" auto-resize rows="3" placeholder="Hallazgos, horarios especiales, estado del aislamiento…" />
  </section>
</template>

<style scoped>
.potencia {
  display: flex;
  align-items: center;
  gap: 8px;
}
.potencia > :first-child {
  flex: 1;
  min-width: 0;
}
.opcional {
  color: var(--muted);
  font-weight: 400;
}
.aviso-linea {
  align-items: center;
  justify-content: space-between;
  margin: 0;
}
</style>
