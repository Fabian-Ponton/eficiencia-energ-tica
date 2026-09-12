<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRoute } from 'vue-router';
import ChoiceChips from '@/components/ui/ChoiceChips.vue';
import PageHeader from '@/components/ui/PageHeader.vue';
import { useCurrentProject } from '@/composables/useCurrentProject';
import { useProjectRecords } from '@/composables/useProjectRecords';
import { areaCooling, areaLighting, capacityAnalysis, resolveSizing } from '@/domain/sizing';
import { formatNumber, formatPercent } from '@/utils/format';
import CapacityTab from './sizing/CapacityTab.vue';
import CoolingTab from './sizing/CoolingTab.vue';
import LightingTab from './sizing/LightingTab.vue';
import ParametersTab from './sizing/ParametersTab.vue';

const route = useRoute();
const { project } = useCurrentProject();
const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, 'es', { numeric: true });
const { rows: areas, ready } = useProjectRecords('areas', byName);
const { rows: equipment } = useProjectRecords('equipment');
const { rows: nodes, ready: nodesReady } = useProjectRecords('electrical');
const { rows: measurements } = useProjectRecords('measurements');
const { rows: bills } = useProjectRecords('bills');
const { rows: series } = useProjectRecords('intervalSeries');

const TABS = [
  { value: 'aires', label: 'Aires' },
  { value: 'iluminacion', label: 'Iluminación' },
  { value: 'capacidad', label: 'Capacidad' },
  { value: 'parametros', label: 'Parámetros' },
] as const;
type Tab = (typeof TABS)[number]['value'];
const tab = ref<Tab>(TABS.find((t) => t.value === route.query.tab)?.value ?? 'aires');

// Todo se recalcula al cambiar un espacio, un equipo, una medición o un parámetro
const params = computed(() => resolveSizing(project.value?.sizing));
const cooling = computed(() => areas.value.map((a) => areaCooling(a, equipment.value, params.value)).filter((r) => r !== null));
const lighting = computed(() => areas.value.map((a) => areaLighting(a, equipment.value, params.value)).filter((r) => r !== null));
const capacity = computed(() =>
  capacityAnalysis({
    nodes: nodes.value,
    equipment: equipment.value,
    measurements: measurements.value,
    bills: bills.value,
    series: series.value,
    areas: areas.value,
    params: params.value,
  }),
);

const stats = computed(() => {
  const withAc = cooling.value.filter((c) => c.status !== 'sin-aire');
  const withLux = lighting.value.filter((l) => l.status !== null);
  const transformer = capacity.value.checks.find((c) => c.node.kind === 'transformador');
  const facility = capacity.value.facility;
  return [
    {
      label: 'Aires adecuados',
      value: withAc.length ? `${withAc.filter((c) => c.status === 'adecuado').length} de ${withAc.length}` : '—',
      unit: withAc.length ? 'espacios' : 'sin aires asignados',
    },
    {
      label: 'Iluminación adecuada',
      value: withLux.length ? `${withLux.filter((l) => l.status === 'adecuada').length} de ${withLux.length}` : '—',
      unit: withLux.length ? 'espacios' : 'sin datos',
    },
    { label: 'Transformador', value: transformer ? formatPercent(transformer.ratio, 0) : '—', unit: transformer ? 'de su capacidad' : 'sin kVA' },
    { label: 'Demanda máxima', value: facility ? formatNumber(facility.kw, 1) : '—', unit: 'kW' },
  ];
});
</script>

<template>
  <div class="vista">
    <PageHeader step="dimensionamiento" :stats="areas.length || nodes.length ? stats : undefined">
      <ChoiceChips v-model="tab" :options="TABS" label="Tema del dimensionamiento" fill />
    </PageHeader>

    <CoolingTab v-if="tab === 'aires'" :rows="cooling" :area-count="areas.length" :params="params" :ready="ready" />
    <LightingTab v-else-if="tab === 'iluminacion'" :rows="lighting" :area-count="areas.length" :equipment="equipment" :params="params" :ready="ready" />
    <CapacityTab v-else-if="tab === 'capacidad'" :capacity="capacity" :nodes="nodes" :params="params" :ready="nodesReady" />
    <ParametersTab v-else :areas="areas" />
  </div>
</template>
