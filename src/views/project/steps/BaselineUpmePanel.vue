<script setup lang="ts">
import { IconAdjustmentsHorizontal, IconAlertTriangle, IconChartAreaLine, IconFileDescription, IconInfoCircle, IconPlus, IconReceipt, IconSparkles } from '@tabler/icons-vue';
import Button from 'primevue/button';
import Select from 'primevue/select';
import Textarea from 'primevue/textarea';
import { computed, ref, watch } from 'vue';
import { RouterLink } from 'vue-router';
import { upmeBaselineFigure } from '@/charts/upmeBaselineChart';
import EChart from '@/components/charts/EChart.vue';
import PngButton from '@/components/charts/PngButton.vue';
import EmptyState from '@/components/EmptyState.vue';
import ChoiceChips from '@/components/ui/ChoiceChips.vue';
import FormSheet from '@/components/ui/FormSheet.vue';
import StatusChip from '@/components/ui/StatusChip.vue';
import { useCurrentProject } from '@/composables/useCurrentProject';
import { useProjectRecords } from '@/composables/useProjectRecords';
import { useRecordEditor } from '@/composables/useRecordEditor';
import { useTheme } from '@/composables/useTheme';
import { updateProject } from '@/db/projects';
import { getDb } from '@/db/schema';
import { MODEL_LABEL, RECOMMENDED_MONTHS, UPME_VARIABLES, upmeVariable } from '@/domain/calc/lben';
import type { BaselineAdjustment, BaselineConfig, Bill, UpmeModelKind, UpmeVariable } from '@/domain/types';
import { baselineTotal, computeUpmeBaseline } from '@/domain/upmeBaseline';
import type { Tone } from '@/ui/icons';
import { MONTHS_LONG, MONTHS_SHORT, formatDate, periodLabel } from '@/utils/dates';
import { formatNumber, formatPercent } from '@/utils/format';
import { fileSlug } from '@/utils/text';
import BaselineAdjustmentForm from './BaselineAdjustmentForm.vue';

/**
 * Línea base de la Res. UPME 016 de 2024: el modelo (valor absoluto, cociente o estadístico), el periodo base, los datos que
 * salen de la banda de ±10 %, el potencial por mejor desempeño y los ajustes. Las decisiones del auditor se guardan en el proyecto.
 */
const props = defineProps<{ bills: readonly Bill[] }>();

const db = getDb();
const { projectId, project } = useCurrentProject();
const { isDark } = useTheme();
const { rows: adjustments } = useProjectRecords('baselineAdjustments', (a, b) => b.date.localeCompare(a.date));

const config = computed<BaselineConfig>(() => project.value?.baseline ?? {});
const baseline = computed(() => computeUpmeBaseline({ bills: props.bills, config: config.value, adjustments: adjustments.value, project: project.value ?? undefined }));

async function setConfig(patch: Partial<BaselineConfig>) {
  const next = { ...config.value, ...patch };
  const clean = Object.fromEntries(Object.entries(next).filter(([, value]) => value !== undefined && value !== '' && !(Array.isArray(value) && !value.length)));
  await updateProject(db, projectId.value, { baseline: clean as BaselineConfig });
}

// ——— Modelo y variables ———
const MODEL_SHORT: Record<UpmeModelKind, string> = { 'valor-absoluto': 'Valor absoluto', cociente: 'Cociente', estadistico: 'Estadístico' };
const modelOptions = computed(() =>
  (baseline.value?.available ?? []).map((value) => ({ value, label: MODEL_SHORT[value], icon: value === baseline.value?.recommended ? IconSparkles : undefined })),
);
const MODEL_HELP: Record<UpmeModelKind, string> = {
  'valor-absoluto': 'Solo usa el consumo mensual: el promedio de cada mes en los años del periodo base es la línea base (§7.4.1 y §7.5.1).',
  cociente: 'Divide el consumo entre una variable (personas atendidas, horas de práctica…) y promedia el cociente de cada mes (§7.4.2 y §7.5.2).',
  estadistico: 'Regresión lineal con una o más variables; se descartan las que no son significativas (probabilidad mayor a 0,05) (§7.4.3 y §7.5.3).',
};
const ratioOptions = computed(() => (baseline.value?.variablesAvailable ?? []).map((id) => ({ value: id, label: upmeVariable(id).label })));

