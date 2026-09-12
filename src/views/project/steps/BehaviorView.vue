<script setup lang="ts">
import { IconBulb, IconFileImport, IconInfoCircle, IconReceipt } from '@tabler/icons-vue';
import { useMediaQuery } from '@vueuse/core';
import Button from 'primevue/button';
import Select from 'primevue/select';
import { computed, ref, shallowRef, watch } from 'vue';
import { RouterLink, useRoute } from 'vue-router';
import { barsChart, dayProfileChart, linesChart, weekHeatmapChart } from '@/charts/builders';
import { chartPalette, withAlpha } from '@/charts/palette';
import EChart from '@/components/charts/EChart.vue';
import PngButton from '@/components/charts/PngButton.vue';
import EmptyState from '@/components/EmptyState.vue';
import ChoiceChips from '@/components/ui/ChoiceChips.vue';
import PageHeader from '@/components/ui/PageHeader.vue';
import StatusChip from '@/components/ui/StatusChip.vue';
import { useCurrentProject } from '@/composables/useCurrentProject';
import { useProjectRecords } from '@/composables/useProjectRecords';
import { useTheme } from '@/composables/useTheme';
import { loadSeriesReadings } from '@/db/intervals';
import { getDb } from '@/db/schema';
import { analyzeInterval, annualSummary, monthlyRows } from '@/domain/analysis';
import type { IntervalReading } from '@/domain/calc/interval';
import { mean, sum } from '@/domain/calc/stats';
import { estimatedProfiles } from '@/domain/estimate';
import { formatDate, formatDateTime, MONTHS_SHORT, parseLocal, periodLabel, periodLabelLong, toLocalDateTime } from '@/utils/dates';
import { formatCop, formatMillionsCop, formatNumber, formatPercent } from '@/utils/format';
import { fileSlug } from '@/utils/text';

const db = getDb();
const route = useRoute();
const { projectId, project } = useCurrentProject();
const { isDark } = useTheme();
const desktop = useMediaQuery('(min-width: 1024px)');
const pngName = (chart: string) => `${fileSlug(project.value?.name ?? 'proyecto')}_${chart}`;

const TABS = [
  { value: 'diario', label: 'Diario' },
  { value: 'mensual', label: 'Mensual' },
  { value: 'anual', label: 'Anual' },
] as const;
type Tab = (typeof TABS)[number]['value'];
const tab = ref<Tab>(route.query.tab === 'mensual' || route.query.tab === 'anual' ? route.query.tab : 'diario');

const { rows: seriesList, ready: seriesReady } = useProjectRecords('intervalSeries', (a, b) => b.createdAt - a.createdAt);
const { rows: bills } = useProjectRecords('bills', (a, b) => a.period.localeCompare(b.period));
const { rows: equipment } = useProjectRecords('equipment');

// ——— Diario: serie del analizador o del operador ———
const selectedId = ref<string | undefined>(typeof route.query.serie === 'string' ? route.query.serie : undefined);
const selected = computed(() => seriesList.value.find((s) => s.id === selectedId.value) ?? seriesList.value[0]);
const readings = shallowRef<IntervalReading[]>([]);
const loading = ref(false);
watch(
  () => selected.value?.id,
  async () => {
    const series = selected.value;
    if (!series) {
      readings.value = [];
      return;
    }
    loading.value = true;
    readings.value = await loadSeriesReadings(db, series);
    loading.value = false;
  },
  { immediate: true },
);

const holidays = computed(() => new Set(project.value?.calendar.holidays ?? []));
const analysis = computed(() => (selected.value && readings.value.length ? analyzeInterval(readings.value, selected.value.intervalMinutes, holidays.value) : null));
const estimated = computed(() => estimatedProfiles(equipment.value));
const hasEstimate = computed(() => estimated.value.laborable.some((kw) => kw > 0));
/** La curva estimada con el inventario solo se compara con una serie que mide toda la instalación. */
const compareEstimate = computed(() => hasEstimate.value && !!selected.value?.wholeFacility);
const round1 = (values: readonly number[]) => values.map((v) => Math.round(v * 10) / 10);

