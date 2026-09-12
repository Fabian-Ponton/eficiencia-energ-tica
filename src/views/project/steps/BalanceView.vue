<script setup lang="ts">
import { IconAlertTriangle, IconChartDots, IconCircleCheck, IconInfoCircle, IconPlug, IconReceipt } from '@tabler/icons-vue';
import { computed, ref } from 'vue';
import { RouterLink } from 'vue-router';
import { linesChart, paretoChart, rankingChart, sankeyChart } from '@/charts/builders';
import { chartPalette } from '@/charts/palette';
import EChart from '@/components/charts/EChart.vue';
import PngButton from '@/components/charts/PngButton.vue';
import EmptyState from '@/components/EmptyState.vue';
import PageHeader from '@/components/ui/PageHeader.vue';
import StatusChip from '@/components/ui/StatusChip.vue';
import { useCurrentProject } from '@/composables/useCurrentProject';
import { useProjectRecords } from '@/composables/useProjectRecords';
import { useTheme } from '@/composables/useTheme';
import {
  annualSummary,
  areaIntensity,
  availableVariables,
  BASELINE_VARIABLES,
  endUseShares,
  energyFlow,
  energyIndicators,
  fitBaseline,
  type BaselineResult,
  type BaselineVariable,
} from '@/domain/analysis';
import { reconciliationDeviation, significantEnergyUses } from '@/domain/calc/balance';
import { sum } from '@/domain/calc/stats';
import { endUseOf } from '@/domain/catalogs';
import type { EndUseCategory } from '@/domain/types';
import { periodLabel } from '@/utils/dates';
import { formatNumber, formatPercent } from '@/utils/format';
import { fileSlug } from '@/utils/text';

const { projectId, project } = useCurrentProject();
const { isDark } = useTheme();
const { rows: equipment, ready } = useProjectRecords('equipment');
const { rows: areas } = useProjectRecords('areas');
const { rows: bills } = useProjectRecords('bills', (a, b) => a.period.localeCompare(b.period));
const pngName = (chart: string) => `${fileSlug(project.value?.name ?? 'proyecto')}_${chart}`;

const colorOf = (id: EndUseCategory, dark: boolean) => (dark ? endUseOf(id).colorDark : endUseOf(id).color);

// Consumo de referencia: lo facturado en 12 meses (o anualizado) frente a lo estimado con el censo
const annual = computed(() => annualSummary(bills.value, project.value?.economics.emissionFactorKgPerKwh ?? 0));
const billedAnnual = computed(() => annual.value.last12Kwh ?? annual.value.annualizedKwh);
const shares = computed(() => endUseShares(equipment.value));
const estimatedAnnual = computed(() => sum(shares.value.map((s) => s.kwh)));
const significant = computed(() => significantEnergyUses(shares.value));
const significantIds = computed(() => new Set(significant.value.map((s) => s.category)));
const deviation = computed(() => (billedAnnual.value ? reconciliationDeviation(estimatedAnnual.value, billedAnnual.value) : null));
const reconciliation = computed(() => {
  const d = deviation.value;
  if (d === null || !Number.isFinite(d)) return null;
  const abs = Math.abs(d);
  if (abs <= 0.1) {
    return { tone: 'good' as const, icon: IconCircleCheck, label: 'Censo coherente con la factura', text: 'La diferencia está dentro del ±10 %: el inventario representa bien el consumo real.' };
  }
  if (abs <= 0.2) {
    return { tone: 'warning' as const, icon: IconAlertTriangle, label: 'Revisar el censo', text: 'Diferencia entre 10 % y 20 %: revisa horas de uso, factores de uso o equipos sin registrar.' };
  }
  return {
    tone: 'serious' as const,
    icon: IconAlertTriangle,
    label: 'Censo incompleto o sobrestimado',
    text: d < 0 ? 'Falta consumo por identificar: equipos sin registrar, cargas nocturnas o pérdidas.' : 'El censo supera lo facturado: revisa horas de uso y factores de uso.',
  };
});

function buildPareto(dark: boolean) {
  return paretoChart({
    dark,
    items: shares.value.map((s) => ({
      label: endUseOf(s.category as EndUseCategory).label,
      kwh: Math.round(s.kwh),
      share: s.share,
      cumulative: s.cumulativeShare,
      color: colorOf(s.category as EndUseCategory, dark),
      significant: significantIds.value.has(s.category),
    })),
  });
}