function toggleCandidate(id: UpmeVariable) {
  const current = new Set(baseline.value?.candidates.length ? baseline.value.candidates : (baseline.value?.variablesAvailable ?? []));
  if (current.has(id)) current.delete(id);
  else current.add(id);
  setConfig({ variables: UPME_VARIABLES.map((v) => v.id).filter((v) => current.has(v)) });
}

// ——— Periodo base ———
const allPeriods = computed(() => [...props.bills].map((b) => b.period).sort());
const periodOptions = computed(() => allPeriods.value.map((value) => ({ value, label: periodLabel(value) })));
const note = ref('');
watch(
  () => config.value.note,
  (value) => (note.value = value ?? ''),
  { immediate: true },
);
const years = computed(() => {
  const months = baseline.value?.months ?? 0;
  return months >= 12 ? `${formatNumber(months / 12, months % 12 ? 1 : 0)} ${months === 12 ? 'año' : 'años'}` : `${months} meses`;
});
const short = computed(() => (baseline.value?.months ?? 0) < RECOMMENDED_MONTHS);

// ——— Cifras, gráfica y tablas ———
const figure = computed(() => (baseline.value ? upmeBaselineFigure(baseline.value, isDark.value) : null));
/** Algún mes tiene diez o más datos y se verificó con dos desviaciones estándar en vez de ±10 %. */
const deviationBand = computed(() => baseline.value?.monthly?.months.some((m) => m.band === 'desviacion') ?? false);
const pngName = computed(() => `${fileSlug(project.value?.name ?? 'proyecto')}_linea-base-upme`);
const tiles = computed(() => {
  const b = baseline.value;
  if (!b) return [];
  const h = b.headline;
  const items = [
    { label: 'LBEn anual', value: h.baselineKwhYear !== null ? formatNumber(baselineTotal(b) ?? 0) : '—', unit: 'kWh/año' },
    { label: 'Ahorro por mejor desempeño', value: h.savingPct !== null ? formatPercent(h.savingPct, 1) : '—', unit: h.savingKwhYear !== null ? `${formatNumber(h.savingKwhYear)} kWh/año` : 'sin calcular' },
    { label: 'Datos del periodo base', value: b.statistical ? String(b.statistical.rows.length) : `${b.monthly?.finalCount ?? 0} de ${b.monthly?.initialCount ?? 0}`, unit: b.statistical ? 'meses' : 'usados de los iniciales' },
  ];
  if (b.statistical) items.push({ label: 'R² del modelo', value: formatNumber(b.statistical.model.r2, 2), unit: `error medio ${formatPercent(b.statistical.meanErrorPct, 1)}` });
  return items;
});
const TONE: Record<'info' | 'warning' | 'serious', Tone> = { info: 'info', warning: 'warning', serious: 'serious' };
const mono = (value: number | null, decimals = 0) => (value === null ? '—' : formatNumber(value, decimals));
const decimals = computed(() => (baseline.value?.ratio ? 2 : 0));
const yearsOf = computed(() => [...new Set((baseline.value?.monthly?.months ?? []).flatMap((m) => m.data.map((d) => d.year)))].sort((a, b) => a - b));
const valueOf = (month: number, year: number) => baseline.value?.monthly?.months[month].data.find((d) => d.year === year);
const pText = (p: number) => (p < 0.0001 ? '< 0,0001' : formatNumber(p, 4));
const coefficientRows = computed(() => {
  const s = baseline.value?.statistical;
  if (!s) return [];
  return s.model.coefficients.map((coefficient, i) => ({
    name: i === 0 ? 'Intercepción' : upmeVariable(s.variables[i - 1]).label,
    coefficient,
    error: s.model.standardErrors[i],
    t: s.model.tValues[i],
    p: s.model.pValues[i],
    unit: i === 0 ? 'kWh/mes' : `kWh/mes por ${upmeVariable(s.variables[i - 1]).unit}`,
  }));
});
const equation = computed(() => {
  const s = baseline.value?.statistical;
  if (!s) return '';
  const [b0, ...rest] = s.model.coefficients;
  const terms = rest.map((b, i) => `${b < 0 ? '−' : '+'} ${formatNumber(Math.abs(b), 2)} × ${upmeVariable(s.variables[i]).label.toLowerCase()}`);
  return `kWh/mes = ${formatNumber(b0)} ${terms.join(' ')}`.trim();
});

