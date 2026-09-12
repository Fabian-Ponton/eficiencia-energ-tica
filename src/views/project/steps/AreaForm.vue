<script setup lang="ts">
import { IconBulb, IconNotes, IconRuler2, IconTag, IconUsers, IconWindow } from '@tabler/icons-vue';
import InputText from 'primevue/inputtext';
import Select from 'primevue/select';
import Textarea from 'primevue/textarea';
import ToggleSwitch from 'primevue/toggleswitch';
import { computed, ref, watch } from 'vue';
import RoomPlan from '@/components/diagrams/RoomPlan.vue';
import EntityPhotos from '@/components/photos/EntityPhotos.vue';
import CalcPanel from '@/components/ui/CalcPanel.vue';
import ChoiceChips from '@/components/ui/ChoiceChips.vue';
import NumberInput from '@/components/ui/NumberInput.vue';
import StatusChip from '@/components/ui/StatusChip.vue';
import type { FieldErrors } from '@/composables/useRecordEditor';
import type { Draft } from '@/db/records';
import { floorAreaOf, roomIndexOf, volumeOf } from '@/domain/areas';
import { lightingStatus } from '@/domain/calc/sizing/lighting';
import { SPACE_TYPES, spaceTypeOf } from '@/domain/catalogs';
import type { Area } from '@/domain/types';
import { LIGHTING_STATUS } from '@/ui/icons';
import { formatNumber, formatPercent } from '@/utils/format';

const draft = defineModel<Draft<Area>>('draft', { required: true });
defineProps<{ errors: FieldErrors; projectId: string }>();

const SHAPES = [
  { value: 'rectangular', label: 'Rectangular' },
  { value: 'irregular', label: 'Irregular' },
] as const;
const ORIENTATIONS = [
  { value: 'N', label: 'Norte' },
  { value: 'S', label: 'Sur' },
  { value: 'E', label: 'Este' },
  { value: 'O', label: 'Oeste' },
] as const;

const shape = ref<'rectangular' | 'irregular'>(draft.value.areaM2 !== undefined && !draft.value.lengthM ? 'irregular' : 'rectangular');
// En un espacio irregular manda el área ingresada; en uno rectangular, el largo por el ancho
watch(shape, (value) => {
  if (value === 'irregular') {
    draft.value.areaM2 = floorAreaOf(draft.value) ?? undefined;
    draft.value.lengthM = undefined;
    draft.value.widthM = undefined;
  } else draft.value.areaM2 = undefined;
});

const space = computed(() => spaceTypeOf(draft.value.spaceType));
const floor = computed(() => floorAreaOf(draft.value));
const volume = computed(() => volumeOf(draft.value));
const index = computed(() => roomIndexOf(draft.value));

const calc = computed(() => {
  const items = [];
  if (floor.value) items.push({ label: 'Área de piso', value: formatNumber(floor.value, 1), unit: 'm²', strong: true });
  if (volume.value) items.push({ label: 'Volumen', value: formatNumber(volume.value, 1), unit: 'm³' });
  if (index.value) items.push({ label: 'Índice del local K', value: formatNumber(index.value, 2) });
  if (floor.value && draft.value.occupants) items.push({ label: 'Área por persona', value: formatNumber(floor.value / draft.value.occupants, 1), unit: 'm²' });
  return items;
});

const lux = computed(() => {
  const target = space.value?.lux;
  const measured = draft.value.measuredLuxAvg;
  return target && measured ? LIGHTING_STATUS[lightingStatus(measured, target)] : null;
});
const uniformity = computed(() => {
  const { measuredLuxAvg: avg, measuredLuxMin: min } = draft.value;
  return avg && min ? min / avg : null;
});
</script>