const flow = computed(() => energyFlow(equipment.value, areas.value, billedAnnual.value));
function buildSankey(dark: boolean) {
  const p = chartPalette(dark);
  return sankeyChart({
    dark,
    unit: 'kWh/año',
    nodes: flow.value.nodes.map((n) => ({
      id: n.id,
      label: n.label,
      color: n.kind === 'total' ? p.navy : n.kind === 'resto' ? p.estimate : n.kind === 'area' ? p.axis : colorOf(n.category ?? 'otros', dark),
    })),
    links: flow.value.links.map((l) => ({ source: l.source, target: l.target, value: Math.round(l.kwh) })),
  });
}

const indicators = computed(() =>
  energyIndicators(billedAnnual.value ?? (estimatedAnnual.value || null), annual.value.last12CostCop, project.value?.areaM2, project.value?.users),
);
const intensity = computed(() => areaIntensity(equipment.value, areas.value).filter((i) => i.intensity !== null));
function buildIntensity(dark: boolean) {
  const p = chartPalette(dark);
  return rankingChart({
    dark,
    unit: 'kWh/m²·año',
    decimals: 1,
    items: intensity.value.map((i) => ({ label: i.area.name, value: Math.round((i.intensity ?? 0) * 10) / 10, color: p.series[0] })),
  });
}

