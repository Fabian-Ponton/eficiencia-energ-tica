<script setup lang="ts">
import { IconCamera, IconMapPin, IconPlug, IconPlus, IconSearch } from '@tabler/icons-vue';
import { useMediaQuery } from '@vueuse/core';
import Button from 'primevue/button';
import Select from 'primevue/select';
import { computed, ref } from 'vue';
import EmptyState from '@/components/EmptyState.vue';
import EndUseBar from '@/components/EndUseBar.vue';
import FormSheet from '@/components/ui/FormSheet.vue';
import PageHeader from '@/components/ui/PageHeader.vue';
import StatusChip from '@/components/ui/StatusChip.vue';
import { useCurrentProject } from '@/composables/useCurrentProject';
import { useFabAction } from '@/composables/useFab';
import { usePhotoCounts, useProjectRecords } from '@/composables/useProjectRecords';
import { useQuickAdd } from '@/composables/useQuickAdd';
import { useRecordEditor } from '@/composables/useRecordEditor';
import { useTheme } from '@/composables/useTheme';
import { installedPowerKw, monthlyEnergyKwh } from '@/domain/calc/equipment';
import { daysPerMonth, END_USES, LAMP_TYPES } from '@/domain/catalogs';
import type { EndUseCategory, Equipment } from '@/domain/types';
import { CONDITION_STATUS, END_USE_ICONS } from '@/ui/icons';
import { formatMillionsCop, formatNumber } from '@/utils/format';
import { incrementCode, normalizeText } from '@/utils/text';
import EquipmentForm from './EquipmentForm.vue';

const { projectId, project } = useCurrentProject();
const desktop = useMediaQuery('(min-width: 1024px)');
const { isDark } = useTheme();
const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, 'es', { numeric: true });
const { rows: equipment, ready } = useProjectRecords('equipment', byName);
const { rows: areas } = useProjectRecords('areas', byName);
const { rows: electrical } = useProjectRecords('electrical', byName);
const photoCounts = usePhotoCounts('equipo');

const search = ref('');
const category = ref<EndUseCategory | 'todas'>('todas');
const areaFilter = ref<string | null>(null);
const lastCategory = ref<EndUseCategory>('iluminacion');

const tariff = computed(() => project.value?.economics.tariffCopPerKwh ?? 0);
const areaName = computed(() => new Map(areas.value.map((a) => [a.id, a.name])));
const panels = computed(() => electrical.value.filter((n) => n.kind === 'tablero' || n.kind === 'circuito'));
const monthly = (e: Equipment) => monthlyEnergyKwh(e, e.operatingDaysPerMonth);
const colorOf = (id: EndUseCategory) => {
  const use = END_USES.find((u) => u.id === id) ?? END_USES[END_USES.length - 1];
  return isDark.value ? use.colorDark : use.color;
};
const lampLabel = (id?: string) => LAMP_TYPES.find((l) => l.id === id)?.label ?? id;

const filtered = computed(() => {
  const q = normalizeText(search.value.trim());
  return equipment.value.filter((e) => {
    if (category.value !== 'todas' && e.category !== category.value) return false;
    if (areaFilter.value === 'sin-area' && e.areaId) return false;
    if (areaFilter.value && areaFilter.value !== 'sin-area' && e.areaId !== areaFilter.value) return false;
    if (!q) return true;
    return [e.name, e.code, e.brand, e.model, e.areaId ? areaName.value.get(e.areaId) : undefined].some((t) => t && normalizeText(t).includes(q));
  });
});

const groups = computed(() =>
  END_USES.map((use) => {
    const items = filtered.value.filter((e) => e.category === use.id);
    return { use, items, kw: items.reduce((t, e) => t + installedPowerKw(e), 0), kwh: items.reduce((t, e) => t + monthly(e), 0) };
  }).filter((g) => g.items.length),
);

const totals = computed(() => ({
  count: filtered.value.reduce((t, e) => t + e.quantity, 0),
  kw: filtered.value.reduce((t, e) => t + installedPowerKw(e), 0),
  kwh: filtered.value.reduce((t, e) => t + monthly(e), 0),
}));
const endUseTotals = computed(() => {
  const result: Partial<Record<EndUseCategory, number>> = {};
  for (const e of equipment.value) result[e.category] = (result[e.category] ?? 0) + monthly(e);
  return result;
});
const categoryCounts = computed(() => {
  const counts = new Map<EndUseCategory, number>();
  for (const e of equipment.value) counts.set(e.category, (counts.get(e.category) ?? 0) + 1);
  return counts;
});
const presentUses = computed(() => END_USES.filter((use) => categoryCounts.value.get(use.id)));
const areaOptions = computed(() => [{ id: 'sin-area', name: 'Sin espacio asignado' }, ...areas.value.map((a) => ({ id: a.id, name: a.name }))]);
const filtering = computed(() => filtered.value.length !== equipment.value.length);

