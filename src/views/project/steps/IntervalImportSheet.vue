<script setup lang="ts">
import { IconAdjustmentsHorizontal, IconAlertTriangle, IconChartBar, IconFileSpreadsheet, IconFileUpload, IconTable, IconTag } from '@tabler/icons-vue';
import { useDebounceFn } from '@vueuse/core';
import InputText from 'primevue/inputtext';
import Select from 'primevue/select';
import ToggleSwitch from 'primevue/toggleswitch';
import { useToast } from 'primevue/usetoast';
import { computed, reactive, ref, shallowRef, useId, watch } from 'vue';
import { barsChart } from '@/charts/builders';
import EChart from '@/components/charts/EChart.vue';
import CalcPanel from '@/components/ui/CalcPanel.vue';
import ChoiceChips from '@/components/ui/ChoiceChips.vue';
import FormSheet from '@/components/ui/FormSheet.vue';
import NumberInput from '@/components/ui/NumberInput.vue';
import { useLiveQuery } from '@/composables/useLiveQuery';
import { useTheme } from '@/composables/useTheme';
import { saveIntervalSeries } from '@/db/intervals';
import { getDb } from '@/db/schema';
import { getSettings, saveImportTemplate } from '@/db/settings';
import { isoDate } from '@/domain/calc/interval';
import { detectLayout, layoutToMapping, previewRows } from '@/domain/importers/detect';
import { excelToText } from '@/domain/importers/excel';
import { groupReadingsByDay, parseIntervalCsv, type IntervalCsvMapping, type IntervalCsvResult } from '@/domain/importers/intervalCsv';
import type { IntervalSeries } from '@/domain/types';
import { formatDate } from '@/utils/dates';
import { formatNumber } from '@/utils/format';

/** Importa el CSV, TXT o Excel de un analizador, data logger o medidor inteligente como una serie de intervalos. */
const visible = defineModel<boolean>('visible', { required: true });
const props = defineProps<{ projectId: string; locations: string[] }>();
const emit = defineEmits<{ imported: [series: IntervalSeries] }>();

const db = getDb();
const toast = useToast();
const { isDark } = useTheme();
const locationsId = useId();

const DELIMITERS = [
  { value: '', label: 'Automático' },
  { value: ';', label: 'Punto y coma' },
  { value: ',', label: 'Coma' },
  { value: '\t', label: 'Tabulación' },
] as const;
const DECIMALS = [
  { value: ',', label: 'Coma · 1.234,5' },
  { value: '.', label: 'Punto · 1,234.5' },
] as const;
const DATE_ORDERS = [
  { value: 'DMY', label: 'Día/mes/año' },
  { value: 'MDY', label: 'Mes/día/año' },
  { value: 'YMD', label: 'Año-mes-día' },
] as const;
const KINDS = [
  { value: 'potencia', label: 'Potencia' },
  { value: 'energia-intervalo', label: 'Energía del intervalo' },
  { value: 'energia-acumulada', label: 'Lectura acumulada' },
] as const;
const POWER_UNITS = [
  { value: 'kW', label: 'kW' },
  { value: 'W', label: 'W' },
] as const;
const ENERGY_UNITS = [
  { value: 'kWh', label: 'kWh' },
  { value: 'Wh', label: 'Wh' },
] as const;
const SOURCES = [
  { value: 'analizador', label: 'Analizador' },
  { value: 'operador', label: 'Operador de red' },
  { value: 'otro', label: 'Otro' },
] as const;

const blankMapping = (): IntervalCsvMapping => ({
  skipRows: 0,
  hasHeader: true,
  delimiter: '',
  decimal: ',',
  timestampColumn: 0,
  timeColumn: undefined,
  dateOrder: 'DMY',
  valueColumn: 1,
  valueKind: 'potencia',
  unit: 'kW',
  intervalMinutes: undefined,
});

const mapping = reactive<IntervalCsvMapping>(blankMapping());
const text = ref('');
const fileName = ref('');
const loadError = ref('');
const reading = ref(false);
const name = ref('');
const source = ref<IntervalSeries['source']>('analizador');
const location = ref('');
const wholeFacility = ref(false);
const saveTemplate = ref(false);
const templateName = ref('');
const templateId = ref<string | null>(null);
const saving = ref(false);

