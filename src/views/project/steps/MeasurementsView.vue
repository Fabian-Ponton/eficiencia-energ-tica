<script setup lang="ts">
import { IconAlertTriangle, IconCamera, IconCheck, IconFileSpreadsheet, IconGauge, IconPlus } from '@tabler/icons-vue';
import { useMediaQuery } from '@vueuse/core';
import Button from 'primevue/button';
import Select from 'primevue/select';
import { computed, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import MonthlyBars from '@/components/charts/MonthlyBars.vue';
import EmptyState from '@/components/EmptyState.vue';
import ChoiceChips from '@/components/ui/ChoiceChips.vue';
import FormSheet from '@/components/ui/FormSheet.vue';
import PageHeader from '@/components/ui/PageHeader.vue';
import StatusChip from '@/components/ui/StatusChip.vue';
import { useCurrentProject } from '@/composables/useCurrentProject';
import { useFabAction } from '@/composables/useFab';
import { usePhotoCounts, useProjectRecords } from '@/composables/useProjectRecords';
import { useQuickAdd } from '@/composables/useQuickAdd';
import { useRecordEditor } from '@/composables/useRecordEditor';
import { DATA_TYPES } from '@/domain/catalogs';
import { derivePower, imbalanceLevel } from '@/domain/measurements';
import type { Measurement } from '@/domain/types';
import { IMBALANCE_STATUS } from '@/ui/icons';
import { formatDate, formatDateTime, parseLocal, toLocalDateTime } from '@/utils/dates';
import { formatNumber, formatPercent } from '@/utils/format';
import MeasurementForm from './MeasurementForm.vue';
import ReadingForm from './ReadingForm.vue';

const route = useRoute();
const { projectId } = useCurrentProject();
const desktop = useMediaQuery('(min-width: 1024px)');
const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, 'es', { numeric: true });
const { rows: measurements, ready } = useProjectRecords('measurements', (a, b) => b.takenAt.localeCompare(a.takenAt));
const { rows: readings } = useProjectRecords('meterReadings', (a, b) => a.at.localeCompare(b.at));
const { rows: areas } = useProjectRecords('areas', byName);
const { rows: equipment } = useProjectRecords('equipment', byName);
const { rows: nodes } = useProjectRecords('electrical', byName);
const photoCounts = usePhotoCounts('medicion');

type Tab = 'puntuales' | 'lecturas' | 'analizador';
const initialTab = route.query.tab;
const tab = ref<Tab>(initialTab === 'lecturas' || initialTab === 'analizador' ? initialTab : 'puntuales');
// El menú rápido puede pedir otra pestaña con la pantalla ya abierta
watch(
  () => route.query.tab,
  (value) => {
    if (value === 'puntuales' || value === 'lecturas' || value === 'analizador') tab.value = value;
  },
);
const tabs = computed(() => [
  { value: 'puntuales' as const, label: `Puntuales · ${measurements.value.length}` },
  { value: 'lecturas' as const, label: `Lecturas · ${readings.value.length}` },
  { value: 'analizador' as const, label: 'Analizador' },
]);

// ——— Mediciones puntuales ———
const names = computed(() => {
  const map = new Map<string, string>();
  for (const a of areas.value) map.set(a.id, a.name);
  for (const e of equipment.value) map.set(e.id, e.name);
  for (const n of nodes.value) map.set(n.id, n.name);
  return map;
});
const POINT_KIND = { general: 'General', tablero: 'Tablero', area: 'Espacio', equipo: 'Equipo' } as const;
const pointLabel = (m: Measurement) => (m.pointType === 'general' ? 'Medición general' : (m.pointId && names.value.get(m.pointId)) || 'Punto eliminado');
const dataTypeLabel = (id: Measurement['dataType']) => DATA_TYPES.find((t) => t.id === id)?.label ?? id;
const phaseLabels = (m: Measurement) => ['L1', 'L2', 'L3'].slice(0, m.phases ?? 3);
const value = (list: (number | null)[] | undefined, i: number, decimals: number) => {
  const v = list?.[i];
  return typeof v === 'number' ? formatNumber(v, decimals) : '—';
};