// Línea base: variables relevantes elegidas por el auditor (por omisión, días hábiles o días facturados)
const variables = computed(() => availableVariables(bills.value));
const chosen = ref<BaselineVariable[] | null>(null);
const activeVariables = computed<BaselineVariable[]>(() => {
  if (chosen.value) return chosen.value.filter((v) => variables.value.includes(v));
  if (variables.value.includes('workingDays')) return ['workingDays'];
  return variables.value.includes('days') ? ['days'] : [];
});
function toggle(variable: BaselineVariable) {
  const set = new Set(activeVariables.value);
  if (set.has(variable)) set.delete(variable);
  else set.add(variable);
  chosen.value = BASELINE_VARIABLES.map((v) => v.id).filter((id) => set.has(id));
}
const baseline = computed<{ result?: BaselineResult; error?: string }>(() => {
  if (bills.value.length < 4) return { error: 'Se necesitan al menos 4 facturas para ajustar la línea base.' };
  try {
    return { result: fitBaseline(bills.value, activeVariables.value) };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
});
const labelOf = (id: BaselineVariable) => BASELINE_VARIABLES.find((v) => v.id === id)?.label.toLowerCase() ?? id;
const equation = computed(() => {
  const r = baseline.value.result;
  if (!r) return '';
  const [b0, ...rest] = r.model.coefficients;
  const terms = rest.map((b, i) => `${b < 0 ? '−' : '+'} ${formatNumber(Math.abs(b), 1)} × ${labelOf(r.variables[i])}`);
  return `kWh/mes = ${formatNumber(b0)} ${terms.join(' ')}`.trim();
});
function buildBaseline(dark: boolean) {
  const r = baseline.value.result;
  if (!r) return null;
  const p = chartPalette(dark);
  return linesChart({
    labels: r.rows.map((row) => periodLabel(row.period)),
    series: [
      { name: 'Consumo real', values: r.rows.map((row) => row.actual), color: p.series[0] },
      { name: 'Línea base', values: r.rows.map((row) => Math.round(row.predicted)), color: p.series[1], dashed: true },
    ],
    unit: 'kWh',
    minZero: false,
    dark,
  });
}

const paretoOption = computed(() => buildPareto(isDark.value));
const sankeyOption = computed(() => buildSankey(isDark.value));
const intensityOption = computed(() => buildIntensity(isDark.value));
const baselineOption = computed(() => buildBaseline(isDark.value));

const headerStats = computed(() => {
  const reference = billedAnnual.value ?? estimatedAnnual.value;
  if (!reference) return undefined;
  const r = baseline.value.result;
  const last = significant.value[significant.value.length - 1];
  return [
    { label: billedAnnual.value !== null ? 'Consumo anual' : 'Consumo estimado', value: formatNumber(reference), unit: 'kWh' },
    { label: 'Usos significativos', value: String(significant.value.length), unit: last ? `${formatPercent(last.cumulativeShare, 0)} del consumo` : undefined },
    { label: 'Intensidad', value: indicators.value.kwhPerM2Year !== null ? formatNumber(indicators.value.kwhPerM2Year, 1) : '—', unit: 'kWh/m²·año' },
    { label: 'Línea base R²', value: r ? formatNumber(r.model.r2, 2) : '—' },
  ];
});
const significantLabels = computed(() => significant.value.map((s) => endUseOf(s.category as EndUseCategory).label).join(', '));
</script>

<template>
  <div class="vista">
    <PageHeader step="balance" :stats="headerStats" />

    <div v-if="equipment.length" class="rejilla">
      <section v-if="reconciliation" class="card seccion ancha">
        <div class="cabecera-seccion apilada">
          <h2>Conciliación del censo con la factura</h2>
          <StatusChip :tone="reconciliation.tone" :icon="reconciliation.icon" :label="reconciliation.label" />
        </div>
        <div class="comparacion">
          <div>
            <span class="eyebrow">Censo de carga</span>
            <strong class="num">{{ formatNumber(estimatedAnnual) }}</strong>
            <span class="unidad">kWh/año estimados</span>
          </div>
          <div>
            <span class="eyebrow">Facturación</span>
            <strong class="num">{{ formatNumber(billedAnnual ?? 0) }}</strong>
            <span class="unidad">kWh/año {{ annual.last12Kwh !== null ? 'facturados' : 'anualizados' }}</span>
          </div>
          <div>
            <span class="eyebrow">Diferencia</span>
            <strong class="num">{{ deviation === null ? '—' : `${deviation < 0 ? '−' : '+'}${formatPercent(Math.abs(deviation), 1)}` }}</strong>
            <span class="unidad">del censo frente a la factura</span>
          </div>
        </div>
        <p class="nota">{{ reconciliation.text }}</p>
      </section>

      <section class="card seccion">
        <div class="cabecera-seccion">
          <h2>Pareto de usos finales</h2>
          <span class="eyebrow">usos significativos a color · 80 %</span>
          <PngButton :option="() => buildPareto(false)" :name="pngName('pareto-usos-finales')" :height="Math.max(300, shares.length * 52)" />
        </div>
        <EChart :option="paretoOption" label="Consumo anual por uso final ordenado de mayor a menor" :height="`${Math.max(180, shares.length * 40)}px`" />
        <p class="nota">
          <span>
            Usos significativos (ISO 50001): <strong>{{ significantLabels }}</strong>. Concentran el
            {{ significant.length ? formatPercent(significant[significant.length - 1].cumulativeShare, 0) : '—' }} del consumo y son la prioridad del plan.
          </span>
        </p>
      </section>

      <section class="card seccion">
        <div class="cabecera-seccion">
          <h2>Flujo de la energía</h2>
          <span class="eyebrow">kWh/año · total → usos → espacios</span>
          <PngButton :option="() => buildSankey(false)" :name="pngName('flujo-de-energia')" :height="Math.max(420, flow.nodes.length * 36)" />
        </div>
        <EChart :option="sankeyOption" label="Flujo anual de la energía desde el consumo total hacia los usos finales" :height="`${Math.max(240, flow.nodes.length * 30)}px`" />
      </section>

      <section class="card seccion ancha">
        <div class="cabecera-seccion">
          <h2>Indicadores de desempeño energético</h2>
          <span class="eyebrow">IDEn · base anual</span>
        </div>
        <div class="indicadores">
          <div class="indicador">
            <span class="eyebrow">Por área</span>
            <strong class="num">{{ indicators.kwhPerM2Year === null ? '—' : formatNumber(indicators.kwhPerM2Year, 1) }}</strong>
            <span class="unidad">{{ indicators.kwhPerM2Year === null ? 'falta el área construida' : 'kWh/m²·año' }}</span>
          </div>
          <div class="indicador">
            <span class="eyebrow">Por usuario</span>
            <strong class="num">{{ indicators.kwhPerUserYear === null ? '—' : formatNumber(indicators.kwhPerUserYear) }}</strong>
            <span class="unidad">{{ indicators.kwhPerUserYear === null ? 'faltan los usuarios' : 'kWh/usuario·año' }}</span>
          </div>
          <div class="indicador">
            <span class="eyebrow">Diario</span>
            <strong class="num">{{ indicators.kwhPerDay === null ? '—' : formatNumber(indicators.kwhPerDay) }}</strong>
            <span class="unidad">kWh/día promedio</span>
          </div>
          <div class="indicador">
            <span class="eyebrow">Costo por área</span>
            <strong class="num">{{ indicators.copPerM2Year === null ? '—' : formatNumber(indicators.copPerM2Year) }}</strong>
            <span class="unidad">{{ indicators.copPerM2Year === null ? 'faltan 12 facturas' : 'COP/m²·año' }}</span>
          </div>
        </div>
        <template v-if="intensity.length">
          <div class="cabecera-seccion subseccion">
            <h3>Intensidad por espacio</h3>
            <span class="eyebrow">kWh/m²·año · equipos asignados a cada espacio</span>
            <PngButton :option="() => buildIntensity(false)" :name="pngName('intensidad-por-espacio')" :height="Math.max(240, intensity.length * 46)" />
          </div>
          <EChart :option="intensityOption" label="Intensidad energética de cada espacio" :height="`${Math.max(140, intensity.length * 38)}px`" />
        </template>
        <p v-else class="nota">
          <IconInfoCircle :size="15" />
          <span>Asigna los equipos a sus espacios en el inventario para comparar la intensidad de cada espacio.</span>
        </p>
      </section>

      <section class="card seccion ancha">
        <div class="cabecera-seccion">
          <h2><IconChartDots :size="18" />Línea base energética</h2>
          <span class="eyebrow">ISO 50006 · regresión mensual</span>
          <PngButton v-if="baseline.result" :option="() => buildBaseline(false)" :name="pngName('linea-base')" />
        </div>
        <template v-if="bills.length">
          <div class="variables" role="group" aria-label="Variables relevantes del modelo">
            <span class="etiqueta">Variables relevantes</span>
            <div class="chips-variables">
              <button
                v-for="v in BASELINE_VARIABLES"
                :key="v.id"
                type="button"
                class="variable"
                :class="{ activa: activeVariables.includes(v.id) }"
                :disabled="!variables.includes(v.id)"
                :aria-pressed="activeVariables.includes(v.id)"
                :title="variables.includes(v.id) ? '' : 'Registra este dato en las facturas para usarlo'"
                @click="toggle(v.id)"
              >
                {{ v.label }}
              </button>
            </div>
          </div>
          <p v-if="baseline.error" class="aviso-linea alerta"><IconAlertTriangle :size="16" />{{ baseline.error }}</p>
          <template v-else-if="baseline.result">
            <div class="modelo">
              <code class="ecuacion">{{ equation }}</code>
              <div class="calidad">
                <StatusChip :tone="baseline.result.quality.r2 ? 'good' : 'warning'" :label="`R² ${formatNumber(baseline.result.model.r2, 2)}`" />
                <StatusChip :tone="baseline.result.quality.cvRmse ? 'good' : 'warning'" :label="`CV(RMSE) ${formatPercent(baseline.result.model.cvRmse, 1)}`" />
                <StatusChip :tone="baseline.result.quality.nmbe ? 'good' : 'warning'" :label="`NMBE ${formatPercent(baseline.result.model.nmbe, 2)}`" />
                <span class="unidad">{{ baseline.result.model.observations }} meses</span>
              </div>
            </div>
            <EChart v-if="baselineOption" :option="baselineOption" label="Consumo real frente a la línea base" height="260px" />
            <p class="nota">
              Criterios de ASHRAE Guideline 14 para datos mensuales: CV(RMSE) ≤ 15 % y NMBE dentro de ±5 %; R² ≥ 0,75 recomendado. La línea base permite medir los ahorros
              del plan con el protocolo IPMVP.
            </p>
          </template>
        </template>
        <EmptyState v-else :icon="IconReceipt" title="Sin facturas" text="La línea base se ajusta con las facturas y sus variables (días hábiles, ocupación, temperatura).">
          <RouterLink :to="{ name: 'facturacion', params: { projectId } }">Registrar facturas</RouterLink>
        </EmptyState>
      </section>
    </div>

    <div v-else-if="ready" class="card">
      <EmptyState :icon="IconPlug" title="Sin inventario" text="El balance por uso final y los usos significativos salen del censo de carga.">
        <RouterLink :to="{ name: 'inventario', params: { projectId } }">Ir al inventario</RouterLink>
      </EmptyState>
    </div>
  </div>
</template>

<style scoped>
.rejilla {
  display: grid;
  gap: 14px;
}
.comparacion,
.indicadores {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1px;
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--divider);
}
/* Tres cifras en dos columnas: la última ocupa toda la fila para no dejar un hueco */
.comparacion > div:last-child:nth-child(odd) {
  grid-column: 1 / -1;
}
.comparacion > div,
.indicador {
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding: 10px 12px;
  background: var(--surface);
}
.comparacion strong,
.indicador strong {
  font-size: 20px;
  font-weight: 600;
}
.unidad {
  color: var(--muted);
  font-size: 12px;
}
.nota {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  margin: 0;
  color: var(--ink-2);
  font-size: 13px;
}
.nota strong {
  color: var(--ink);
}
.subseccion {
  margin-top: 6px;
}
.variables {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.variables .etiqueta {
  color: var(--ink-2);
  font-size: 12px;
  font-weight: 600;
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
.variable:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}
.modelo {
  display: flex;
  flex-direction: column;
  gap: 8px;
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
.calidad {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}
@media (min-width: 720px) {
  .comparacion {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
  .comparacion > div:last-child:nth-child(odd) {
    grid-column: auto;
  }
  .indicadores {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
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