const stats = computed(() => [
  { label: 'Equipos', value: formatNumber(totals.value.count), unit: 'unid.' },
  { label: 'Potencia instalada', value: formatNumber(totals.value.kw, 1), unit: 'kW' },
  { label: 'Consumo estimado', value: formatNumber(totals.value.kwh), unit: 'kWh/mes' },
  tariff.value > 0
    ? { label: 'Costo estimado', value: formatMillionsCop(totals.value.kwh * tariff.value), unit: 'COP/mes' }
    : { label: 'Costo estimado', value: '—', unit: 'falta la tarifa' },
]);

const { visible, draft, isNew, errors, saving, openNew, openEdit, save, saveAndDuplicate, remove } = useRecordEditor('equipment', {
  empty: () => ({
    id: crypto.randomUUID(),
    projectId: projectId.value,
    name: '',
    category: category.value !== 'todas' ? category.value : lastCategory.value,
    areaId: areaFilter.value && areaFilter.value !== 'sin-area' ? areaFilter.value : undefined,
    powerKw: Number.NaN,
    quantity: 1,
    hoursPerDay: Number.NaN,
    operatingDaysPerMonth: daysPerMonth(project.value?.calendar.daysPerWeek ?? 5),
    useFactor: 1,
    condition: 'bueno',
  }),
  validate: (d) => ({
    name: d.name.trim() ? undefined : 'Escribe el nombre del equipo.',
    powerKw: d.powerKw > 0 ? undefined : 'Indica la potencia de una unidad.',
    quantity: Number.isInteger(d.quantity) && d.quantity >= 1 ? undefined : 'La cantidad debe ser un número entero desde 1.',
    hoursPerDay: d.hoursPerDay >= 0 && d.hoursPerDay <= 24 ? undefined : 'Indica las horas de uso al día (de 0 a 24).',
    operatingDaysPerMonth: d.operatingDaysPerMonth >= 0 && d.operatingDaysPerMonth <= 31 ? undefined : 'Los días de uso van de 0 a 31.',
    useFactor: d.useFactor >= 0 && d.useFactor <= 1 ? undefined : 'El factor de uso va de 0 a 100 %.',
  }),
  describe: (d) => d.name || 'Equipo',
  photoEntity: 'equipo',
  prepare: (d) => {
    lastCategory.value = d.category;
    return d;
  },
  duplicate: (d) => ({ ...d, code: incrementCode(d.code) }),
});

useFabAction({ label: 'Agregar equipo', icon: IconPlus, run: () => openNew() });
useQuickAdd(() => openNew());
</script>