const items = computed(() => measurements.value.map((m) => ({ m, d: derivePower(m) })));
const pointStats = computed(() => {
  const kws = items.value.map((i) => i.d.kw).filter((v): v is number => v !== null);
  const pfs = items.value.map((i) => i.d.pf).filter((v): v is number => v !== null);
  const imbalances = items.value.map((i) => i.d.imbalance).filter((v): v is number => v !== null);
  return [
    { label: 'Mediciones', value: formatNumber(measurements.value.length) },
    { label: 'Potencia máxima', value: kws.length ? formatNumber(Math.max(...kws), 1) : '—', unit: kws.length ? 'kW' : undefined },
    { label: 'FP más bajo', value: pfs.length ? formatNumber(Math.min(...pfs), 2) : '—' },
    { label: 'Desbalance máximo', value: imbalances.length ? formatPercent(Math.max(...imbalances), 0) : '—' },
  ];
});
const instruments = computed(() => [...new Set(measurements.value.map((m) => m.instrument).filter((i): i is string => Boolean(i)))]);

const {
  visible: measurementVisible,
  draft: measurementDraft,
  isNew: measurementIsNew,
  errors: measurementErrors,
  saving: measurementSaving,
  openNew: newMeasurement,
  openEdit: editMeasurement,
  save: saveMeasurement,
  saveAndDuplicate: duplicateMeasurement,
  remove: removeMeasurement,
} = useRecordEditor('measurements', {
  empty: () => ({
    id: crypto.randomUUID(),
    projectId: projectId.value,
    takenAt: toLocalDateTime(),
    pointType: 'general',
    phases: 3,
    voltageRef: 'LL',
    dataType: 'medido',
    instrument: measurements.value[0]?.instrument,
  }),
  validate: (d) => ({
    takenAt: d.takenAt ? undefined : 'Indica la fecha y la hora de la medición.',
    pointId: d.pointType === 'general' || d.pointId ? undefined : 'Elige el punto medido.',
    values: [d.kw, d.kva, d.kvar, d.pf, ...(d.voltageV ?? []), ...(d.currentA ?? [])].some((v) => typeof v === 'number')
      ? undefined
      : 'Registra al menos un valor medido.',
    pf: d.pf === undefined || (d.pf > 0 && d.pf <= 1) ? undefined : 'El factor de potencia va de 0 a 1.',
  }),
  describe: (d) => `${POINT_KIND[d.pointType]} · ${formatDateTime(d.takenAt)}`,
  photoEntity: 'medicion',
  // La copia sirve para medir el siguiente punto con el mismo instrumento
  duplicate: (d) => ({
    id: d.id,
    projectId: d.projectId,
    takenAt: toLocalDateTime(),
    pointType: d.pointType,
    phases: d.phases,
    voltageRef: d.voltageRef,
    instrument: d.instrument,
    dataType: d.dataType,
  }),
});

// ——— Lecturas del medidor ———
const meters = computed(() => [...new Set(readings.value.map((r) => r.meter))]);
const selectedMeter = ref<string | undefined>(undefined);
const meter = computed(() => (selectedMeter.value && meters.value.includes(selectedMeter.value) ? selectedMeter.value : meters.value[0]));
const meterReadings = computed(() => readings.value.filter((r) => r.meter === meter.value));
const time = (text: string) => parseLocal(text)?.getTime() ?? Number.NaN;

const readingRows = computed(() =>
  meterReadings.value
    .map((r, i, list) => {
      const before = list[i - 1];
      if (!before) return { r, kwh: null, days: null, perDay: null, anomaly: null };
      const days = (time(r.at) - time(before.at)) / 86_400_000;
      const kwh = r.kwh - before.kwh;
      const anomaly = days <= 0 ? 'Fecha repetida' : kwh < 0 ? 'Menor que la anterior' : null;
      return { r, kwh: anomaly ? null : kwh, days, perDay: anomaly ? null : kwh / days, anomaly };
    })
    .reverse(),
);
const periods = computed(() => [...readingRows.value].reverse().filter((row) => row.perDay !== null));
const readingStats = computed(() => {
  const total = periods.value.reduce((t, p) => t + (p.kwh ?? 0), 0);
  const days = periods.value.reduce((t, p) => t + (p.days ?? 0), 0);
  return [
    { label: 'Lecturas', value: formatNumber(meterReadings.value.length) },
    { label: 'Días cubiertos', value: formatNumber(days, 1), unit: 'días' },
    { label: 'Consumo registrado', value: formatNumber(total), unit: 'kWh' },
    { label: 'Promedio', value: days ? formatNumber(total / days) : '—', unit: days ? 'kWh/día' : undefined },
  ];
});
const shortDate = (text: string) => formatDate(text).split(' ').slice(0, 2).join(' ');