// ——— Ajustes ———
const KIND_LABEL: Record<BaselineAdjustment['kind'], string> = { rutinario: 'Rutinario', 'no-rutinario': 'No rutinario', actualizacion: 'Actualización' };
const adjustmentSeries = computed(() => {
  const b = baseline.value;
  if (!b) return [];
  if (b.ratio) return b.points.filter((p) => (p.variables[b.ratio!.variable] ?? 0) > 0).map((p) => ({ period: p.period, value: p.kwh / (p.variables[b.ratio!.variable] as number) }));
  return b.points.map((p) => ({ period: p.period, value: p.kwh }));
});
const { visible, draft, isNew, errors, saving, openNew, openEdit, save, remove } = useRecordEditor('baselineAdjustments', {
  empty: () => ({ id: crypto.randomUUID(), projectId: projectId.value, carrier: 'electricidad', kind: 'no-rutinario', date: new Date().toISOString().slice(0, 10), cause: '', months: [] }),
  validate: (d) => ({
    cause: d.cause.trim() ? undefined : 'Escribe la causa del ajuste.',
    months: d.kind === 'no-rutinario' && d.applied && !d.months?.length ? 'Elige los meses que se corrigen.' : undefined,
  }),
  describe: (d) => d.cause || 'Ajuste',
});
const monthsText = (months?: string[]) => {
  if (!months?.length) return 'sin meses';
  const sorted = [...months].sort();
  return sorted.length === 1 ? periodLabel(sorted[0]) : `${sorted.length} meses · ${periodLabel(sorted[0])} a ${periodLabel(sorted[sorted.length - 1])}`;
};
</script>