<template>
  <div class="vista">
    <PageHeader step="inventario" :stats="equipment.length ? stats : undefined">
      <template v-if="desktop" #actions>
        <Button label="Agregar equipo" @click="openNew()">
          <template #icon><IconPlus :size="18" stroke="2.2" /></template>
        </Button>
      </template>
    </PageHeader>

    <template v-if="equipment.length">
      <section class="card usos">
        <div class="usos-cabecera">
          <h2>Consumo por uso final</h2>
          <span class="eyebrow">kWh/mes estimados</span>
        </div>
        <EndUseBar :totals="endUseTotals" />
      </section>

      <div class="filtros">
        <label class="buscador card">
          <IconSearch :size="18" />
          <span class="sr-only">Buscar equipos</span>
          <input v-model="search" type="search" placeholder="Buscar por nombre, código, marca o espacio" />
        </label>
        <Select v-model="areaFilter" :options="areaOptions" option-label="name" option-value="id" placeholder="Todos los espacios" show-clear class="filtro-area" />
      </div>
      <div class="categorias" role="tablist" aria-label="Filtrar por uso final">
        <button type="button" role="tab" class="categoria" :class="{ activa: category === 'todas' }" :aria-selected="category === 'todas'" @click="category = 'todas'">
          Todos · {{ equipment.length }}
        </button>
        <button
          v-for="use in presentUses"
          :key="use.id"
          type="button"
          role="tab"
          class="categoria"
          :class="{ activa: category === use.id }"
          :aria-selected="category === use.id"
          @click="category = use.id"
        >
          <span class="punto" :style="{ background: colorOf(use.id) }" />{{ use.label }} · {{ categoryCounts.get(use.id) }}
        </button>
      </div>

      <div v-if="desktop && groups.length" class="card tabla-contenedor">
        <table class="tabla">
          <thead>
            <tr>
              <th>Equipo</th>
              <th class="der">Cant.</th>
              <th class="der">Unidad <small>kW</small></th>
              <th class="der">Instalada <small>kW</small></th>
              <th class="der">Uso</th>
              <th class="der">F. uso</th>
              <th class="der">Energía <small>kWh/mes</small></th>
              <th>Estado</th>
              <th class="der">Fotos</th>
            </tr>
          </thead>
          <tbody v-for="group in groups" :key="group.use.id">
            <tr class="fila-grupo">
              <td colspan="9">
                <span class="grupo">
                  <span class="icono-uso" :style="{ '--color': colorOf(group.use.id) }"><component :is="END_USE_ICONS[group.use.id]" :size="16" /></span>
                  {{ group.use.label }}
                  <span class="mono grupo-datos">{{ formatNumber(group.kw, 1) }} kW · {{ formatNumber(group.kwh) }} kWh/mes</span>
                </span>
              </td>
            </tr>
            <tr v-for="e in group.items" :key="e.id" class="fila-clic" tabindex="0" @click="openEdit(e)" @keydown.enter="openEdit(e)">
              <td>
                <div class="nombre">{{ e.name }}</div>
                <div class="sub">{{ [e.code, e.areaId ? areaName.get(e.areaId) : undefined].filter(Boolean).join(' · ') || '—' }}</div>
              </td>
              <td class="der">{{ formatNumber(e.quantity) }}</td>
              <td class="der">{{ formatNumber(e.powerKw, 3) }}</td>
              <td class="der">{{ formatNumber(installedPowerKw(e), 2) }}</td>
              <td class="der">{{ formatNumber(e.hoursPerDay, 1) }} h · {{ e.operatingDaysPerMonth }} d</td>
              <td class="der">{{ formatNumber(e.useFactor * 100) }} %</td>
              <td class="der fuerte">{{ formatNumber(monthly(e)) }}</td>
              <td><StatusChip v-bind="CONDITION_STATUS[e.condition]" /></td>
              <td class="der">{{ photoCounts.get(e.id) ?? '—' }}</td>
            </tr>
          </tbody>
          <tfoot>
            <tr>
              <td>{{ filtering ? 'Total de lo filtrado' : 'Total' }}</td>
              <td class="der">{{ formatNumber(totals.count) }}</td>
              <td />
              <td class="der">{{ formatNumber(totals.kw, 1) }}</td>
              <td />
              <td />
              <td class="der">{{ formatNumber(totals.kwh) }}</td>
              <td />
              <td />
            </tr>
          </tfoot>
        </table>
      </div>

      <div v-else-if="groups.length" class="grupos">
        <section v-for="group in groups" :key="group.use.id" class="grupo-movil">
          <header class="grupo-cabecera">
            <span class="icono-uso" :style="{ '--color': colorOf(group.use.id) }"><component :is="END_USE_ICONS[group.use.id]" :size="16" /></span>
            <h2>{{ group.use.label }}</h2>
            <span class="mono">{{ formatNumber(group.kwh) }} kWh/mes</span>
          </header>
          <TransitionGroup name="list" tag="div" class="tarjetas">
            <button v-for="e in group.items" :key="e.id" type="button" class="card equipo" @click="openEdit(e)">
              <span class="equipo-fila">
                <span class="equipo-nombre">{{ e.name }}</span>
                <span class="equipo-energia"><strong class="num">{{ formatNumber(monthly(e)) }}</strong><small>kWh/mes</small></span>
              </span>
              <span class="mono equipo-detalle">
                {{ formatNumber(e.quantity) }} × {{ formatNumber(e.powerKw, 3) }} kW · {{ formatNumber(e.hoursPerDay, 1) }} h/día · {{ e.operatingDaysPerMonth }} d/mes
              </span>
              <span class="equipo-chips">
                <StatusChip v-bind="CONDITION_STATUS[e.condition]" />
                <StatusChip v-if="e.capacityBtuH" tone="info" :label="`${formatNumber(e.capacityBtuH)} BTU/h${e.eer ? ` · EER ${formatNumber(e.eer, 1)}` : ''}`" />
                <StatusChip v-if="e.lampType" tone="neutral" :label="lampLabel(e.lampType) ?? ''" />
                <span v-if="e.areaId && areaName.get(e.areaId)" class="dato"><IconMapPin :size="14" />{{ areaName.get(e.areaId) }}</span>
                <span v-if="photoCounts.get(e.id)" class="dato"><IconCamera :size="14" />{{ photoCounts.get(e.id) }}</span>
              </span>
            </button>
          </TransitionGroup>
        </section>
      </div>

      <div v-if="!groups.length" class="card">
        <EmptyState :icon="IconSearch" title="Sin resultados" text="Prueba con otro nombre o quita los filtros." />
      </div>
    </template>

    <div v-else-if="ready" class="card">
      <EmptyState
        :icon="IconPlug"
        title="Aún no hay equipos en el censo"
        text="Registra cada equipo con su potencia, horas de uso y fotos de la placa. Con el inventario verás en qué se usa la energía."
      >
        <Button label="Agregar el primer equipo" @click="openNew()" />
      </EmptyState>
    </div>

    <FormSheet
      v-model:visible="visible"
      :title="isNew ? 'Nuevo equipo' : draft.name || 'Equipo'"
      eyebrow="Inventario"
      :saving="saving"
      :can-delete="!isNew"
      can-duplicate
      @submit="save"
      @delete="remove()"
      @duplicate="saveAndDuplicate"
    >
      <EquipmentForm :key="draft.id" v-model:draft="draft" :errors="errors" :project-id="projectId" :areas="areas" :panels="panels" :tariff="tariff" />
    </FormSheet>
  </div>