const {
  visible: readingVisible,
  draft: readingDraft,
  isNew: readingIsNew,
  errors: readingErrors,
  saving: readingSaving,
  openNew: newReading,
  openEdit: editReading,
  save: saveReading,
  remove: removeReading,
} = useRecordEditor('meterReadings', {
  empty: () => ({
    id: crypto.randomUUID(),
    projectId: projectId.value,
    meter: meter.value ?? nodes.value.find((n) => n.kind === 'medidor')?.name ?? 'Medidor principal',
    at: toLocalDateTime(),
    kwh: Number.NaN,
  }),
  validate: (d) => ({
    meter: d.meter.trim() ? undefined : 'Escribe el nombre del medidor.',
    at: d.at ? undefined : 'Indica la fecha y la hora de la lectura.',
    kwh: Number.isFinite(d.kwh) && d.kwh >= 0 ? undefined : 'Escribe la lectura del medidor en kWh.',
  }),
  describe: (d) => `Lectura del ${formatDateTime(d.at)}`,
  photoEntity: 'medicion',
});

function addForTab() {
  if (tab.value === 'lecturas') newReading();
  else {
    tab.value = 'puntuales';
    newMeasurement();
  }
}
useFabAction(() =>
  tab.value === 'lecturas' ? { label: 'Registrar lectura', icon: IconPlus, run: () => newReading() } : { label: 'Agregar medición', icon: IconPlus, run: addForTab },
);
useQuickAdd(addForTab);
</script>