function buildProfile(dark: boolean) {
  const p = chartPalette(dark);
  const a = analysis.value;
  const series = a
    ? [
        { name: 'Laborable · medido', values: round1(a.weekdayProfile), color: p.series[0], area: true },
        ...(a.dailyEnergy.some((d) => d.weekend) ? [{ name: 'Fin de semana · medido', values: round1(a.weekendProfile), color: p.series[1] }] : []),
        ...(compareEstimate.value ? [{ name: 'Estimado con el inventario', values: round1(estimated.value.laborable), color: p.estimate, dashed: true }] : []),
      ]
    : [
        { name: 'Laborable · estimado', values: round1(estimated.value.laborable), color: p.series[0], area: true },
        { name: 'Fin de semana · estimado', values: round1(estimated.value.finDeSemana), color: p.series[1] },
      ];
  return dayProfileChart({ series, dark });
}
const buildHeatmap = (dark: boolean) => (analysis.value ? weekHeatmapChart({ matrix: analysis.value.matrix, dark }) : null);

const WEEKDAY_SHORT = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const dayLabel = (iso: string) => {
  const d = parseLocal(iso);
  return d ? `${WEEKDAY_SHORT[d.getDay()]} ${d.getDate()}` : iso;
};
function buildDaily(dark: boolean) {
  const a = analysis.value;
  if (!a) return null;
  const p = chartPalette(dark);
  return barsChart({
    labels: a.dailyEnergy.map((d) => dayLabel(d.date)),
    series: [{ name: 'Energía del día', values: a.dailyEnergy.map((d) => Math.round(d.kwh)) }],
    colors: a.dailyEnergy.map((d) => (d.weekend ? withAlpha(p.series[0], 0.45) : p.series[0])),
    unit: 'kWh',
    average: a.averageDailyKwh,
    dark,
  });
}
const profileOption = computed(() => buildProfile(isDark.value));
const heatmapOption = computed(() => buildHeatmap(isDark.value));
const dailyOption = computed(() => buildDaily(isDark.value));

const dailyStats = computed(() => {
  const a = analysis.value;
  if (a) {
    return [
      { label: 'Demanda máxima', value: formatNumber(a.peak?.kw ?? 0, 1), unit: 'kW' },
      { label: 'Carga base', value: formatNumber(a.baseLoadKw, 1), unit: 'kW' },
      { label: 'Factor de carga', value: formatPercent(a.loadFactor, 0) },
      { label: 'Energía diaria', value: formatNumber(a.averageDailyKwh), unit: 'kWh/día' },
    ];
  }
  if (!hasEstimate.value) return undefined;
  const weekday = estimated.value.laborable;
  return [
    { label: 'Demanda estimada', value: formatNumber(Math.max(...weekday), 1), unit: 'kW' },
    { label: 'Carga nocturna', value: formatNumber(Math.min(...weekday), 1), unit: 'kW' },
    { label: 'Energía laborable', value: formatNumber(sum(weekday)), unit: 'kWh/día' },
    { label: 'Fin de semana', value: formatNumber(sum(estimated.value.finDeSemana)), unit: 'kWh/día' },
  ];
});

/** Consumo diario de las facturas de los últimos 12 meses, para ubicar el punto medido dentro del total. */
const billedPerDay = computed(() => {
  const withDays = bills.value.slice(-12).filter((b) => b.days);
  const days = sum(withDays.map((b) => b.days ?? 0));
  return days ? sum(withDays.map((b) => b.kwh)) / days : null;
});

