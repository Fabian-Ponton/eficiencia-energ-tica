<script setup lang="ts">
import { IconCamera, IconPlug, IconPlus, IconRuler2, IconSearch, IconUsers } from '@tabler/icons-vue';
import { useMediaQuery } from '@vueuse/core';
import Button from 'primevue/button';
import { computed, ref } from 'vue';
import EmptyState from '@/components/EmptyState.vue';
import RoomPlan from '@/components/diagrams/RoomPlan.vue';
import FormSheet from '@/components/ui/FormSheet.vue';
import PageHeader from '@/components/ui/PageHeader.vue';
import StatusChip from '@/components/ui/StatusChip.vue';
import { useCurrentProject } from '@/composables/useCurrentProject';
import { useFabAction } from '@/composables/useFab';
import { usePhotoCounts, useProjectRecords } from '@/composables/useProjectRecords';
import { useQuickAdd } from '@/composables/useQuickAdd';
import { useRecordEditor } from '@/composables/useRecordEditor';
import { floorAreaOf, roomIndexOf, volumeOf } from '@/domain/areas';
import { lightingStatus } from '@/domain/calc/sizing/lighting';
import { spaceTypeOf } from '@/domain/catalogs';
import type { Area } from '@/domain/types';
import { LIGHTING_STATUS } from '@/ui/icons';
import { formatNumber } from '@/utils/format';
import { incrementCode, normalizeText } from '@/utils/text';
import AreaForm from './AreaForm.vue';

const { projectId } = useCurrentProject();
const desktop = useMediaQuery('(min-width: 1024px)');
const { rows: areas, ready } = useProjectRecords('areas', (a, b) => a.name.localeCompare(b.name, 'es', { numeric: true }));
const { rows: equipment } = useProjectRecords('equipment');
const photoCounts = usePhotoCounts('area');
const search = ref('');

const equipmentByArea = computed(() => {
  const counts = new Map<string, number>();
  for (const e of equipment.value) if (e.areaId) counts.set(e.areaId, (counts.get(e.areaId) ?? 0) + e.quantity);
  return counts;
});

const visibleAreas = computed(() => {
  const q = normalizeText(search.value.trim());
  if (!q) return areas.value;
  return areas.value.filter((a) => [a.name, spaceTypeOf(a.spaceType)?.label].some((t) => t && normalizeText(t).includes(q)));
});

const sum = (values: (number | null | undefined)[]) => values.reduce<number>((total, v) => total + (v ?? 0), 0);
const stats = computed(() => [
  { label: 'Espacios', value: formatNumber(areas.value.length) },
  { label: 'Área de piso', value: formatNumber(sum(areas.value.map(floorAreaOf)), 1), unit: 'm²' },
  { label: 'Volumen', value: formatNumber(sum(areas.value.map(volumeOf))), unit: 'm³' },
  { label: 'Ocupantes', value: formatNumber(sum(areas.value.map((a) => a.occupants))), unit: 'personas' },
]);

function luxStatus(area: Area) {
  const target = spaceTypeOf(area.spaceType)?.lux;
  return target && area.measuredLuxAvg ? LIGHTING_STATUS[lightingStatus(area.measuredLuxAvg, target)] : null;
}
const dimensions = (a: Area) =>
  a.lengthM && a.widthM ? `${formatNumber(a.lengthM, 2)} × ${formatNumber(a.widthM, 2)}${a.heightM ? ` × ${formatNumber(a.heightM, 2)}` : ''} m` : 'Espacio irregular';

const positive = (value: number | undefined) => value === undefined || value > 0;
const { visible, draft, isNew, errors, saving, openNew, openEdit, save, saveAndDuplicate, remove } = useRecordEditor('areas', {
  empty: () => ({ id: crypto.randomUUID(), projectId: projectId.value, name: '', workPlaneHeightM: 0.8 }),
  validate: (d) => ({
    name: d.name.trim() ? undefined : 'Escribe el nombre del espacio.',
    lengthM: positive(d.lengthM) ? undefined : 'El largo debe ser mayor que cero.',
    widthM: positive(d.widthM) ? undefined : 'El ancho debe ser mayor que cero.',
    heightM:
      d.heightM === undefined || d.heightM > (d.workPlaneHeightM ?? 0) ? undefined : 'El alto debe ser mayor que la altura del plano de trabajo.',
    measuredLuxMin:
      d.measuredLuxMin === undefined || d.measuredLuxAvg === undefined || d.measuredLuxMin <= d.measuredLuxAvg
        ? undefined
        : 'El mínimo no puede ser mayor que el promedio.',
  }),
  describe: (d) => d.name || 'Espacio',
  photoEntity: 'area',
  duplicate: (d) => ({ ...d, name: incrementCode(d.name) ?? d.name, measuredLuxAvg: undefined, measuredLuxMin: undefined }),
});