</template>

<style scoped>
.usos {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 14px 16px;
}
.usos-cabecera {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
}
.usos h2,
.grupo-cabecera h2 {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
}
.filtros {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.buscador {
  display: flex;
  flex: 1 1 260px;
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
.filtro-area {
  flex: 1 1 200px;
  height: 44px;
}
.filtro-area :deep(.p-select-label) {
  display: flex;
  align-items: center;
}
.categorias {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding-bottom: 2px;
  scrollbar-width: none;
}
.categoria {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  gap: 6px;
  height: 34px;
  padding: 0 12px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--surface);
  color: var(--ink-2);
  font-size: 13px;
  white-space: nowrap;
  cursor: pointer;
}
.categoria.activa {
  border-color: var(--navy);
  background: var(--navy);
  color: #fff;
  font-weight: 600;
}
.app-dark .categoria.activa {
  border-color: var(--accent-strong);
  background: var(--accent-strong);
}
.punto {
  width: 8px;
  height: 8px;
  border-radius: 2px;
}
.icono-uso {
  display: inline-grid;
  flex-shrink: 0;
  place-items: center;
  width: 28px;
  height: 28px;
  border-radius: 8px;
  background: color-mix(in srgb, var(--color) 16%, transparent);
  color: var(--color);
}
.grupo {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 14px;
}
.grupo-datos {
  margin-left: auto;
  color: var(--muted);
  font-size: 12px;
  font-weight: 500;
}
.nombre {
  font-weight: 600;
}
.sub {
  color: var(--muted);
  font-size: 12px;
}
.fuerte {
  font-weight: 600;
}
.grupos {
  display: flex;
  flex-direction: column;
  gap: 18px;
}
.grupo-movil {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.grupo-cabecera {
  display: flex;
  align-items: center;
  gap: 10px;
}
.grupo-cabecera .mono {
  margin-left: auto;
  color: var(--muted);
  font-size: 12px;
}
.tarjetas {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.equipo {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 12px 14px;
  color: var(--ink);
  font: inherit;
  text-align: left;
  cursor: pointer;
}
.equipo-fila {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}
.equipo-nombre {
  font-size: 15px;
  font-weight: 600;
  line-height: 1.3;
}
.equipo-energia {
  display: flex;
  flex-shrink: 0;
  flex-direction: column;
  align-items: flex-end;
  line-height: 1.1;
}
.equipo-energia strong {
  font-size: 17px;
}
.equipo-energia small {
  color: var(--muted);
  font-size: 11px;
}
.equipo-detalle {
  color: var(--ink-2);
  font-size: 12px;
}
.equipo-chips {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 10px;
}
.dato {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--muted);
  font-size: 12px;
}
</style>