/** Lectura en palabras de la curva medida: lo primero que el auditor quiere contar al cliente. */
const insights = computed(() => {
  const a = analysis.value;
  if (!a) return [];
  const weekdays = a.dailyEnergy.filter((d) => d.complete && !d.weekend);
  const weekends = a.dailyEnergy.filter((d) => d.complete && d.weekend);
  const list: string[] = [];
  if (a.peak) list.push(`La demanda máxima fue de ${formatNumber(a.peak.kw, 1)} kW el ${formatDateTime(toLocalDateTime(a.peak.start))}.`);
  if (a.peak?.kw) {
    list.push(`La carga base (${formatNumber(a.baseLoadKw, 1)} kW) es el ${formatPercent(a.baseLoadKw / a.peak.kw, 0)} de la demanda máxima: es lo que sigue encendido de noche y los fines de semana.`);
  }
  if (weekdays.length && weekends.length) {
    list.push(`Un día de fin de semana consume el ${formatPercent(mean(weekends.map((d) => d.kwh)) / mean(weekdays.map((d) => d.kwh)), 0)} de lo que consume un día laborable.`);
  }
  const estimatedDay = sum(estimated.value.laborable);
  if (compareEstimate.value && weekdays.length && estimatedDay > 0) {
    const ratio = estimatedDay / mean(weekdays.map((d) => d.kwh));
    const pct = formatPercent(ratio, 0);
    list.push(
      ratio >= 0.85 && ratio <= 1.15
        ? `El inventario explica el ${pct} de la energía de un día laborable medido: el censo representa bien la operación.`
        : ratio < 0.85
          ? `El inventario explica solo el ${pct} de la energía de un día laborable medido: faltan equipos, horas de uso o cargas nocturnas por registrar.`
          : `El inventario estima el ${pct} de la energía de un día laborable medido: revisa las horas y los factores de uso del censo.`,
    );
  } else if (!selected.value?.wholeFacility && billedPerDay.value) {
    const ratio = a.averageDailyKwh / billedPerDay.value;
    list.push(
      ratio >= 0.9
        ? `Este punto registra el ${formatPercent(ratio, 0)} del consumo diario facturado (${formatNumber(billedPerDay.value)} kWh/día): parece medir toda la instalación. Márcalo así en Mediciones para compararlo con el inventario.`
        : `Este punto registra el ${formatPercent(ratio, 0)} del consumo diario facturado (${formatNumber(billedPerDay.value)} kWh/día): mide una parte de la instalación.`,
    );
  }
  list.push(`Factor de carga del ${formatPercent(a.loadFactor, 0)}: ${a.loadFactor < 0.35 ? 'el consumo se concentra en pocas horas; hay margen para desplazar o recortar picos.' : 'el consumo está repartido a lo largo del día.'}`);
  return list;
});

// ——— Mensual: facturas ———
const rows = computed(() => monthlyRows(bills.value));
const last12 = computed(() => rows.value.slice(-12));
const monthName = (period: string) => MONTHS_SHORT[Number(period.slice(5, 7)) - 1] ?? period;
const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

function buildYoy(dark: boolean) {
  const r = last12.value;
  if (!r.length) return null;
  const p = chartPalette(dark);
  const hasPrevious = r.some((m) => m.previousKwh !== null);
  const current = { name: `${periodLabel(r[0].period)} – ${periodLabel(r[r.length - 1].period)}`, values: r.map((m) => m.kwh), color: p.series[0] };
  return barsChart({
    labels: r.map((m) => monthName(m.period)),
    series: hasPrevious ? [{ name: 'Año anterior', values: r.map((m) => m.previousKwh), color: p.estimate }, current] : [current],
    unit: 'kWh',
    highlightMax: !hasPrevious,
    dark,
  });
}
function buildPerDay(dark: boolean) {
  const r = last12.value.filter((m) => m.kwhPerDay !== null);
  if (!r.length) return null;
  const p = chartPalette(dark);
  return barsChart({
    labels: r.map((m) => monthName(m.period)),
    series: [{ name: 'Consumo diario', values: r.map((m) => Math.round(m.kwhPerDay ?? 0)), color: p.series[2] }],
    unit: 'kWh/día',
    average: sum(r.map((m) => m.kwh)) / sum(r.map((m) => m.days ?? 0)),
    dark,
  });
}
function buildCost(dark: boolean) {
  const r = last12.value;
  if (!r.length) return null;
  const p = chartPalette(dark);
  return barsChart({
    labels: r.map((m) => monthName(m.period)),
    series: [{ name: 'Costo', values: r.map((m) => Math.round(m.costCop / 100_000) / 10), color: p.series[3] }],
    unit: 'M COP',
    decimals: 1,
    dark,
  });
}
const yoyOption = computed(() => buildYoy(isDark.value));
const perDayOption = computed(() => buildPerDay(isDark.value));
const costOption = computed(() => buildCost(isDark.value));

const monthlyStats = computed(() => {
  const r = last12.value;
  if (!r.length) return undefined;
  const top = [...r].sort((a, b) => b.kwh - a.kwh)[0];
  const low = [...r].sort((a, b) => a.kwh - b.kwh)[0];
  const withDays = r.filter((m) => m.days);
  return [
    { label: 'Promedio mensual', value: formatNumber(mean(r.map((m) => m.kwh))), unit: 'kWh' },
    { label: 'Mes más alto', value: formatNumber(top.kwh), unit: periodLabel(top.period) },
    { label: 'Mes más bajo', value: formatNumber(low.kwh), unit: periodLabel(low.period) },
    withDays.length
      ? { label: 'Promedio diario', value: formatNumber(sum(withDays.map((m) => m.kwh)) / sum(withDays.map((m) => m.days ?? 0))), unit: 'kWh/día' }
      : { label: 'Tarifa media', value: formatNumber(sum(r.map((m) => m.costCop)) / sum(r.map((m) => m.kwh)), 1), unit: 'COP/kWh' },
  ];
});
const newestRows = computed(() => [...rows.value].reverse());