useFabAction({ label: 'Agregar espacio', icon: IconPlus, run: () => openNew() });
useQuickAdd(() => openNew());
</script>

<template>
  <div class="vista">
    <PageHeader step="areas" :stats="areas.length ? stats : undefined">
      <template v-if="desktop" #actions>
        <Button label="Agregar espacio" @click="openNew()">
          <template #icon><IconPlus :size="18" stroke="2.2" /></template>
        </Button>
      </template>
    </PageHeader>

    <template v-if="areas.length">
      <label v-if="areas.length > 6" class="buscador card">
        <IconSearch :size="18" />
        <span class="sr-only">Buscar espacios</span>
        <input v-model="search" type="search" placeholder="Buscar por nombre o tipo de espacio" />
      </label>

      <TransitionGroup name="list" tag="div" class="rejilla">
        <button v-for="area in visibleAreas" :key="area.id" type="button" class="card espacio" @click="openEdit(area)">
          <RoomPlan compact :length-m="area.lengthM" :width-m="area.widthM" class="miniatura" />
          <span class="info">
            <span class="fila">
              <span class="nombre">{{ area.name }}</span>
              <StatusChip v-if="luxStatus(area)" v-bind="luxStatus(area)!" />
            </span>
            <span class="tipo">{{ spaceTypeOf(area.spaceType)?.label ?? 'Sin tipo' }} · {{ dimensions(area) }}</span>
            <span class="mono medidas">
              {{ floorAreaOf(area) ? `${formatNumber(floorAreaOf(area) ?? 0, 1)} m²` : 'Sin área' }}
              <template v-if="volumeOf(area)"> · {{ formatNumber(volumeOf(area) ?? 0, 1) }} m³</template>
              <template v-if="roomIndexOf(area)"> · K {{ formatNumber(roomIndexOf(area) ?? 0, 2) }}</template>
            </span>
            <span class="datos">
              <span v-if="area.occupants"><IconUsers :size="14" />{{ formatNumber(area.occupants) }}</span>
              <span v-if="equipmentByArea.get(area.id)"><IconPlug :size="14" />{{ formatNumber(equipmentByArea.get(area.id) ?? 0) }} equipos</span>
              <span v-if="photoCounts.get(area.id)"><IconCamera :size="14" />{{ photoCounts.get(area.id) }}</span>
            </span>
          </span>
        </button>
      </TransitionGroup>
      <div v-if="!visibleAreas.length" class="card">
        <EmptyState :icon="IconSearch" title="Sin resultados" text="Prueba con otro nombre o tipo de espacio." />
      </div>
    </template>

    <div v-else-if="ready" class="card">
      <EmptyState
        :icon="IconRuler2"
        title="Aún no hay espacios"
        text="Registra cada aula, oficina o laboratorio con sus dimensiones: sirven para los indicadores por m² y para verificar la iluminación y el aire acondicionado."
      >
        <Button label="Agregar el primer espacio" @click="openNew()" />
      </EmptyState>
    </div>

    <FormSheet
      v-model:visible="visible"
      :title="isNew ? 'Nuevo espacio' : draft.name || 'Espacio'"
      eyebrow="Áreas y dimensiones"
      :saving="saving"
      :can-delete="!isNew"
      can-duplicate
      @submit="save"
      @delete="remove()"
      @duplicate="saveAndDuplicate"
    >
      <AreaForm :key="draft.id" v-model:draft="draft" :errors="errors" :project-id="projectId" />
    </FormSheet>
  </div>
</template>

<style scoped>
.buscador {
  display: flex;
  align-items: center;
  gap: 10px;
  height: 44px;
  padding: 0 14px;
  color: var(--muted);
}
.buscador input {
  flex: 1;
  min-width: 0;
  border: 0;
  outline: none;
  background: transparent;
  color: var(--ink);
  font: inherit;
  font-size: 14px;
}
.rejilla {
  display: grid;
  gap: 10px;
}
.espacio {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  color: var(--ink);
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition:
    border-color 150ms var(--ease),
    box-shadow 150ms var(--ease);
}
.espacio:hover {
  border-color: var(--field-border);
  box-shadow: 0 4px 16px rgba(16, 35, 75, 0.08);
}
.miniatura {
  flex-shrink: 0;
  width: 84px;
}
.info {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}
.fila {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
}
.nombre {
  font-size: 15px;
  font-weight: 600;
  line-height: 1.3;
}
.tipo {
  color: var(--ink-2);
  font-size: 13px;
}
.medidas {
  color: var(--muted);
  font-size: 12px;
}
.datos {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 12px;
  margin-top: 2px;
  color: var(--muted);
  font-size: 12px;
}
.datos span {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
@media (min-width: 720px) {
  .rejilla {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (min-width: 1280px) {
  .rejilla {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}
</style>