const templates = useLiveQuery(async () => (await getSettings(db)).importTemplates ?? [], [], []);

function reset() {
  Object.assign(mapping, blankMapping());
  text.value = '';
  fileName.value = '';
  loadError.value = '';
  name.value = '';
  source.value = 'analizador';
  location.value = '';
  wholeFacility.value = false;
  saveTemplate.value = false;
  templateName.value = '';
  templateId.value = null;
  result.value = null;
  parseError.value = '';
}
watch(visible, (open) => {
  if (open) reset();
});

/** Los equipos exportan en UTF-8 o en Windows-1252 (tildes de los títulos): se prueba en ese orden. */
async function readText(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const utf8 = new TextDecoder('utf-8').decode(buffer);
  return utf8.includes('�') ? new TextDecoder('windows-1252').decode(buffer) : utf8;
}

async function onFile(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file) return;
  reading.value = true;
  loadError.value = '';
  try {
    text.value = /\.xlsx$/i.test(file.name) ? (await excelToText(await file.arrayBuffer())).text : await readText(file);
    fileName.value = file.name;
    name.value = file.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ');
    templateId.value = null;
    const detected = detectLayout(text.value);
    if (detected) Object.assign(mapping, blankMapping(), layoutToMapping(detected));
    else loadError.value = 'No se reconocieron fechas y valores automáticamente: indica las columnas abajo.';
  } catch (error) {
    loadError.value = error instanceof Error ? error.message : String(error);
  } finally {
    reading.value = false;
  }
}

// El medidor del operador de red siempre registra toda la instalación
watch(source, (value) => {
  if (value === 'operador') wholeFacility.value = true;
});

watch(templateId, (id) => {
  const template = templates.value?.find((t) => t.id === id);
  if (!template) return;
  Object.assign(mapping, blankMapping(), template.mapping);
  source.value = template.source;
});

// Vista previa y columnas, según las filas saltadas y el separador elegido
const preview = computed(() => (text.value ? previewRows(text.value, mapping.delimiter ?? '', 60) : { rows: [] as string[][], delimiter: '' }));
const bodyRows = computed(() => preview.value.rows.slice(mapping.skipRows ?? 0));
const columns = computed(() => {
  const head = mapping.hasHeader === false ? [] : (bodyRows.value[0] ?? []);
  const width = Math.max(0, ...bodyRows.value.slice(0, 20).map((r) => r.length));
  return Array.from({ length: width }, (_, i) => ({ value: i, label: head[i]?.trim() || `Columna ${i + 1}` }));
});
const sample = computed(() =>
  bodyRows.value
    .slice(mapping.hasHeader === false ? 0 : 1)
    .filter((r) => r.some((c) => c.trim()))
    .slice(0, 6),
);
const colClass = (i: number) => ({
  'col-fecha': i === mapping.timestampColumn,
  'col-hora': i === mapping.timeColumn,
  'col-valor': i === mapping.valueColumn,
});

const hasHeader = computed({
  get: () => mapping.hasHeader !== false,
  set: (value: boolean) => {
    mapping.hasHeader = value;
  },
});
const timeColumn = computed({
  get: () => (typeof mapping.timeColumn === 'number' ? mapping.timeColumn : -1),
  set: (value: number) => {
    mapping.timeColumn = value < 0 ? undefined : value;
  },
});
const timeOptions = computed(() => [{ value: -1, label: 'Viene con la fecha' }, ...columns.value]);
const unitOptions = computed(() => (mapping.valueKind === 'potencia' ? POWER_UNITS : ENERGY_UNITS));
watch(
  () => mapping.valueKind,
  (kind) => {
    const energy = kind !== 'potencia';
    if (energy !== mapping.unit.endsWith('h')) mapping.unit = energy ? 'kWh' : 'kW';
  },
);
const autoInterval = computed({
  get: () => mapping.intervalMinutes === undefined,
  set: (auto: boolean) => {
    mapping.intervalMinutes = auto ? undefined : (result.value?.intervalMinutes ?? 15);
  },
});