<template>
  <section class="form-seccion">
    <h3 class="form-seccion-titulo"><IconTag :size="16" />Identificación</h3>
    <div class="form-grid">
      <label class="campo completo">
        <span class="etiqueta">Nombre del espacio</span>
        <InputText v-model="draft.name" placeholder="Ej.: Aula 601" :invalid="Boolean(errors.name)" />
        <small v-if="errors.name" class="error">{{ errors.name }}</small>
      </label>
      <label class="campo completo">
        <span class="etiqueta">Tipo de espacio</span>
        <Select v-model="draft.spaceType" :options="[...SPACE_TYPES]" option-label="label" option-value="id" placeholder="Elegir" show-clear />
        <small v-if="space?.lux" class="ayuda">Iluminancia de referencia: {{ formatNumber(space.lux) }} lux (valida con el RETILAP).</small>
      </label>
    </div>
  </section>

  <section class="form-seccion">
    <h3 class="form-seccion-titulo"><IconRuler2 :size="16" />Dimensiones</h3>
    <ChoiceChips v-model="shape" :options="SHAPES" label="Forma del espacio" fill />
    <div v-if="shape === 'rectangular'" class="form-grid tres">
      <label class="campo">
        <span class="etiqueta">Largo</span>
        <NumberInput v-model="draft.lengthM" :decimals="2" suffix="m" :invalid="Boolean(errors.lengthM)" />
      </label>
      <label class="campo">
        <span class="etiqueta">Ancho</span>
        <NumberInput v-model="draft.widthM" :decimals="2" suffix="m" :invalid="Boolean(errors.widthM)" />
      </label>
      <label class="campo">
        <span class="etiqueta">Alto</span>
        <NumberInput v-model="draft.heightM" :decimals="2" suffix="m" :invalid="Boolean(errors.heightM)" />
      </label>
    </div>
    <div v-else class="form-grid">
      <label class="campo">
        <span class="etiqueta">Área de piso</span>
        <NumberInput v-model="draft.areaM2" :decimals="1" suffix="m²" />
      </label>
      <label class="campo">
        <span class="etiqueta">Alto</span>
        <NumberInput v-model="draft.heightM" :decimals="2" suffix="m" :invalid="Boolean(errors.heightM)" />
      </label>
    </div>
    <small v-if="errors.heightM" class="error">{{ errors.heightM }}</small>
    <div class="plano-y-datos">
      <RoomPlan v-if="shape === 'rectangular'" :length-m="draft.lengthM" :width-m="draft.widthM" :height-m="draft.heightM" class="plano" />
      <div class="form-grid una">
        <label class="campo">
          <span class="etiqueta">Altura del plano de trabajo</span>
          <NumberInput v-model="draft.workPlaneHeightM" :decimals="2" suffix="m" placeholder="0,80 m" />
          <small class="ayuda">Altura de mesas o pupitres; se usa en el índice del local.</small>
        </label>
      </div>
    </div>
    <CalcPanel v-if="calc.length" :items="calc" />
  </section>

  <section class="form-seccion">
    <h3 class="form-seccion-titulo"><IconUsers :size="16" />Ocupación</h3>
    <div class="form-grid">
      <label class="campo">
        <span class="etiqueta">Ocupantes</span>
        <NumberInput v-model="draft.occupants" :decimals="0" suffix="personas" />
      </label>
      <label class="campo">
        <span class="etiqueta">Horas de uso al día</span>
        <NumberInput v-model="draft.hoursPerDay" :decimals="1" :max="24" suffix="h" />
      </label>
    </div>
  </section>

  <section class="form-seccion">
    <h3 class="form-seccion-titulo"><IconBulb :size="16" />Iluminación medida</h3>
    <div class="form-grid">
      <label class="campo">
        <span class="etiqueta">Promedio</span>
        <NumberInput v-model="draft.measuredLuxAvg" :decimals="0" suffix="lux" />
      </label>
      <label class="campo">
        <span class="etiqueta">Mínimo</span>
        <NumberInput v-model="draft.measuredLuxMin" :decimals="0" suffix="lux" :invalid="Boolean(errors.measuredLuxMin)" />
      </label>
    </div>
    <small v-if="errors.measuredLuxMin" class="error">{{ errors.measuredLuxMin }}</small>
    <div v-if="lux || uniformity" class="estado-luz">
      <StatusChip v-if="lux" :tone="lux.tone" :icon="lux.icon" :label="`${lux.label} · referencia ${formatNumber(space?.lux ?? 0)} lux`" />
      <StatusChip v-if="uniformity" tone="neutral" :label="`Uniformidad ${formatPercent(uniformity, 0)}`" />
    </div>
  </section>

  <section class="form-seccion">
    <h3 class="form-seccion-titulo"><IconWindow :size="16" />Envolvente</h3>
    <div class="form-grid">
      <label class="campo">
        <span class="etiqueta">Área de ventanas</span>
        <NumberInput v-model="draft.windowAreaM2" :decimals="1" suffix="m²" />
      </label>
      <div class="campo">
        <span class="etiqueta">Orientación de las ventanas</span>
        <ChoiceChips v-model="draft.windowOrientation" :options="ORIENTATIONS" label="Orientación de las ventanas" clearable />
      </div>
    </div>
    <label class="fila-interruptor">
      <span>Techo expuesto al sol<small>Cubierta sin otro piso encima: aumenta la carga térmica.</small></span>
      <ToggleSwitch v-model="draft.roofExposed" />
    </label>
    <label class="campo">
      <span class="etiqueta">Área de techo disponible</span>
      <NumberInput v-model="draft.roofAvailableM2" :decimals="1" suffix="m²" />
      <small class="ayuda">Superficie libre y sin sombra para paneles solares.</small>
    </label>
  </section>

  <section class="form-seccion">
    <EntityPhotos :project-id="projectId" entity-type="area" :entity-id="draft.id" default-kind="vista-general" title="Fotos del espacio" />
  </section>

  <section class="form-seccion">
    <h3 class="form-seccion-titulo"><IconNotes :size="16" />Observaciones</h3>
    <Textarea v-model="draft.notes" auto-resize rows="3" placeholder="Estado de ventanas, cortinas, uso real del espacio…" />
  </section>
</template>

<style scoped>
.plano-y-datos {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 12px;
  align-items: center;
}
.plano {
  padding: 8px;
  border: 1px solid var(--border);
  border-radius: var(--radius-card);
  background: var(--surface);
}
.form-grid.una {
  grid-template-columns: minmax(0, 1fr);
}
.estado-luz {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
@media (min-width: 1024px) {
  .plano-y-datos {
    grid-template-columns: minmax(0, 1.3fr) minmax(0, 1fr);
  }
}
</style>