<template>
  <div class="panel-upme">
    <section class="card seccion">
      <div class="cabecera-seccion">
        <h2><IconChartAreaLine :size="18" />Línea base UPME 016</h2>
        <span class="eyebrow">Res. UPME 016 de 2024 · promedio del mismo mes · banda de ±10 %{{ deviationBand ? ' o dos desviaciones estándar' : '' }}</span>
        <PngButton v-if="figure" :option="() => (baseline ? (upmeBaselineFigure(baseline, false)?.option ?? null) : null)" :name="pngName" />
      </div>

      <template v-if="baseline">
        <div class="campo">
          <span class="etiqueta">Modelo de la línea base</span>
          <ChoiceChips :model-value="baseline.kind" :options="modelOptions" label="Modelo de la línea base" @update:model-value="(kind) => setConfig({ model: kind })" />
          <small class="ayuda">
            {{ MODEL_HELP[baseline.kind] }}
            <template v-if="baseline.kind !== baseline.recommended">
              La app recomienda <strong>{{ MODEL_SHORT[baseline.recommended].toLowerCase() }}</strong> con los datos que hay.
            </template>
            <template v-else>Es el que recomienda la resolución con los datos que hay (<IconSparkles :size="12" />).</template>
          </small>
        </div>

        <div v-if="baseline.kind === 'cociente'" class="campo">
          <span class="etiqueta">Variable relevante</span>
          <ChoiceChips :model-value="baseline.ratioVariable" :options="ratioOptions" label="Variable del cociente" @update:model-value="(v) => setConfig({ ratioVariable: v })" />
          <small class="ayuda">El cociente se expresa en {{ baseline.ratio?.ratioUnit }}.</small>
        </div>

        <div v-if="baseline.kind === 'estadistico'" class="campo">
          <span class="etiqueta">Variables candidatas</span>
          <div class="chips-variables" role="group" aria-label="Variables candidatas de la regresión">
            <button
              v-for="id in baseline.variablesAvailable"
              :key="id"
              type="button"
              class="variable"
              :class="{ activa: baseline.candidates.includes(id) }"
              :aria-pressed="baseline.candidates.includes(id)"
              @click="toggleCandidate(id)"
            >
              {{ upmeVariable(id).label }}
            </button>
          </div>
          <small class="ayuda">La regresión descarta sola las que no son significativas.</small>
        </div>

        <div class="periodo">
          <label class="campo">
            <span class="etiqueta">Periodo base desde</span>
            <Select :model-value="config.from ?? allPeriods[0]" :options="periodOptions" option-label="label" option-value="value" @update:model-value="(v: string) => setConfig({ from: v === allPeriods[0] ? undefined : v })" />
          </label>
          <label class="campo">
            <span class="etiqueta">hasta</span>
            <Select
              :model-value="config.to ?? allPeriods[allPeriods.length - 1]"
              :options="periodOptions"
              option-label="label"
              option-value="value"
              @update:model-value="(v: string) => setConfig({ to: v === allPeriods[allPeriods.length - 1] ? undefined : v })"
            />
          </label>
          <p class="duracion"><strong>{{ baseline.months }}</strong> meses · {{ years }}</p>
        </div>
        <label v-if="short || config.note" class="campo">
          <span class="etiqueta">Justificación del periodo base</span>
          <Textarea v-model="note" auto-resize rows="2" placeholder="Ej.: el medidor se cambió en enero de 2024 y no hay facturas anteriores comparables" @blur="setConfig({ note: note.trim() || undefined })" />
          <small class="ayuda">La resolución recomienda tres años de facturas mensuales; con menos, explica por qué.</small>
        </label>
        <label class="conservar">
          <input type="checkbox" :checked="Boolean(config.keepOutliers)" @change="(e) => setConfig({ keepOutliers: (e.target as HTMLInputElement).checked || undefined })" />
          <span>Conservar los datos que salen de la banda de {{ deviationBand ? 'verificación' : '±10 %' }} <small>(por omisión se eliminan, §7.5.1)</small></span>
        </label>

        <div class="cifras">
          <div v-for="tile in tiles" :key="tile.label" class="cifra">
            <span class="eyebrow">{{ tile.label }}</span>
            <strong class="num">{{ tile.value }}</strong>
            <span class="unidad">{{ tile.unit }}</span>
          </div>
        </div>

        <ul v-if="baseline.warnings.length" class="avisos">
          <li v-for="(w, i) in baseline.warnings" :key="i">
            <StatusChip :tone="TONE[w.tone]" :icon="w.tone === 'info' ? IconInfoCircle : IconAlertTriangle" :label="w.tone === 'info' ? 'Nota' : w.tone === 'warning' ? 'Revisar' : 'Atención'" />
            <span>{{ w.text }}</span>
          </li>
        </ul>

        <EChart v-if="figure" :option="figure.option" :label="figure.title" height="300px" />
        <p v-if="figure" class="nota"><IconInfoCircle :size="15" /><span>{{ figure.source }}</span></p>

        <!-- Valor absoluto y cociente: la tabla mensual de los anexos -->
        <div v-if="baseline.monthly && !baseline.statistical" class="tabla-contenedor">
          <table class="tabla mensual">
            <thead>
              <tr>
                <th>Mes</th>
                <th v-for="y in yearsOf" :key="y" class="der dato">{{ y }}</th>
                <th class="der">LBEn</th>
                <th class="der banda">Inferior</th>
                <th class="der banda">Superior</th>
                <th class="der banda">Desv. est.</th>
                <th class="der">Mínimo</th>
                <th class="der">Ahorro</th>
                <th class="der">%</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(m, i) in baseline.monthly.months" :key="m.month">
                <td>{{ MONTHS_LONG[i] }}</td>
                <td v-for="y in yearsOf" :key="y" class="der dato" :class="{ fuera: valueOf(i, y)?.outside }">{{ valueOf(i, y) ? mono(valueOf(i, y)!.value, decimals) : '—' }}</td>
                <td class="der fuerte">{{ mono(m.baseline, decimals) }}</td>
                <td class="der banda">{{ mono(m.lower, decimals) }}</td>
                <td class="der banda">{{ mono(m.upper, decimals) }}</td>
                <td class="der banda">{{ mono(m.stdDev, decimals) }}</td>
                <td class="der">{{ mono(m.minimum, decimals) }}</td>
                <td class="der">{{ mono(m.saving, decimals) }}</td>
                <td class="der">{{ m.savingPct === null ? '—' : formatPercent(m.savingPct, 1) }}</td>
              </tr>
            </tbody>
            <tfoot>
              <tr>
                <td>Promedio</td>
                <td v-for="y in yearsOf" :key="y" class="der dato"></td>
                <td class="der">{{ mono(baseline.monthly.meanBaseline, decimals) }}</td>
                <td class="der banda"></td>
                <td class="der banda"></td>
                <td class="der banda"></td>
                <td class="der">{{ mono(baseline.monthly.meanMinimum, decimals) }}</td>
                <td class="der">{{ mono(baseline.monthly.meanSaving, decimals) }}</td>
                <td class="der">{{ baseline.monthly.savingPct === null ? '—' : formatPercent(baseline.monthly.savingPct, 1) }}</td>
              </tr>
            </tfoot>
          </table>
        </div>
        <p v-if="baseline.ratio" class="nota">
          <IconInfoCircle :size="15" />
          <span>Cifras en {{ baseline.ratio.ratioUnit }}. Para pasar el ahorro a kWh se multiplica por el valor promedio de la variable en cada mes.</span>
        </p>

        <!-- Estadístico: la regresión con lo que entrega Excel -->
        <template v-if="baseline.statistical">
          <code class="ecuacion">{{ equation }}</code>
          <div class="tabla-contenedor">
            <table class="tabla">
              <thead>
                <tr>
                  <th>Término</th>
                  <th class="der">Coeficiente</th>
                  <th class="der dato">Error típico</th>
                  <th class="der dato">Estadístico t</th>
                  <th class="der">Probabilidad</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in coefficientRows" :key="row.name">
                  <td>{{ row.name }}<small class="unidad"> · {{ row.unit }}</small></td>
                  <td class="der">{{ formatNumber(row.coefficient, 3) }}</td>
                  <td class="der dato">{{ formatNumber(row.error, 3) }}</td>
                  <td class="der dato">{{ formatNumber(row.t, 2) }}</td>
                  <td class="der" :class="{ fuera: row.p > 0.05 }">{{ pText(row.p) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p class="nota">
            <IconInfoCircle :size="15" />
            <span>
              R² {{ formatNumber(baseline.statistical.model.r2, 3) }} · R² ajustado {{ formatNumber(baseline.statistical.model.adjustedR2, 3) }} · significancia de F
              {{ pText(baseline.statistical.model.fPValue) }} · {{ baseline.statistical.model.observations }} observaciones. Consumo mensual del periodo base: máximo
              {{ formatNumber(baseline.statistical.consumption.maximum) }}, mínimo {{ formatNumber(baseline.statistical.consumption.minimum) }}, promedio
              {{ formatNumber(baseline.statistical.consumption.average) }} kWh y desviación estándar
              {{ baseline.statistical.consumption.stdDev === null ? '—' : formatNumber(baseline.statistical.consumption.stdDev) }} kWh. Una variable con probabilidad mayor a 0,05 no produce cambios
              significativos en el consumo (§7.5.3).
              <template v-if="baseline.statistical.target">
                La línea meta se construyó con los {{ baseline.statistical.target.bestPeriods.length }} meses que consumieron menos que la LBEn.
              </template>
            </span>
          </p>
        </template>

        <!-- Ajustes -->
        <div class="cabecera-seccion subseccion">
          <h3><IconAdjustmentsHorizontal :size="16" />Ajustes de la línea base</h3>
          <Button label="Registrar ajuste" size="small" severity="secondary" outlined @click="openNew()">
            <template #icon><IconPlus :size="16" /></template>
          </Button>
        </div>
        <ul v-if="adjustments.length" class="ajustes">
          <li v-for="a in adjustments" :key="a.id">
            <button type="button" @click="openEdit(a)">
              <span class="cabeza">
                <StatusChip :tone="a.kind === 'actualizacion' ? 'info' : a.kind === 'rutinario' ? 'neutral' : 'warning'" :label="KIND_LABEL[a.kind]" />
                <span class="causa">{{ a.cause }}</span>
              </span>
              <span class="detalle">
                {{ formatDate(a.date) }} · {{ monthsText(a.months) }}
                <StatusChip v-if="a.applied" tone="good" label="Corrige la línea base" />
              </span>
            </button>
          </li>
        </ul>
        <p v-else class="nota">
          <IconInfoCircle :size="15" />
          <span>Sin ajustes. Registra aquí un suceso que no se repite (remodelación, paro, aires fuera de servicio) para que no distorsione la línea base ni el ahorro estimado.</span>
        </p>

        <!-- Paso 7 de los anexos -->
        <div class="cabecera-seccion subseccion">
          <h3><IconFileDescription :size="16" />Información para reportar a la UPME</h3>
          <span class="eyebrow">Paso 7 de los anexos de la Res. UPME 016</span>
        </div>
        <div class="tabla-contenedor">
          <table class="tabla">
            <thead>
              <tr>
                <th>Atributo</th>
                <th>Descripción</th>
                <th class="dato">Observaciones</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in baseline.attributes" :key="row.attribute">
                <td>{{ row.attribute }}</td>
                <td>{{ row.description }}</td>
                <td class="dato">{{ row.note ?? '' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p class="nota">
          <IconInfoCircle :size="15" />
          <span>
            {{ MODEL_LABEL[baseline.kind] }} · {{ MONTHS_SHORT[Number(baseline.from.slice(5, 7)) - 1] }} {{ baseline.from.slice(0, 4) }} a
            {{ MONTHS_SHORT[Number(baseline.to.slice(5, 7)) - 1] }} {{ baseline.to.slice(0, 4) }}. El consumo se normalizó a 30 días con la ecuación (kWh facturados ÷ días facturados) × 30.
          </span>
        </p>
      </template>

      <EmptyState v-else :icon="IconReceipt" title="Faltan facturas" text="La línea base de la UPME necesita las facturas mensuales de electricidad, idealmente de tres años.">
        <RouterLink :to="{ name: 'facturacion', params: { projectId } }">Registrar facturas</RouterLink>
      </EmptyState>
    </section>

    <FormSheet
      v-model:visible="visible"
      :title="isNew ? 'Nuevo ajuste de la línea base' : draft.cause || 'Ajuste'"
      eyebrow="Línea base · Res. UPME 016"
      :saving="saving"
      :can-delete="!isNew"
      @submit="save"
      @delete="remove()"
    >
      <BaselineAdjustmentForm :key="draft.id" v-model:draft="draft" :errors="errors" :series="adjustmentSeries" />
    </FormSheet>
  </div>
</template>

<style scoped>
.panel-upme {
  min-width: 0;
}
.periodo {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  align-items: end;
  gap: 10px;
}
.duracion {
  grid-column: 1 / -1;
  margin: 0;
  color: var(--ink-2);
  font-size: 13px;
}
.conservar {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  color: var(--ink-2);
  font-size: 13px;
  cursor: pointer;
}
.conservar input {
  flex-shrink: 0;
  width: 18px;
  height: 18px;
  accent-color: var(--accent-strong);
}
.conservar small {
  color: var(--muted);
}
.cifras {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1px;
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--divider);
}
.cifra {
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding: 10px 12px;
  background: var(--surface);
}
.cifra strong {
  font-size: 20px;
  font-weight: 600;
}
.unidad {
  color: var(--muted);
  font-size: 12px;
}
.avisos {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.avisos li {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  color: var(--ink-2);
  font-size: 13px;
  line-height: 1.4;
}
.avisos li > :first-child {
  margin-top: 1px;
}
.nota {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  margin: 0;
  color: var(--ink-2);
  font-size: 13px;
}
.nota svg {
  flex-shrink: 0;
  margin-top: 2px;
}
.subseccion {
  margin-top: 6px;
}
.chips-variables {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.variable {
  height: 34px;
  padding: 0 12px;
  border: 1px solid var(--field-border);
  border-radius: 999px;
  background: var(--surface);
  color: var(--ink-2);
  font-size: 13px;
  cursor: pointer;
}
.variable.activa {
  border-color: var(--accent-strong);
  background: var(--accent-wash);
  color: var(--accent-ink);
  font-weight: 600;
}
.ecuacion {
  padding: 10px 12px;
  border-radius: var(--radius);
  background-color: var(--navy);
  background-image: var(--blueprint);
  background-size: 18px 18px;
  color: #fff;
  font-family: var(--font-mono);
  font-size: 13px;
  overflow-wrap: anywhere;
}
.mensual td.fuerte {
  font-weight: 600;
}
.tabla td.fuera {
  color: var(--critical-text);
  font-weight: 600;
}
.ajustes {
  display: flex;
  flex-direction: column;
  margin: 0;
  padding: 0;
  list-style: none;
  border: 1px solid var(--border);
  border-radius: var(--radius);
}
.ajustes li + li {
  border-top: 1px solid var(--divider);
}
.ajustes button {
  display: flex;
  flex-direction: column;
  gap: 4px;
  width: 100%;
  padding: 10px 12px;
  border: 0;
  background: none;
  color: var(--ink);
  font: inherit;
  text-align: left;
  cursor: pointer;
}
.ajustes .cabeza,
.ajustes .detalle {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 8px;
}
.ajustes .causa {
  font-weight: 600;
}
.ajustes .detalle {
  color: var(--ink-2);
  font-size: 12.5px;
}
@media (max-width: 639px) {
  /* En el celular la tabla deja las columnas que están en la gráfica */
  .tabla .banda,
  .tabla .dato {
    display: none;
  }
}
@media (min-width: 720px) {
  .periodo {
    grid-template-columns: 220px 220px 1fr;
  }
  .duracion {
    grid-column: auto;
    padding-bottom: 10px;
  }
  .cifras {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}
</style>