// Lectura completa con la configuración actual, cada vez que cambia algo
const result = shallowRef<IntervalCsvResult | null>(null);
const parseError = ref('');
const parse = useDebounceFn(() => {
  if (!text.value) return;
  try {
    const parsed = parseIntervalCsv(text.value, { ...mapping });
    result.value = parsed;
    parseError.value = parsed.readings.length ? '' : 'Ninguna fila tiene una fecha y un valor válidos con esta configuración.';
  } catch (error) {
    result.value = null;
    parseError.value = error instanceof Error ? error.message : String(error);
  }
}, 250);
watch([text, mapping], () => void parse(), { deep: true });

const days = computed(() => (result.value ? groupReadingsByDay(result.value.readings, result.value.intervalMinutes) : []));
const dayEnergy = (values: readonly number[], minutes: number) => values.reduce((total, kw) => (Number.isFinite(kw) ? total + (kw * minutes) / 60 : total), 0);
const summary = computed(() => {
  const r = result.value;
  if (!r?.readings.length) return null;
  const hours = r.intervalMinutes / 60;
  let peak = 0;
  let energy = 0;
  for (const x of r.readings) {
    peak = Math.max(peak, x.kw);
    energy += x.kw * hours;
  }
  return { readings: r.readings.length, days: days.value.length, first: isoDate(r.readings[0].start), last: isoDate(r.readings[r.readings.length - 1].start), peak, energy, interval: r.intervalMinutes };
});
const calcItems = computed(() => {
  const s = summary.value;
  if (!s) return [];
  return [
    { label: 'Registros', value: formatNumber(s.readings) },
    { label: 'Días', value: formatNumber(s.days) },
    { label: 'Intervalo', value: formatNumber(s.interval), unit: 'min' },
    { label: 'Demanda máxima', value: formatNumber(s.peak, 1), unit: 'kW', strong: true },
    { label: 'Energía', value: formatNumber(s.energy), unit: 'kWh' },
  ];
});
const chartOption = computed(() =>
  days.value.length && result.value
    ? barsChart({
        labels: days.value.map((d) => d.date.slice(5).split('-').reverse().join('/')),
        series: [{ name: 'Energía del día', values: days.value.map((d) => Math.round(dayEnergy(d.values, result.value?.intervalMinutes ?? 15))) }],
        unit: 'kWh',
        dark: isDark.value,
      })
    : null,
);
const submitLabel = computed(() => (summary.value ? `Importar ${summary.value.days} ${summary.value.days === 1 ? 'día' : 'días'}` : 'Importar'));