// ——— Anual ———
const annual = computed(() => annualSummary(bills.value, project.value?.economics.emissionFactorKgPerKwh ?? 0));
const annualStats = computed(() => {
  const s = annual.value;
  const reference = s.last12Kwh ?? s.annualizedKwh;
  if (reference === null) return undefined;
  return [
    { label: s.last12Kwh !== null ? 'Últimos 12 meses' : 'Anual estimado', value: formatNumber(reference), unit: 'kWh' },
    {
      label: 'Variación anual',
      value: s.change === null ? '—' : `${s.change < 0 ? '−' : '+'}${formatPercent(Math.abs(s.change), 1)}`,
      unit: s.change === null ? 'faltan 24 meses' : 'vs. año anterior',
    },
    { label: 'Costo anual', value: s.last12CostCop !== null ? formatMillionsCop(s.last12CostCop) : '—', unit: 'COP' },
    { label: 'Emisiones', value: s.co2Tonnes !== null ? formatNumber(s.co2Tonnes, 1) : '—', unit: s.co2Tonnes !== null ? 't CO₂e/año' : 'sin factor' },
  ];
});
function buildYears(dark: boolean) {
  const years = annual.value.byYear;
  if (!years.length) return null;
  const p = chartPalette(dark);
  return barsChart({
    labels: years.map((y) => (y.months < 12 ? `${y.year} · ${y.months} m` : String(y.year))),
    series: [{ name: 'Consumo del año', values: years.map((y) => y.kwh) }],
    colors: years.map((y) => (y.months < 12 ? withAlpha(p.series[0], 0.45) : p.series[0])),
    unit: 'kWh',
    dark,
  });
}
function buildRolling(dark: boolean) {
  const rolling = annual.value.rolling;
  if (rolling.length < 2) return null;
  return linesChart({
    labels: rolling.map((r) => periodLabel(r.period)),
    series: [{ name: 'Suma de 12 meses', values: rolling.map((r) => r.kwh), area: true }],
    unit: 'kWh',
    minZero: false,
    dark,
  });
}
const yearsOption = computed(() => buildYears(isDark.value));
const rollingOption = computed(() => buildRolling(isDark.value));

const headerStats = computed(() => (tab.value === 'diario' ? dailyStats.value : tab.value === 'mensual' ? monthlyStats.value : annualStats.value));
const changeTone = (change: number | null) => (change === null ? 'neutral' : change > 0.05 ? 'serious' : change < -0.05 ? 'good' : 'neutral');
const changeText = (change: number | null) => (change === null ? '—' : `${change < 0 ? '−' : '+'}${formatPercent(Math.abs(change), 1)}`);
</script>

