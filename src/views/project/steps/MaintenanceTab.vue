<script setup lang="ts">
import { IconAlertTriangle, IconCircleCheck, IconCircleDashed, IconClock, IconTool } from '@tabler/icons-vue';
import Button from 'primevue/button';
import { computed, ref } from 'vue';
import EmptyState from '@/components/EmptyState.vue';
import ChoiceChips from '@/components/ui/ChoiceChips.vue';
import FormSheet from '@/components/ui/FormSheet.vue';
import StatusChip from '@/components/ui/StatusChip.vue';
import { useCurrentProject } from '@/composables/useCurrentProject';
import { useRecordEditor } from '@/composables/useRecordEditor';
import { maintenanceStatus, MAINTENANCE_TYPES, nextDue, type MaintenanceStatus } from '@/domain/maintenance';
import type { Area, Equipment, MaintenanceRecord } from '@/domain/types';
import { CONDITION_STATUS, type Tone } from '@/ui/icons';
import { formatDate } from '@/utils/dates';
import MaintenanceForm from './MaintenanceForm.vue';

const props = defineProps<{ rows: readonly MaintenanceRecord[]; equipment: readonly Equipment[]; areas: readonly Area[]; ready: boolean }>();
const { projectId } = useCurrentProject();

const STATUS: Record<MaintenanceStatus, { tone: Tone; label: string; icon: typeof IconClock; rank: number }> = {
  atrasado: { tone: 'serious', label: 'Atrasado', icon: IconAlertTriangle, rank: 0 },
  proximo: { tone: 'warning', label: 'Próximo', icon: IconClock, rank: 1 },
  'sin-plan': { tone: 'neutral', label: 'Sin frecuencia', icon: IconCircleDashed, rank: 2 },
  'sin-registro': { tone: 'neutral', label: 'Sin registro', icon: IconCircleDashed, rank: 3 },
  'al-dia': { tone: 'good', label: 'Al día', icon: IconCircleCheck, rank: 4 },
};
const FILTERS = [
  { value: 'todos', label: 'Todos' },
  { value: 'atrasado', label: 'Atrasados' },
  { value: 'proximo', label: 'Próximos' },
  { value: 'al-dia', label: 'Al día' },
] as const;
const filter = ref<(typeof FILTERS)[number]['value']>('todos');

const equipmentById = computed(() => new Map(props.equipment.map((e) => [e.id, e])));
const areaName = (id?: string) => props.areas.find((a) => a.id === id)?.name;
const typeLabel = (type: MaintenanceRecord['type']) => MAINTENANCE_TYPES.find((t) => t.id === type)?.label ?? type;

const items = computed(() =>
  props.rows
    .map((record) => ({ record, equipment: equipmentById.value.get(record.equipmentId), status: maintenanceStatus(record), due: nextDue(record) }))
    .filter((item) => filter.value === 'todos' || item.status === filter.value)
    .sort((a, b) => STATUS[a.status].rank - STATUS[b.status].rank || (a.equipment?.name ?? '').localeCompare(b.equipment?.name ?? '', 'es', { numeric: true })),
);
const withoutRecord = computed(() => props.equipment.filter((e) => !props.rows.some((r) => r.equipmentId === e.id)).length);
const equipmentLabel = (id: string) => equipmentById.value.get(id)?.name ?? 'Equipo eliminado';

const { visible, draft, isNew, errors, saving, openNew, openEdit, save, saveAndDuplicate, remove } = useRecordEditor('maintenance', {
  empty: () => ({ id: crypto.randomUUID(), projectId: projectId.value, equipmentId: '', type: 'preventivo' }),
  validate: (d) => ({ equipmentId: props.equipment.some((e) => e.id === d.equipmentId) ? undefined : 'Elige el equipo.' }),
  describe: (d) => equipmentLabel(d.equipmentId),
  photoEntity: 'mantenimiento',
});

defineExpose({ openNew: (equipmentId?: string) => openNew(equipmentId ? { equipmentId } : {}) });
</script>

<template>
  <template v-if="rows.length">
    <ChoiceChips v-model="filter" :options="FILTERS" label="Estado del mantenimiento" />
    <p v-if="withoutRecord" class="aviso-linea">
      <IconTool :size="16" />{{ withoutRecord }} {{ withoutRecord === 1 ? 'equipo no tiene' : 'equipos no tienen' }} mantenimiento registrado. Un equipo sin historial también es un dato: regístralo como «Sin mantenimiento registrado».
    </p>

    <TransitionGroup name="list" tag="div" class="tarjetas">
      <button v-for="item in items" :key="item.record.id" type="button" class="card registro" @click="openEdit(item.record)">
        <span class="fila">
          <span class="nombre">{{ equipmentLabel(item.record.equipmentId) }}</span>
          <StatusChip :tone="STATUS[item.status].tone" :icon="STATUS[item.status].icon" :label="STATUS[item.status].label" />
        </span>
        <span class="sub">{{ [areaName(item.equipment?.areaId), item.equipment?.code].filter(Boolean).join(' · ') || 'Sin espacio' }}</span>
        <span class="datos">
          <span>{{ typeLabel(item.record.type) }}</span>
          <span v-if="item.record.lastAt">Último: {{ formatDate(item.record.lastAt) }}</span>
          <span v-if="item.due">Próximo: {{ formatDate(item.due) }}</span>
          <StatusChip v-if="item.record.condition" v-bind="CONDITION_STATUS[item.record.condition]" />
        </span>
        <span v-if="item.record.failures" class="fallas">Fallas: {{ item.record.failures }}</span>
      </button>
    </TransitionGroup>
    <div v-if="!items.length" class="card">
      <EmptyState :icon="IconTool" title="Sin resultados" text="Ningún registro tiene ese estado." />
    </div>
  </template>

  <div v-else-if="ready" class="card">
    <EmptyState
      :icon="IconTool"
      title="Aún no hay mantenimientos registrados"
      text="Anota cuándo se hizo el último mantenimiento de cada equipo, con qué frecuencia y en qué condición está. Un equipo mal mantenido gasta más energía."
    >
      <Button label="Registrar el primer mantenimiento" :disabled="!equipment.length" @click="openNew()" />
      <small v-if="!equipment.length">Primero agrega los equipos en la pestaña anterior.</small>
    </EmptyState>
  </div>

  <FormSheet
    v-model:visible="visible"
    :title="isNew ? 'Nuevo mantenimiento' : equipmentLabel(draft.equipmentId)"
    eyebrow="Mantenimiento y condición"
    :saving="saving"
    :can-delete="!isNew"
    can-duplicate
    @submit="save"
    @delete="remove()"
    @duplicate="saveAndDuplicate"
  >
    <MaintenanceForm :key="draft.id" v-model:draft="draft" :errors="errors" :project-id="projectId" :equipment="equipment" :areas="areas" />
  </FormSheet>
</template>

<style scoped>
.tarjetas {
  display: grid;
  gap: 10px;
}
.registro {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px 14px;
  color: var(--ink);
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition:
    border-color 150ms var(--ease),
    box-shadow 150ms var(--ease);
}
.registro:hover {
  border-color: var(--field-border);
  box-shadow: 0 4px 16px rgba(16, 35, 75, 0.08);
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
.sub {
  color: var(--ink-2);
  font-size: 13px;
}
.datos {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 14px;
  color: var(--muted);
  font-size: 12px;
}
.fallas {
  color: var(--ink-2);
  font-size: 12px;
}
@media (min-width: 720px) {
  .tarjetas {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (min-width: 1280px) {
  .tarjetas {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}
</style>