async function importFile() {
  const r = result.value;
  if (!r?.readings.length) {
    toast.add({ severity: 'warn', summary: 'Nada que importar', detail: parseError.value || 'Elige un archivo con fechas y valores.', life: 4000 });
    return;
  }
  if (saveTemplate.value && !templateName.value.trim()) {
    toast.add({ severity: 'warn', summary: 'Falta el nombre de la plantilla', life: 3500 });
    return;
  }
  saving.value = true;
  try {
    const series = await saveIntervalSeries(
      db,
      {
        id: crypto.randomUUID(),
        projectId: props.projectId,
        name: name.value.trim() || fileName.value,
        source: source.value,
        intervalMinutes: r.intervalMinutes,
        location: location.value.trim() || undefined,
        fileName: fileName.value,
        wholeFacility: wholeFacility.value,
        mapping: { ...mapping },
      },
      days.value,
    );
    if (saveTemplate.value) await saveImportTemplate(db, { name: templateName.value, source: source.value, mapping: { ...mapping } });
    toast.add({ severity: 'success', summary: 'Archivo importado', detail: `${series.dayCount} días · ${formatNumber(series.energyKwh ?? 0)} kWh`, life: 4000 });
    emit('imported', series);
    visible.value = false;
  } catch (error) {
    toast.add({ severity: 'error', summary: 'No se pudo importar', detail: error instanceof Error ? error.message : String(error), life: 6000 });
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <FormSheet v-model:visible="visible" title="Importar archivo de intervalos" eyebrow="Mediciones · analizador" :submit-label="submitLabel" :saving="saving" @submit="importFile">
    <section class="form-seccion">
      <h3 class="form-seccion-titulo"><IconFileUpload :size="16" />Archivo</h3>
      <label class="archivo" :class="{ cargado: fileName }">
        <input type="file" accept=".csv,.txt,.xlsx,text/csv,text/plain,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" class="sr-only" @change="onFile" />
        <IconFileSpreadsheet :size="28" />
        <span class="archivo-texto">
          <strong>{{ reading ? 'Leyendo…' : fileName || 'Elegir archivo CSV, TXT o Excel' }}</strong>
          <small>{{ fileName ? 'Toca para elegir otro' : 'Del analizador de redes, el data logger o el medidor inteligente' }}</small>
        </span>
      </label>
      <label v-if="templates?.length" class="campo">
        <span class="etiqueta">Plantilla guardada</span>
        <Select v-model="templateId" :options="templates" option-label="name" option-value="id" placeholder="Leer como una plantilla" show-clear />
      </label>
      <p v-if="loadError" class="aviso-linea alerta"><IconAlertTriangle :size="16" />{{ loadError }}</p>
    </section>

    <template v-if="text">
      <section class="form-seccion">
        <h3 class="form-seccion-titulo"><IconTable :size="16" />Vista previa</h3>
        <div class="previa">
          <table>
            <thead v-if="hasHeader">
              <tr>
                <th v-for="c in columns" :key="c.value" :class="colClass(c.value)">{{ c.label }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(row, i) in sample" :key="i">
                <td v-for="c in columns" :key="c.value" :class="colClass(c.value)">{{ row[c.value] ?? '' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <small class="ayuda leyenda-previa"><span class="muestra fecha" />Fecha <span class="muestra hora" />Hora <span class="muestra valor" />Valor</small>
      </section>

      <section class="form-seccion">
        <h3 class="form-seccion-titulo"><IconAdjustmentsHorizontal :size="16" />Cómo leer el archivo</h3>
        <div class="form-grid">
          <label class="campo">
            <span class="etiqueta">Filas a saltar</span>
            <NumberInput v-model="mapping.skipRows" :decimals="0" :max="500" />
          </label>
          <label class="fila-interruptor">
            <span>Fila de títulos</span>
            <ToggleSwitch v-model="hasHeader" />
          </label>
          <div class="campo completo">
            <span class="etiqueta">Separador de columnas</span>
            <ChoiceChips v-model="mapping.delimiter" :options="DELIMITERS" label="Separador de columnas" />
          </div>
          <div class="campo completo">
            <span class="etiqueta">Decimales</span>
            <ChoiceChips v-model="mapping.decimal" :options="DECIMALS" label="Separador decimal" fill />
          </div>
          <label class="campo">
            <span class="etiqueta">Columna de fecha</span>
            <Select v-model="mapping.timestampColumn" :options="columns" option-label="label" option-value="value" />
          </label>
          <label class="campo">
            <span class="etiqueta">Columna de hora</span>
            <Select v-model="timeColumn" :options="timeOptions" option-label="label" option-value="value" />
          </label>
          <div class="campo completo">
            <span class="etiqueta">Orden de la fecha</span>
            <ChoiceChips v-model="mapping.dateOrder" :options="DATE_ORDERS" label="Orden de la fecha" fill />
          </div>
          <label class="campo completo">
            <span class="etiqueta">Columna del valor</span>
            <Select v-model="mapping.valueColumn" :options="columns" option-label="label" option-value="value" />
          </label>
          <div class="campo completo">
            <span class="etiqueta">El valor es</span>
            <ChoiceChips v-model="mapping.valueKind" :options="KINDS" label="Tipo de valor" />
          </div>
          <div class="campo">
            <span class="etiqueta">Unidad</span>
            <ChoiceChips v-model="mapping.unit" :options="unitOptions" label="Unidad del valor" fill />
          </div>
          <div class="campo">
            <span class="etiqueta">Intervalo de registro</span>
            <label class="fila-interruptor compacta">
              <span>Detectarlo</span>
              <ToggleSwitch v-model="autoInterval" />
            </label>
            <NumberInput v-if="!autoInterval" v-model="mapping.intervalMinutes" :decimals="0" :min="1" :max="1440" suffix="min" />
          </div>
        </div>
      </section>

      <section class="form-seccion">
        <h3 class="form-seccion-titulo"><IconChartBar :size="16" />Resultado</h3>
        <p v-if="parseError" class="aviso-linea alerta"><IconAlertTriangle :size="16" />{{ parseError }}</p>
        <template v-else-if="summary">
          <CalcPanel title="Lectura del archivo" :items="calcItems" :note="`Del ${formatDate(summary.first)} al ${formatDate(summary.last)}`" />
          <EChart v-if="chartOption" :option="chartOption" label="Energía de cada día del archivo" height="170px" />
          <ul v-if="result?.warnings.length" class="avisos">
            <li v-for="w in result.warnings" :key="w" class="aviso-linea alerta"><IconAlertTriangle :size="16" />{{ w }}</li>
          </ul>
        </template>
      </section>

      <section class="form-seccion">
        <h3 class="form-seccion-titulo"><IconTag :size="16" />Serie</h3>
        <div class="form-grid">
          <label class="campo completo">
            <span class="etiqueta">Nombre</span>
            <InputText v-model="name" placeholder="Ej.: Analizador · TGD" />
          </label>
          <div class="campo completo">
            <span class="etiqueta">Origen</span>
            <ChoiceChips v-model="source" :options="SOURCES" label="Origen de los datos" fill />
          </div>
          <label class="campo completo">
            <span class="etiqueta">Punto de medición</span>
            <InputText v-model="location" :list="locationsId" placeholder="Ej.: TGD · Tablero general" />
          </label>
        </div>
        <datalist :id="locationsId">
          <option v-for="l in locations" :key="l" :value="l" />
        </datalist>
        <label class="fila-interruptor">
          <span>Mide toda la instalación<small>Acometida, tablero general o medidor del operador. Así se compara con el inventario y la factura.</small></span>
          <ToggleSwitch v-model="wholeFacility" />
        </label>
        <label class="fila-interruptor">
          <span>Guardar como plantilla<small>Para leer igual los próximos archivos de este equipo.</small></span>
          <ToggleSwitch v-model="saveTemplate" />
        </label>
        <label v-if="saveTemplate" class="campo">
          <span class="etiqueta">Nombre de la plantilla</span>
          <InputText v-model="templateName" placeholder="Ej.: Analizador trifásico · exportación CSV" />
        </label>
      </section>
    </template>
  </FormSheet>
</template>

<style scoped>
.archivo {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px;
  border: 1.5px dashed var(--field-border);
  border-radius: var(--radius-card);
  background: var(--surface-2);
  color: var(--accent-strong);
  cursor: pointer;
}
.app-dark .archivo {
  color: var(--accent);
}
.archivo.cargado {
  border-style: solid;
  border-color: var(--accent);
  background: var(--accent-wash);
}
.archivo:focus-within {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
.archivo-texto {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  color: var(--ink);
}
.archivo-texto strong {
  overflow: hidden;
  font-size: 14px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.archivo-texto small {
  color: var(--muted);
  font-size: 12px;
}
.previa {
  max-width: 100%;
  overflow-x: auto;
  border: 1px solid var(--border);
  border-radius: var(--radius);
}
.previa table {
  border-collapse: collapse;
  font-family: var(--font-mono);
  font-size: 11.5px;
  white-space: nowrap;
}
.previa th,
.previa td {
  padding: 6px 10px;
  border-bottom: 1px solid var(--divider);
  text-align: left;
}
.previa th {
  background: var(--surface-2);
  color: var(--muted);
  font-weight: 500;
}
.col-fecha {
  background: color-mix(in srgb, #2a78d6 12%, transparent) !important;
}
.col-hora {
  background: color-mix(in srgb, #eda100 14%, transparent) !important;
}
.col-valor {
  background: color-mix(in srgb, #22a056 16%, transparent) !important;
  font-weight: 600;
}
.leyenda-previa {
  display: flex;
  align-items: center;
  gap: 6px;
}
.muestra {
  display: inline-block;
  width: 10px;
  height: 10px;
  margin-left: 6px;
  border-radius: 2px;
}
.muestra.fecha {
  background: color-mix(in srgb, #2a78d6 40%, transparent);
}
.muestra.hora {
  background: color-mix(in srgb, #eda100 45%, transparent);
}
.muestra.valor {
  background: color-mix(in srgb, #22a056 50%, transparent);
}
.fila-interruptor.compacta {
  min-height: 36px;
}
.avisos {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}
</style>