<template>
  <div class="vista">
    <PageHeader step="comportamiento" :stats="headerStats">
      <ChoiceChips v-model="tab" :options="TABS" label="Periodo del análisis" fill />
    </PageHeader>

    <!-- Diario -->
    <template v-if="tab === 'diario'">
      <label v-if="seriesList.length > 1" class="campo selector">
        <span class="etiqueta">Serie</span>
        <Select v-model="selectedId" :options="seriesList" option-label="name" option-value="id" :placeholder="selected?.name" />
      </label>

      <div class="rejilla">
        <section class="card seccion ancha">
          <div class="cabecera-seccion">
            <h2>Curva de carga típica</h2>
            <span class="eyebrow">{{ analysis && selected ? `${selected.name} · ${analysis.completeDays} días` : 'Estimada con el inventario' }}</span>
            <PngButton v-if="analysis || hasEstimate" :option="() => buildProfile(false)" :name="pngName('curva-de-carga')" />
          </div>
          <EChart v-if="analysis || hasEstimate" :option="profileOption" label="Curva de carga típica por hora del día" height="280px" />
          <p v-if="!analysis && seriesReady" class="aviso-linea">
            <IconInfoCircle :size="16" />
            <span>
              {{ hasEstimate ? 'Esta curva sale del inventario y sus horarios.' : 'Aún no hay datos para la curva diaria.' }}
              Para la curva medida, importa el archivo del analizador o del operador en
              <RouterLink :to="{ name: 'mediciones', params: { projectId }, query: { tab: 'analizador' } }">Mediciones · Analizador</RouterLink>.
            </span>
          </p>
          <p v-else-if="analysis && hasEstimate && !selected?.wholeFacility" class="nota">
            La curva estimada con el inventario se compara solo con series que miden toda la instalación; esta serie está marcada como punto parcial.
          </p>
        </section>

        <template v-if="analysis">
          <section class="card seccion">
            <div class="cabecera-seccion">
              <h2>Mapa de calor</h2>
              <span class="eyebrow">kW promedio · día × hora</span>
              <PngButton :option="() => buildHeatmap(false)" :name="pngName('mapa-de-calor')" />
            </div>
            <EChart v-if="heatmapOption" :option="heatmapOption" label="Mapa de calor de la potencia por día de la semana y hora" height="280px" />
          </section>
          <section class="card seccion">
            <div class="cabecera-seccion">
              <h2>Energía por día</h2>
              <span class="eyebrow">kWh · fines de semana más claros</span>
              <PngButton :option="() => buildDaily(false)" :name="pngName('energia-por-dia')" />
            </div>
            <EChart v-if="dailyOption" :option="dailyOption" label="Energía consumida cada día del registro" height="280px" />
          </section>
          <section class="card seccion ancha lectura">
            <div class="cabecera-seccion">
              <h2><IconBulb :size="18" />Lo que muestra la curva</h2>
              <span class="eyebrow">{{ formatDate(analysis.firstDate) }} – {{ formatDate(analysis.lastDate) }}</span>
            </div>
            <ul>
              <li v-for="item in insights" :key="item">{{ item }}</li>
            </ul>
          </section>
        </template>
        <div v-else-if="seriesReady && !hasEstimate" class="card ancha">
          <EmptyState :icon="IconFileImport" title="Sin curva diaria todavía" text="Importa el archivo del analizador de redes o del operador, o marca los horarios de los equipos en el inventario.">
            <RouterLink :to="{ name: 'mediciones', params: { projectId }, query: { tab: 'analizador' } }">Importar archivo</RouterLink>
          </EmptyState>
        </div>
      </div>
    </template>

    <!-- Mensual -->
    <template v-else-if="tab === 'mensual'">
      <div v-if="rows.length" class="rejilla">
        <section class="card seccion ancha">
          <div class="cabecera-seccion">
            <h2>Consumo mensual</h2>
            <span class="eyebrow">kWh · comparado con el año anterior</span>
            <PngButton :option="() => buildYoy(false)" :name="pngName('consumo-mensual')" />
          </div>
          <EChart v-if="yoyOption" :option="yoyOption" label="Consumo mensual frente al mismo mes del año anterior" height="260px" />
        </section>
        <section v-if="perDayOption" class="card seccion">
          <div class="cabecera-seccion">
            <h2>Consumo por día facturado</h2>
            <span class="eyebrow">kWh/día · corrige meses cortos y largos</span>
            <PngButton :option="() => buildPerDay(false)" :name="pngName('consumo-por-dia')" />
          </div>
          <EChart :option="perDayOption" label="Consumo promedio por día de cada factura" height="240px" />
        </section>
        <section v-if="costOption" class="card seccion">
          <div class="cabecera-seccion">
            <h2>Costo mensual</h2>
            <span class="eyebrow">millones de COP</span>
            <PngButton :option="() => buildCost(false)" :name="pngName('costo-mensual')" />
          </div>
          <EChart :option="costOption" label="Costo de cada factura en millones de pesos" height="240px" />
        </section>

        <section class="card ancha">
          <div v-if="desktop" class="tabla-contenedor">
            <table class="tabla">
              <thead>
                <tr>
                  <th>Periodo</th>
                  <th class="der">Energía <small>kWh</small></th>
                  <th class="der">Días</th>
                  <th class="der">Diario <small>kWh/día</small></th>
                  <th class="der">Costo <small>COP</small></th>
                  <th class="der">Mismo mes año anterior <small>kWh</small></th>
                  <th class="der">Variación</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="m in newestRows" :key="m.period">
                  <td class="fuerte">{{ capitalize(periodLabelLong(m.period)) }}</td>
                  <td class="der fuerte">{{ formatNumber(m.kwh) }}</td>
                  <td class="der">{{ m.days ?? '—' }}</td>
                  <td class="der">{{ m.kwhPerDay === null ? '—' : formatNumber(m.kwhPerDay) }}</td>
                  <td class="der">{{ formatCop(m.costCop) }}</td>
                  <td class="der">{{ m.previousKwh === null ? '—' : formatNumber(m.previousKwh) }}</td>
                  <td class="der"><StatusChip :tone="changeTone(m.change)" :label="changeText(m.change)" /></td>
                </tr>
              </tbody>
            </table>
          </div>
          <ul v-else class="filas">
            <li v-for="m in newestRows" :key="m.period" class="fila-boton estatica">
              <span class="fila-principal">
                <span class="mono">{{ periodLabel(m.period).toUpperCase() }}</span>
                <strong class="num">{{ formatNumber(m.kwh) }} kWh</strong>
              </span>
              <span class="fila-secundaria">
                <span>{{ m.kwhPerDay === null ? formatCop(m.costCop) : `${formatNumber(m.kwhPerDay)} kWh/día · ${formatCop(m.costCop)}` }}</span>
                <StatusChip v-if="m.change !== null" :tone="changeTone(m.change)" :label="changeText(m.change)" />
              </span>
            </li>
          </ul>
        </section>
      </div>
      <div v-else class="card">
        <EmptyState :icon="IconReceipt" title="Sin facturas" text="Registra las facturas para ver el comportamiento mensual.">
          <RouterLink :to="{ name: 'facturacion', params: { projectId } }">Registrar facturas</RouterLink>
        </EmptyState>
      </div>
    </template>

    <!-- Anual -->
    <template v-else>
      <div v-if="bills.length" class="rejilla">
        <p v-if="annual.annualizedKwh !== null" class="aviso-linea ancha">
          <IconInfoCircle :size="16" />
          Con {{ annual.months }} {{ annual.months === 1 ? 'factura' : 'facturas' }} el consumo anual se estima
          {{ annual.annualizedMethod === 'kwh-dia' ? 'con el promedio de kWh por día facturado × 365' : 'con el promedio mensual × 12' }}. Con 12 facturas se usa el valor real.
        </p>
        <section v-if="yearsOption" class="card seccion">
          <div class="cabecera-seccion">
            <h2>Consumo por año</h2>
            <span class="eyebrow">kWh · años incompletos más claros</span>
            <PngButton :option="() => buildYears(false)" :name="pngName('consumo-por-ano')" />
          </div>
          <EChart :option="yearsOption" label="Consumo total de cada año calendario" height="240px" />
        </section>
        <section v-if="rollingOption" class="card seccion">
          <div class="cabecera-seccion">
            <h2>Tendencia de 12 meses</h2>
            <span class="eyebrow">suma móvil · kWh</span>
            <PngButton :option="() => buildRolling(false)" :name="pngName('tendencia-12-meses')" />
          </div>
          <EChart :option="rollingOption" label="Suma móvil del consumo de los últimos 12 meses" height="240px" />
        </section>
        <section v-else class="card seccion">
          <div class="cabecera-seccion"><h2>Tendencia de 12 meses</h2></div>
          <p class="nota">Con 13 o más facturas consecutivas se dibuja la tendencia móvil del consumo anual.</p>
        </section>
      </div>
      <div v-else class="card">
        <EmptyState :icon="IconReceipt" title="Sin facturas" text="Registra las facturas para ver el comportamiento anual.">
          <Button label="Ir a facturación" severity="secondary" outlined @click="$router.push({ name: 'facturacion', params: { projectId } })" />
        </EmptyState>
      </div>
    </template>
  </div>
</template>

<style scoped>
.selector {
  max-width: 360px;
}
.rejilla {
  display: grid;
  gap: 14px;
}
.lectura ul {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 0;
  padding-left: 18px;
  color: var(--ink-2);
  font-size: 14px;
}
.lectura h2 svg {
  color: var(--warning-text);
}
.fuerte {
  font-weight: 600;
}
.estatica {
  cursor: default;
}
.nota {
  margin: 0;
  color: var(--muted);
  font-size: 13px;
}
@media (min-width: 1024px) {
  .rejilla {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    align-items: start;
  }
  .ancha {
    grid-column: 1 / -1;
  }
}
</style>