<template>
  <div class="vista">
    <PageHeader step="mediciones" :stats="tab === 'lecturas' ? (readings.length ? readingStats : undefined) : tab === 'puntuales' && measurements.length ? pointStats : undefined">
      <template v-if="desktop && tab !== 'analizador'" #actions>
        <Button :label="tab === 'lecturas' ? 'Registrar lectura' : 'Agregar medición'" @click="addForTab">
          <template #icon><IconPlus :size="18" stroke="2.2" /></template>
        </Button>
      </template>
      <ChoiceChips v-model="tab" :options="tabs" label="Tipo de medición" fill />
    </PageHeader>

    <!-- Mediciones puntuales -->
    <template v-if="tab === 'puntuales'">
      <div v-if="measurements.length" class="lista">
        <button v-for="{ m, d } in items" :key="m.id" type="button" class="card medicion" @click="editMeasurement(m)">
          <span class="cabeza">
            <span class="punto">
              <span class="eyebrow">{{ POINT_KIND[m.pointType] }}</span>
              <strong>{{ pointLabel(m) }}</strong>
            </span>
            <span class="mono fecha">{{ formatDateTime(m.takenAt) }}</span>
          </span>
          <span class="cuerpo">
            <span v-if="m.voltageV || m.currentA" class="tabla-fases" :style="{ '--fases': phaseLabels(m).length }">
              <span />
              <span v-for="label in phaseLabels(m)" :key="label" class="mono titulo">{{ label }}</span>
              <span class="mono titulo">V</span>
              <span v-for="(label, i) in phaseLabels(m)" :key="`v${label}`" class="num valor">{{ value(m.voltageV, i, 0) }}</span>
              <span class="mono titulo">A</span>
              <span v-for="(label, i) in phaseLabels(m)" :key="`a${label}`" class="num valor">{{ value(m.currentA, i, 1) }}</span>
            </span>
            <span class="potencias">
              <span v-if="d.kw !== null"><strong class="num">{{ formatNumber(d.kw, 1) }}</strong> kW<span v-if="d.calculated.kw" class="etiqueta-calc">calc.</span></span>
              <span v-if="d.pf !== null">FP <strong class="num">{{ formatNumber(d.pf, 2) }}</strong><span v-if="d.calculated.pf" class="etiqueta-calc">calc.</span></span>
              <span v-if="d.kva !== null"><strong class="num">{{ formatNumber(d.kva, 1) }}</strong> kVA<span v-if="d.calculated.kva" class="etiqueta-calc">calc.</span></span>
            </span>
          </span>
          <span class="chips">
            <StatusChip tone="neutral" :label="dataTypeLabel(m.dataType)" />
            <StatusChip v-if="d.imbalance !== null" v-bind="IMBALANCE_STATUS[imbalanceLevel(d.imbalance)]" :label="`${IMBALANCE_STATUS[imbalanceLevel(d.imbalance)].label} · ${formatPercent(d.imbalance, 0)}`" />
            <StatusChip v-if="m.thdI !== undefined" tone="neutral" :label="`THD I ${formatNumber(m.thdI, 1)} %`" />
            <span v-if="m.instrument" class="dato">{{ m.instrument }}</span>
            <span v-if="photoCounts.get(m.id)" class="dato"><IconCamera :size="14" />{{ photoCounts.get(m.id) }}</span>
          </span>
        </button>
      </div>
      <div v-else-if="ready" class="card">
        <EmptyState :icon="IconGauge" title="Sin mediciones puntuales" text="Registra tensión y corriente por fase, potencia y factor de potencia de cada tablero o equipo medido.">
          <Button label="Agregar la primera medición" @click="newMeasurement()" />
        </EmptyState>
      </div>
    </template>

    <!-- Lecturas del medidor -->
    <template v-else-if="tab === 'lecturas'">
      <template v-if="readings.length">
        <Select v-if="meters.length > 1" v-model="selectedMeter" :options="meters" placeholder="Medidor" class="selector-medidor" />
        <section v-if="periods.length" class="card grafica">
          <div class="grafica-cabecera">
            <h2>Consumo diario entre lecturas</h2>
            <span class="eyebrow">kWh/día · {{ meter }}</span>
          </div>
          <MonthlyBars :labels="periods.map((p) => shortDate(p.r.at))" :values="periods.map((p) => Math.round(p.perDay ?? 0))" unit="kWh/día" title="Consumo diario entre lecturas" />
        </section>
        <div v-if="desktop" class="card tabla-contenedor">
          <table class="tabla">
            <thead>
              <tr>
                <th>Fecha y hora</th>
                <th class="der">Lectura <small>kWh</small></th>
                <th class="der">Consumo <small>kWh</small></th>
                <th class="der">Días</th>
                <th class="der">Promedio <small>kWh/día</small></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in readingRows" :key="row.r.id" class="fila-clic" tabindex="0" @click="editReading(row.r)" @keydown.enter="editReading(row.r)">
                <td class="mono">{{ formatDateTime(row.r.at) }}</td>
                <td class="der">{{ formatNumber(row.r.kwh, 1) }}</td>
                <td class="der">
                  <StatusChip v-if="row.anomaly" tone="warning" :icon="IconAlertTriangle" :label="row.anomaly" />
                  <template v-else>{{ row.kwh === null ? '—' : formatNumber(row.kwh) }}</template>
                </td>
                <td class="der">{{ row.days === null || row.anomaly ? '—' : formatNumber(row.days, 1) }}</td>
                <td class="der">{{ row.perDay === null ? '—' : formatNumber(row.perDay) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <!-- En el celular, una fila compacta por lectura: fecha y consumo arriba, lectura y promedio abajo -->
        <ul v-else class="card filas">
          <li v-for="row in readingRows" :key="row.r.id">
            <button type="button" class="fila-boton" @click="editReading(row.r)">
              <span class="fila-principal">
                <span class="mono">{{ shortDate(row.r.at) }} · {{ row.r.at.slice(11, 16) }}</span>
                <StatusChip v-if="row.anomaly" tone="warning" :icon="IconAlertTriangle" :label="row.anomaly" />
                <strong v-else-if="row.kwh !== null" class="num">+{{ formatNumber(row.kwh) }} kWh</strong>
                <span v-else class="inicial">Lectura inicial</span>
              </span>
              <span class="fila-secundaria">
                <span class="num">{{ formatNumber(row.r.kwh, 1) }} kWh en el medidor</span>
                <span v-if="row.perDay !== null" class="num">{{ formatNumber(row.perDay) }} kWh/día</span>
              </span>
            </button>
          </li>
        </ul>
      </template>
      <div v-else-if="ready" class="card">
        <EmptyState :icon="IconGauge" title="Sin lecturas del medidor" text="Anota la lectura acumulada (kWh) a la misma hora cada día: la diferencia entre lecturas da el consumo diario.">
          <Button label="Registrar la primera lectura" @click="newReading()" />
        </EmptyState>
      </div>
    </template>

    <!-- Archivos del analizador (Fase 2) -->
    <section v-else class="card analizador">
      <span class="analizador-icono"><IconFileSpreadsheet :size="26" /></span>
      <h2>Archivos del analizador y del operador</h2>
      <p>Esta parte se construye en la fase 2 del plan. Podrás importar:</p>
      <ul>
        <li><IconCheck :size="16" />CSV o Excel del analizador de redes o del data logger.</li>
        <li><IconCheck :size="16" />Archivos del medidor inteligente del operador de red.</li>
        <li><IconCheck :size="16" />Mapeo de columnas con vista previa: separador, formato de fecha, W o kW, potencia o energía.</li>
      </ul>
      <p>Con esos datos se arman la curva de carga diaria, el mapa de calor y la demanda máxima.</p>
    </section>

    <FormSheet
      v-model:visible="measurementVisible"
      :title="measurementIsNew ? 'Nueva medición' : pointLabel(measurementDraft as Measurement)"
      eyebrow="Medición puntual"
      :saving="measurementSaving"
      :can-delete="!measurementIsNew"
      can-duplicate
      @submit="saveMeasurement"
      @delete="removeMeasurement()"
      @duplicate="duplicateMeasurement"
    >
      <MeasurementForm
        :key="measurementDraft.id"
        v-model:draft="measurementDraft"
        :errors="measurementErrors"
        :project-id="projectId"
        :areas="areas"
        :equipment="equipment"
        :nodes="nodes"
        :instruments="instruments"
      />
    </FormSheet>

    <FormSheet
      v-model:visible="readingVisible"
      :title="readingIsNew ? 'Nueva lectura' : `Lectura del ${formatDate(readingDraft.at)}`"
      eyebrow="Lecturas del medidor"
      :saving="readingSaving"
      :can-delete="!readingIsNew"
      @submit="saveReading"
      @delete="removeReading()"
    >
      <ReadingForm :key="readingDraft.id" v-model:draft="readingDraft" :errors="readingErrors" :project-id="projectId" :readings="readings" />
    </FormSheet>
  </div>
</template>

<style scoped>
.lista {
  display: grid;
  gap: 10px;
}
.medicion {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px 14px;
  color: var(--ink);
  font: inherit;
  text-align: left;
  cursor: pointer;
}
.cabeza {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}
.punto {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.punto strong {
  font-size: 15px;
  line-height: 1.3;
}
.fecha {
  flex-shrink: 0;
  color: var(--muted);
  font-size: 12px;
}
.cuerpo {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: 10px 20px;
}
.tabla-fases {
  display: grid;
  grid-template-columns: 22px repeat(var(--fases), minmax(44px, auto));
  gap: 2px 14px;
  align-items: baseline;
}
.titulo {
  color: var(--muted);
  font-size: 10.5px;
}
.valor {
  font-size: 14px;
  font-weight: 600;
  text-align: right;
}
.potencias {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 14px;
  color: var(--ink-2);
  font-size: 13px;
}
.potencias strong {
  color: var(--ink);
  font-size: 16px;
}
.chips {
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
.selector-medidor {
  align-self: flex-start;
  min-width: 220px;
}
.grafica {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 14px 16px;
}
.grafica-cabecera {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
}
.grafica h2,
.analizador h2 {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
}
.analizador {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 20px;
  color: var(--ink-2);
  font-size: 14px;
}
.analizador p {
  margin: 0;
}
.analizador-icono {
  display: grid;
  place-items: center;
  width: 52px;
  height: 52px;
  border-radius: 14px;
  background: var(--info-wash);
  color: var(--navy);
}
.app-dark .analizador-icono {
  color: var(--ink);
}
.analizador ul {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.analizador li {
  display: flex;
  align-items: flex-start;
  gap: 8px;
}
.analizador li svg {
  flex-shrink: 0;
  margin-top: 2px;
  color: var(--accent-strong);
}
@media (min-width: 1024px) {
  .lista {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
