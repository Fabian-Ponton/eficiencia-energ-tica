<script setup lang="ts">
import { IconCalendar, IconChartDots, IconNotes } from '@tabler/icons-vue';
import InputText from 'primevue/inputtext';
import MultiSelect from 'primevue/multiselect';
import Textarea from 'primevue/textarea';
import ToggleSwitch from 'primevue/toggleswitch';
import { computed } from 'vue';
import CalcPanel from '@/components/ui/CalcPanel.vue';
import ChoiceChips from '@/components/ui/ChoiceChips.vue';
import NumberInput from '@/components/ui/NumberInput.vue';
import type { FieldErrors } from '@/composables/useRecordEditor';
import type { Draft } from '@/db/records';
import { nonRoutineProportion } from '@/domain/calc/lben';
import type { BaselineAdjustment } from '@/domain/types';
import { periodLabel } from '@/utils/dates';
import { formatNumber, formatPercent } from '@/utils/format';

const draft = defineModel<Draft<BaselineAdjustment>>('draft', { required: true });
const props = defineProps<{ errors: FieldErrors; series: readonly { period: string; value: number }[] }>();

const KINDS = [
  { value: 'no-rutinario', label: 'No rutinario' },
  { value: 'rutinario', label: 'Rutinario' },
  { value: 'actualizacion', label: 'Actualización' },
] as const;

const KIND_HELP: Record<BaselineAdjustment['kind'], string> = {
  'no-rutinario':
    'Un suceso que no se espera que se repita (remodelar un piso, aires fuera de servicio, un paro que impidió usar el edificio). Sus meses no representan la operación habitual.',
  rutinario: 'Un cambio en las variables que sí se repiten (clima, ocupación, horas de operación) que la línea base no tuvo en cuenta. En el modelo estadístico ya está incluido.',
  actualizacion: 'La línea base anterior perdió la capacidad de explicar el consumo (equipos nuevos, cambio de uso o de medidor): se construye una nueva desde otro periodo base.',
};

const periods = computed(() => props.series.map((s) => ({ value: s.period, label: periodLabel(s.period) })));

// Anexo 4, A4.1: se compara el promedio de los meses afectados con el de los meses normales de ese mismo año
const proportion = computed(() => (draft.value.kind === 'no-rutinario' && draft.value.months?.length ? nonRoutineProportion(props.series, draft.value.months) : null));
const calc = computed(() => {
  const p = proportion.value;
  if (!p) return [];
  return [
    { label: `Meses normales de ${p.year}`, value: formatNumber(p.normalAverage), unit: 'kWh/mes' },
    { label: 'Meses afectados', value: formatNumber(p.anomalousAverage), unit: 'kWh/mes' },
    { label: 'Diferencia', value: formatNumber(p.difference), unit: 'kWh/mes' },
    { label: 'Proporción', value: formatPercent(Math.abs(p.proportion), 1), unit: p.proportion >= 0 ? 'menos consumo' : 'más consumo', strong: true },
  ];
});
const cannotCompute = computed(() => draft.value.kind === 'no-rutinario' && Boolean(draft.value.months?.length) && !proportion.value);
</script>

<template>
  <section class="form-seccion">
    <h3 class="form-seccion-titulo"><IconChartDots :size="16" />Tipo de ajuste</h3>
    <div class="campo">
      <ChoiceChips v-model="draft.kind" :options="KINDS" label="Tipo de ajuste" />
      <small class="ayuda">{{ KIND_HELP[draft.kind] }}</small>
    </div>
    <label class="campo">
      <span class="etiqueta">Causa</span>
      <InputText v-model="draft.cause" placeholder="Ej.: aires acondicionados fuera de servicio por reparación del piso 3" :invalid="Boolean(errors.cause)" />
      <small v-if="errors.cause" class="error">{{ errors.cause }}</small>
    </label>
  </section>

  <section class="form-seccion">
    <h3 class="form-seccion-titulo"><IconCalendar :size="16" />Cuándo</h3>
    <div class="form-grid">
      <label class="campo">
        <span class="etiqueta">Fecha del registro</span>
        <input v-model="draft.date" type="date" class="p-inputtext p-component" />
      </label>
      <label v-if="draft.kind !== 'actualizacion'" class="campo">
        <span class="etiqueta">Efecto estimado por mes</span>
        <NumberInput v-model="draft.kwhEffect" :decimals="0" suffix="kWh" />
      </label>
      <label class="campo completo">
        <span class="etiqueta">Meses afectados</span>
        <MultiSelect v-model="draft.months" :options="periods" option-label="label" option-value="value" filter display="chip" placeholder="Elegir los meses" :invalid="Boolean(errors.months)" :max-selected-labels="6" />
        <small v-if="errors.months" class="error">{{ errors.months }}</small>
      </label>
    </div>

    <template v-if="draft.kind === 'no-rutinario'">
      <CalcPanel v-if="calc.length" :items="calc" />
      <p v-else-if="cannotCompute" class="aviso-linea alerta">
        Para calcular la proporción, los meses afectados deben ser del mismo año y ese año necesita meses normales con los que compararlos.
      </p>
      <p v-else class="aviso-linea">Elige los meses afectados y la app calcula cuánto menos (o más) consumieron frente a los meses normales del mismo año.</p>
      <label class="fila-interruptor">
        <span>
          Corregir la línea base con este ajuste
          <small>Los mismos meses de los demás años se ajustan con la proporción (Res. UPME 016, Anexo 4, A4.1) y dejan de salir de la banda.</small>
        </span>
        <ToggleSwitch v-model="draft.applied" />
      </label>
    </template>
  </section>

  <section class="form-seccion">
    <h3 class="form-seccion-titulo"><IconNotes :size="16" />Soporte</h3>
    <Textarea v-model="draft.notes" auto-resize rows="3" placeholder="Documento o evidencia: oficio de la reparación, acta del paro, factura de obra…" />
    <small class="ayuda">El ajuste debe quedar documentado para poder verificar y validar los ahorros (Res. UPME 016, §7.6.2).</small>
  </section>
</template>
